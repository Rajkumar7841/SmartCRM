import { Router } from 'express';
import { pool } from '../db.js';
import { wrap, httpError, parseId, validateCustomer } from '../utils.js';

const router = Router();

// List + search by name or email
router.get('/', wrap(async (req, res) => {
  const like = `%${String(req.query.search ?? '').trim()}%`;
  const [rows] = await pool.execute(
    `SELECT c.id, c.name, c.email, c.phone, c.address, c.source, c.created_at,
            COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS total_spent
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.name LIKE ? OR c.email LIKE ?
      GROUP BY c.id
      ORDER BY c.created_at DESC, c.id DESC`,
    [like, like]
  );
  res.json(rows);
}));

// One customer + purchase history + messages
router.get('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const [customers] = await pool.execute('SELECT * FROM customers WHERE id = ?', [id]);
  if (!customers.length) throw httpError(404, 'Customer not found');
  const [orders] = await pool.execute(
    `SELECT id, order_number, total, status, item_summary, order_date, source
       FROM orders WHERE customer_id = ? ORDER BY order_date DESC`, [id]);
  const [messages] = await pool.execute(
    `SELECT id, subject, status, delivery, created_at FROM messages
      WHERE customer_id = ? ORDER BY created_at DESC`, [id]);
  res.json({ ...customers[0], orders, messages });
}));

router.post('/', wrap(async (req, res) => {
  const c = validateCustomer(req.body);
  const [result] = await pool.execute(
    `INSERT INTO customers (name, email, phone, address, source) VALUES (?, ?, ?, ?, 'manual')`,
    [c.name, c.email, c.phone, c.address]
  );
  const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
}));

router.put('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const c = validateCustomer(req.body);
  const [exists] = await pool.execute('SELECT id FROM customers WHERE id = ?', [id]);
  if (!exists.length) throw httpError(404, 'Customer not found');
  await pool.execute(
    'UPDATE customers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
    [c.name, c.email, c.phone, c.address, id]
  );
  const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [id]);
  res.json(rows[0]);
}));

// Deleting a customer also deletes their orders and messages (ON DELETE CASCADE)
router.delete('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const [result] = await pool.execute('DELETE FROM customers WHERE id = ?', [id]);
  if (!result.affectedRows) throw httpError(404, 'Customer not found');
  res.json({ ok: true });
}));

export default router;
