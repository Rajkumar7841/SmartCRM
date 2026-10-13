import { httpError } from '../utils.js';

export function getWooConfig() {
  const url = (process.env.WC_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.WC_KEY || '').trim();
  const secret = (process.env.WC_SECRET || '').trim();
  return { url, key, secret, configured: Boolean(url && key && secret) };
}

// Demo mode is ON when keys are missing (or FORCE_DEMO=true)
export function isDemoMode() {
  return process.env.FORCE_DEMO === 'true' || !getWooConfig().configured;
}

// Calls the WooCommerce REST API. Secrets stay here on the server.
async function wooGet(path, params = {}) {
  const cfg = getWooConfig();
  const query = new URLSearchParams(params);
  const headers = { Accept: 'application/json' };

  if (cfg.url.startsWith('https://')) {
    headers.Authorization = 'Basic ' + Buffer.from(`${cfg.key}:${cfg.secret}`).toString('base64');
  } else {
    // plain http (e.g. local store): WooCommerce expects keys in the query string
    query.set('consumer_key', cfg.key);
    query.set('consumer_secret', cfg.secret);
  }

  let res;
  try {
    res = await fetch(`${cfg.url}/wp-json/wc/v3/${path}?${query}`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw httpError(502, `Cannot reach the store: ${err.cause?.code || err.message}`);
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    throw httpError(502, `WooCommerce answered ${res.status}. ${text}`);
  }
  return res.json();
}

async function fetchAll(path, params = {}) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await wooGet(path, { ...params, per_page: 100, page });
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export async function testLiveConnection() {
  await wooGet('orders', { per_page: 1 });
  await wooGet('customers', { per_page: 1 });
  return getWooConfig().url;
}

export async function fetchLiveData() {
  const customers = await fetchAll('customers');
  const orders = await fetchAll('orders', { status: 'any' });
  return { customers, orders };
}

// Sample data shaped exactly like the real WooCommerce API responses
export function getDemoData() {
  const addr = (a1, city, state) => ({ address_1: a1, city, state, postcode: '', country: 'IN' });
  return {
    customers: [
      { id: 9001, first_name: 'Meera', last_name: 'Joshi', email: 'meera.joshi@example.com',
        billing: { phone: '+91 90000 22001', ...addr('14 Lake View', 'Mumbai', 'Maharashtra') } },
      { id: 9002, first_name: 'Karan', last_name: 'Patel', email: 'karan.patel@example.com',
        billing: { phone: '+91 90000 22002', ...addr('9 Ring Road', 'Ahmedabad', 'Gujarat') } },
      { id: 9003, first_name: 'Divya', last_name: 'Rao', email: 'divya.rao@example.com',
        billing: { phone: '+91 90000 22003', ...addr('77 Brigade Road', 'Bengaluru', 'Karnataka') } },
    ],
    orders: [
      { id: 9101, number: '9101', status: 'completed', total: '1799.00', date_created: '2026-10-02T10:30:00', customer_id: 9001,
        billing: { first_name: 'Meera', last_name: 'Joshi', email: 'meera.joshi@example.com' },
        line_items: [{ name: 'Cotton Kurta', quantity: 1 }] },
      { id: 9102, number: '9102', status: 'pending', total: '2599.00', date_created: '2026-10-09T15:10:00', customer_id: 9001,
        billing: { first_name: 'Meera', last_name: 'Joshi', email: 'meera.joshi@example.com' },
        line_items: [{ name: 'Silk Scarf', quantity: 2 }] },
      { id: 9103, number: '9103', status: 'processing', total: '4299.00', date_created: '2026-10-10T09:00:00', customer_id: 9002,
        billing: { first_name: 'Karan', last_name: 'Patel', email: 'karan.patel@example.com' },
        line_items: [{ name: 'Leather Wallet', quantity: 1 }, { name: 'Belt', quantity: 1 }] },
      // Guest checkout (customer_id 0): matched to an existing customer by email, so no duplicate is created
      { id: 9104, number: '9104', status: 'completed', total: '999.00', date_created: '2026-10-05T18:45:00', customer_id: 0,
        billing: { first_name: 'Aarav', last_name: 'Sharma', email: 'aarav.sharma@example.com', phone: '+91 98220 11001' },
        line_items: [{ name: 'Notebook Set', quantity: 3 }] },
      { id: 9105, number: '9105', status: 'completed', total: '6499.00', date_created: '2026-10-07T12:20:00', customer_id: 9003,
        billing: { first_name: 'Divya', last_name: 'Rao', email: 'divya.rao@example.com' },
        line_items: [{ name: 'Office Chair Cushion', quantity: 1 }] },
    ],
  };
}
