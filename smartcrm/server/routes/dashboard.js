import { Router } from 'express';
import { pool } from '../db.js';
import { wrap } from '../utils.js';
import { isDemoMode } from '../services/woo.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  const [[cust]] = await pool.query('SELECT COUNT(*) AS total FROM customers');

  // "Pending" = orders not finished yet (pending, processing, on-hold)
  // "Total sales" = sum of completed orders only
  const [[ord]] = await pool.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status IN ('pending','processing','on-hold')), 0) AS pending,
            COALESCE(SUM(status = 'completed'), 0) AS completed,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) AS sales
       FROM orders`
  );

  const [recentOrders] = await pool.query(
    `SELECT o.id, o.order_number, c.name AS customer_name, o.total, o.status, o.order_date
       FROM orders o JOIN customers c ON c.id = o.customer_id
      ORDER BY o.order_date DESC, o.id DESC LIMIT 5`);

  const [recentCustomers] = await pool.query(
    `SELECT id, name, email, source, created_at FROM customers ORDER BY created_at DESC, id DESC LIMIT 5`);

  const [recentMessages] = await pool.query(
    `SELECT m.id, c.name AS customer_name, m.subject, m.status, m.delivery, m.created_at
       FROM messages m JOIN customers c ON c.id = m.customer_id
      ORDER BY m.created_at DESC, m.id DESC LIMIT 5`);

  const [syncs] = await pool.query('SELECT * FROM sync_log ORDER BY id DESC LIMIT 1');

  res.json({
    totals: {
      customers: Number(cust.total),
      orders: Number(ord.total),
      pending: Number(ord.pending),
      completed: Number(ord.completed),
      sales: Number(ord.sales),
    },
    recentOrders,
    recentCustomers,
    recentMessages,
    woo: { mode: isDemoMode() ? 'demo' : 'live', lastSync: syncs[0] || null },
  });
}));

export default router;
