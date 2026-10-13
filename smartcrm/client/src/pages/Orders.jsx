import { useState } from 'react';
import { api } from '../api.js';
import {
  useLoad, useDebounced, Loading, ErrorBox, Notice, Modal, Empty, StatusBadge, SourceBadge,
  ORDER_STATUSES, formatMoney, formatDate,
} from '../components/ui.jsx';

function NewOrderForm({ onClose, onSaved }) {
  const customers = useLoad(() => api.get('/customers'), []);
  const [form, setForm] = useState({ customer_id: '', total: '', status: 'pending', item_summary: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return setError('Please choose a customer');
    if (form.total === '' || Number(form.total) < 0 || Number.isNaN(Number(form.total))) {
      return setError('Total must be a number (0 or more)');
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/orders', { ...form, customer_id: Number(form.customer_id), total: Number(form.total) });
      onSaved('Demo order created');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="New demo order" onClose={onClose}>
      {customers.loading && !customers.data && <Loading />}
      {customers.error && <ErrorBox message={customers.error} onRetry={customers.reload} />}
      {customers.data && (
        <form onSubmit={submit} className="form">
          {error && <div className="alert alert-error"><span>{error}</span></div>}
          <label>Customer *
            <select value={form.customer_id} onChange={set('customer_id')}>
              <option value="">Choose a customer…</option>
              {customers.data.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
              ))}
            </select>
          </label>
          <label>Total (₹) *<input type="number" min="0" step="0.01" value={form.total} onChange={set('total')} /></label>
          <label>Status
            <select value={form.status} onChange={set('status')}>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Items<input value={form.item_summary} onChange={set('item_summary')} maxLength={500} placeholder="e.g. 2x T-shirt" /></label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create order'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function Orders() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const debounced = useDebounced(search);
  const { data, loading, error, reload } = useLoad(
    () => api.get(`/orders?search=${encodeURIComponent(debounced)}&status=${encodeURIComponent(status)}`),
    [debounced, status]
  );
  const [notice, setNotice] = useState(null);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const changeStatus = async (order, newStatus) => {
    setUpdatingId(order.id);
    try {
      await api.patch(`/orders/${order.id}/status`, { status: newStatus });
      setNotice({ type: 'success', text: `Order ${order.order_number} is now "${newStatus}"` });
      await reload();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Orders</h1>
          <p className="muted">Track orders and update the status of demo orders</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New demo order</button>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search order #, customer name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="muted small">{data ? `${data.length} order(s)` : ''}</span>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loading />}

      {data && (
        <section className="card">
          {data.length === 0 ? (
            <Empty text="No orders match your filters" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.order_number}</strong></td>
                      <td>
                        {o.customer_name}
                        <div className="muted small">{o.customer_email}</div>
                      </td>
                      <td>{formatDate(o.order_date)}</td>
                      <td>{o.item_summary || '—'}</td>
                      <td>{formatMoney(o.total)}</td>
                      <td>
                        {o.source === 'woocommerce' ? (
                          <span title="Live WooCommerce orders are read-only"><StatusBadge status={o.status} /></span>
                        ) : (
                          <select
                            className="status-select"
                            value={o.status}
                            disabled={updatingId === o.id}
                            onChange={(e) => changeStatus(o, e.target.value)}
                          >
                            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </td>
                      <td><SourceBadge source={o.source} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {creating && (
        <NewOrderForm
          onClose={() => setCreating(false)}
          onSaved={(text) => {
            setCreating(false);
            setNotice({ type: 'success', text });
            reload();
          }}
        />
      )}
    </div>
  );
}
