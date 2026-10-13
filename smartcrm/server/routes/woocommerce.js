import { Router } from 'express';
import { pool } from '../db.js';
import { wrap } from '../utils.js';
import { getWooConfig, isDemoMode, testLiveConnection, fetchLiveData, getDemoData } from '../services/woo.js';

const router = Router();

// ---- helpers that convert WooCommerce JSON into our table columns ----
const clean = (v, max) => (v ? String(v).trim().slice(0, max) : null);

function buildAddress(b = {}) {
  return [b.address_1, b.city, b.state, b.postcode, b.country].filter(Boolean).join(', ') || null;
}

function mapPerson(first, last, email, billing = {}) {
  const e = String(email || '').trim().toLowerCase().slice(0, 150);
  return {
    name: clean(`${first || ''} ${last || ''}`.trim() || e, 100),
    email: e,
    phone: clean(billing.phone, 25),
    address: clean(buildAddress(billing), 255),
  };
}

function mapOrder(o) {
  const date = (o.date_created || new Date().toISOString()).replace('T', ' ').slice(0, 19);
  return {
    woo_id: o.id,
    order_number: `#${o.number || o.id}`.slice(0, 30),
    total: (Number(o.total) || 0).toFixed(2),
    status: String(o.status || 'pending').slice(0, 20),
    item_summary: clean((o.line_items || []).map((i) => `${i.quantity}x ${i.name}`).join(', '), 500),
    order_date: date,
  };
}

// Finds an existing customer or creates one. Never creates duplicates.
async function upsertCustomer(conn, c) {
  if (c.woo_id) {
    const [byWoo] = await conn.execute('SELECT id FROM customers WHERE woo_id = ?', [c.woo_id]);
    if (byWoo.length) {
      await conn.execute(
        'UPDATE customers SET name = ?, phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ?',
        [c.name, c.phone, c.address, byWoo[0].id]);
      return { id: byWoo[0].id, created: false };
    }
  }
  const [byEmail] = await conn.execute('SELECT id FROM customers WHERE email = ?', [c.email]);
  if (byEmail.length) {
    if (c.woo_id) await conn.execute('UPDATE customers SET woo_id = COALESCE(woo_id, ?) WHERE id = ?', [c.woo_id, byEmail[0].id]);
    return { id: byEmail[0].id, created: false };
  }
  const [r] = await conn.execute(
    'INSERT INTO customers (woo_id, name, email, phone, address, source) VALUES (?, ?, ?, ?, ?, ?)',
    [c.woo_id || null, c.name, c.email, c.phone, c.address, c.source]);
  return { id: r.insertId, created: true };
}

async function upsertOrder(conn, o, customerId, source) {
  const [found] = await conn.execute('SELECT id FROM orders WHERE woo_id = ?', [o.woo_id]);
  if (found.length) {
    await conn.execute(
      `UPDATE orders SET customer_id = ?, order_number = ?, total = ?, status = ?, item_summary = ?, order_date = ? WHERE id = ?`,
      [customerId, o.order_number, o.total, o.status, o.item_summary, o.order_date, found[0].id]);
    return false;
  }
  await conn.execute(
    `INSERT INTO orders (woo_id, customer_id, order_number, total, status, item_summary, order_date, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [o.woo_id, customerId, o.order_number, o.total, o.status, o.item_summary, o.order_date, source]);
  return true;
}

async function logSync(demo, status, s, message) {
  await pool.execute(
    `INSERT INTO sync_log (sync_type, status, customers_created, customers_updated, orders_created, orders_updated, orders_skipped, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [demo ? 'demo' : 'live', status, s.customers_created || 0, s.customers_updated || 0,
     s.orders_created || 0, s.orders_updated || 0, s.orders_skipped || 0, String(message).slice(0, 250)]);
}

// ---- routes ----
router.get('/status', wrap(async (req, res) => {
  const cfg = getWooConfig();
  const [syncs] = await pool.query('SELECT * FROM sync_log ORDER BY id DESC LIMIT 1');
  const [[c]] = await pool.query(`SELECT COUNT(*) AS n FROM customers WHERE source IN ('woocommerce')`);
  const [[o]] = await pool.query(`SELECT COUNT(*) AS n FROM orders WHERE source IN ('woocommerce')`);
  res.json({
    mode: isDemoMode() ? 'demo' : 'live',
    configured: cfg.configured,
    storeUrl: cfg.url || null,   // never returns key or secret
    lastSync: syncs[0] || null,
    liveCustomers: Number(c.n),
    liveOrders: Number(o.n),
  });
}));

router.post('/test', wrap(async (req, res) => {
  if (isDemoMode()) {
    return res.json({ ok: true, mode: 'demo', message: 'DEMO MODE: no real WooCommerce store was contacted. Sample data will be used.' });
  }
  const url = await testLiveConnection();
  res.json({ ok: true, mode: 'live', message: `Connected to ${url}` });
}));

router.post('/import', wrap(async (req, res) => {
  const demo = isDemoMode();
  const source = demo ? 'demo' : 'woocommerce';
  const stats = { customers_created: 0, customers_updated: 0, orders_created: 0, orders_updated: 0, orders_skipped: 0 };

  let data;
  try {
    data = demo ? getDemoData() : await fetchLiveData();
  } catch (err) {
    await logSync(demo, 'failed', stats, err.message);
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const idByWooId = new Map();

    for (const wc of data.customers) {
      const p = mapPerson(wc.first_name, wc.last_name, wc.email, wc.billing);
      if (!p.email) continue;
      const r = await upsertCustomer(conn, { ...p, woo_id: wc.id, source });
      idByWooId.set(wc.id, r.id);
      stats[r.created ? 'customers_created' : 'customers_updated']++;
    }

    for (const wo of data.orders) {
      let customerId = idByWooId.get(wo.customer_id);
      if (!customerId) {
        // guest checkout: use billing details
        const b = mapPerson(wo.billing?.first_name, wo.billing?.last_name, wo.billing?.email, wo.billing);
        if (!b.email) { stats.orders_skipped++; continue; }
        const r = await upsertCustomer(conn, { ...b, woo_id: null, source });
        customerId = r.id;
        if (r.created) stats.customers_created++;
      }
      const created = await upsertOrder(conn, mapOrder(wo), customerId, source);
      stats[created ? 'orders_created' : 'orders_updated']++;
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    await logSync(demo, 'failed', stats, err.message);
    throw err;
  } finally {
    conn.release();
  }

  const message = `${demo ? 'DEMO import' : 'Import'} finished: ${stats.customers_created} new customers, ${stats.orders_created} new orders, ${stats.customers_updated + stats.orders_updated} updated, ${stats.orders_skipped} skipped.`;
  await logSync(demo, 'success', stats, message);
  res.json({ ok: true, mode: demo ? 'demo' : 'live', stats, message });
}));

export default router;
