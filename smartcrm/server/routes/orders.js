import { Router } from 'express';
import { pool } from '../db.js';
import { wrap, httpError, parseId, ORDER_STATUSES } from '../utils.js';

const router = Router();

// List with search (order number, customer name/email) and status filter
router.get('/', wrap(async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const status = String(req.query.status ?? '').trim();
  const where = [];
  const params = [];

  if (search) {
    where.push('(o.order_number LIKE ? OR c.name LIKE ? OR c.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status && status !== 'all') {
    if (!ORDER_STATUSES.includes(status)) throw httpError(400, 'Invalid status filter');
    where.push('o.status = ?');
    params.push(status);
  }

  const [rows] = await pool.execute(
    `SELECT o.id, o.order_number, o.customer_id, c.name AS customer_name, c.email AS customer_email,
            o.total, o.status, o.item_summary, o.order_date, o.source
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY o.order_date DESC, o.id DESC`,
    params
  );
  res.json(rows);
}));

// Create a demo/manual order
router.post('/', wrap(async (req, res) => {
  const customerId = parseId(req.body.customer_id);
  const total = Number(req.body.total);
  const status = String(req.body.status ?? 'pending');
  const items = String(req.body.item_summary ?? '').trim();

  if (!Number.isFinite(total) || total < 0 || total > 99999999) throw httpError(400, 'Total must be a number between 0 and 99999999');
  if (!ORDER_STATUSES.includes(status)) throw httpError(400, 'Invalid status');
  if (items.length > 500) throw httpError(400, 'Items must be 500 characters or fewer');

  const [cust] = await pool.execute('SELECT id FROM customers WHERE id = ?', [customerId]);
  if (!cust.length) throw httpError(400, 'Customer does not exist');

  const [result] = await pool.execute(
    `INSERT INTO orders (customer_id, total, status, item_summary, order_date, source)
     VALUES (?, ?, ?, ?, NOW(), 'manual')`,
    [customerId, total.toFixed(2), status, items || null]
  );
  await pool.execute('UPDATE orders SET order_number = ? WHERE id = ?', [`#${1000 + result.insertId}`, result.insertId]);

  const [rows] = await pool.execute('SELECT * FROM orders WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
}));

// Update status (demo/manual orders only; live WooCommerce orders stay read-only)
router.patch('/:id/status', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const status = String(req.body.status ?? '');
  if (!ORDER_STATUSES.includes(status)) throw httpError(400, `Status must be one of: ${ORDER_STATUSES.join(', ')}`);

  const [rows] = await pool.execute('SELECT id, source FROM orders WHERE id = ?', [id]);
  if (!rows.length) throw httpError(404, 'Order not found');
  if (rows[0].source === 'woocommerce') {
    throw httpError(403, 'Orders imported from a live WooCommerce store are read-only here. Change them in WooCommerce.');
  }
  await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  res.json({ ok: true, id, status });
}));

export default router;
