import { Router } from 'express';
import nodemailer from 'nodemailer';
import { pool } from '../db.js';
import { wrap, httpError, parseId } from '../utils.js';

const router = Router();

const smtpReady = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

// Replaces {{name}}, {{email}}, {{order_number}}, {{order_total}}, {{order_status}}
function render(text, customer, order) {
  const values = {
    name: customer.name,
    email: customer.email,
    order_number: order?.order_number ?? '',
    order_total: order ? `₹${Number(order.total).toFixed(2)}` : '',
    order_status: order?.status ?? '',
  };
  return String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in values ? values[key] : match));
}

async function loadContext(customerId, orderId) {
  const [customers] = await pool.execute('SELECT id, name, email FROM customers WHERE id = ?', [customerId]);
  if (!customers.length) throw httpError(400, 'Customer does not exist');
  let order = null;
  if (orderId) {
    const [orders] = await pool.execute(
      'SELECT id, order_number, total, status FROM orders WHERE id = ? AND customer_id = ?', [orderId, customerId]);
    if (!orders.length) throw httpError(400, 'That order does not belong to this customer');
    order = orders[0];
  }
  return { customer: customers[0], order };
}

function validateMessage(body = {}) {
  const customerId = parseId(body.customer_id);
  const orderId = body.order_id ? parseId(body.order_id) : null;
  const subject = String(body.subject ?? '').trim();
  const text = String(body.body ?? '').trim();
  if (!subject) throw httpError(400, 'Subject is required');
  if (subject.length > 200) throw httpError(400, 'Subject must be 200 characters or fewer');
  if (!text) throw httpError(400, 'Message body is required');
  if (text.length > 5000) throw httpError(400, 'Message body must be 5000 characters or fewer');
  return { customerId, orderId, subject, text };
}

// Tells the frontend whether real email is possible
router.get('/config', (req, res) => {
  res.json({ emailMode: smtpReady() ? 'smtp' : 'simulated' });
});

router.get('/', wrap(async (req, res) => {
  const status = String(req.query.status ?? '').trim();
  const params = [];
  let where = '';
  if (status && status !== 'all') {
    if (!['Pending', 'Completed', 'Failed'].includes(status)) throw httpError(400, 'Invalid status filter');
    where = 'WHERE m.status = ?';
    params.push(status);
  }
  const [rows] = await pool.execute(
    `SELECT m.id, m.customer_id, c.name AS customer_name, c.email AS customer_email,
            m.order_id, o.order_number, m.subject, m.body, m.status, m.delivery,
            m.error_message, m.created_at, m.sent_at
       FROM messages m
       JOIN customers c ON c.id = m.customer_id
       LEFT JOIN orders o ON o.id = m.order_id
       ${where}
      ORDER BY m.created_at DESC, m.id DESC`,
    params
  );
  res.json(rows);
}));

// Preview: shows the final text with placeholders filled in. Saves nothing.
router.post('/preview', wrap(async (req, res) => {
  const m = validateMessage(req.body);
  const { customer, order } = await loadContext(m.customerId, m.orderId);
  res.json({
    to: customer.email,
    subject: render(m.subject, customer, order),
    body: render(m.text, customer, order),
  });
}));

// Save a message (NOT sent yet)
router.post('/', wrap(async (req, res) => {
  const m = validateMessage(req.body);
  const { customer, order } = await loadContext(m.customerId, m.orderId);
  const [result] = await pool.execute(
    `INSERT INTO messages (customer_id, order_id, subject, body, status, delivery)
     VALUES (?, ?, ?, ?, 'Pending', 'saved')`,
    [customer.id, order ? order.id : null, render(m.subject, customer, order), render(m.text, customer, order)]
  );
  const [rows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
}));

router.delete('/:id', wrap(async (req, res) => {
  const [result] = await pool.execute('DELETE FROM messages WHERE id = ?', [parseId(req.params.id)]);
  if (!result.affectedRows) throw httpError(404, 'Message not found');
  res.json({ ok: true });
}));

// Send: real email if SMTP is configured, otherwise a clearly labelled SIMULATION
router.post('/:id/send', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const [rows] = await pool.execute(
    `SELECT m.id, m.subject, m.body, m.delivery, c.email AS customer_email
       FROM messages m JOIN customers c ON c.id = m.customer_id WHERE m.id = ?`, [id]);
  const msg = rows[0];
  if (!msg) throw httpError(404, 'Message not found');
  if (msg.delivery === 'sent') throw httpError(409, 'This message was already emailed');

  if (!smtpReady()) {
    await pool.execute(
      `UPDATE messages SET status = 'Completed', delivery = 'simulated', error_message = NULL, sent_at = NOW() WHERE id = ?`, [id]);
    return res.json({ ok: true, delivery: 'simulated', note: 'Demo mode: SMTP is not configured, so NO real email was sent.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: msg.customer_email,
      subject: msg.subject,
      text: msg.body,
    });
    await pool.execute(
      `UPDATE messages SET status = 'Completed', delivery = 'sent', error_message = NULL, sent_at = NOW() WHERE id = ?`, [id]);
    res.json({ ok: true, delivery: 'sent', note: `Email sent to ${msg.customer_email}` });
  } catch (err) {
    await pool.execute(
      `UPDATE messages SET status = 'Failed', delivery = 'saved', error_message = ? WHERE id = ?`,
      [String(err.message).slice(0, 250), id]);
    throw httpError(502, `Email failed: ${err.message}`);
  }
}));

export default router;
