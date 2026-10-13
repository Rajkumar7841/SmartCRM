import { useState } from 'react';
import { api } from '../api.js';
import {
  useLoad, useDebounced, Loading, ErrorBox, Notice, Modal, Empty, StatusBadge, SourceBadge, DeliveryBadge,
  formatMoney, formatDate,
} from '../components/ui.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CustomerForm({ customer, onClose, onSaved }) {
  const isEdit = Boolean(customer.id);
  const [form, setForm] = useState({
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    address: customer.address || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    if (!EMAIL_RE.test(form.email.trim())) return setError('Please enter a valid email address');
    setSaving(true);
    setError('');
    try {
      if (isEdit) await api.put(`/customers/${customer.id}`, form);
      else await api.post('/customers', form);
      onSaved(isEdit ? 'Customer updated' : 'Customer added');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit customer' : 'Add customer'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {error && <div className="alert alert-error"><span>{error}</span></div>}
        <label>Name *<input value={form.name} onChange={set('name')} maxLength={100} autoFocus /></label>
        <label>Email *<input type="email" value={form.email} onChange={set('email')} maxLength={150} /></label>
        <label>Phone<input value={form.phone} onChange={set('phone')} maxLength={25} placeholder="+91 98765 43210" /></label>
        <label>Address<textarea rows={3} value={form.address} onChange={set('address')} maxLength={255} /></label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add customer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerDetails({ id, onClose, onMessage }) {
  const { data, loading, error } = useLoad(() => api.get(`/customers/${id}`), [id]);

  return (
    <Modal title="Customer details" onClose={onClose} wide>
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && (
        <div>
          <div className="detail-top">
            <div>
              <h2 className="detail-name">{data.name}</h2>
              <div className="muted">{data.email}</div>
              <div className="muted">{data.phone || 'No phone'}</div>
              <div className="muted">{data.address || 'No address'}</div>
            </div>
            <div className="detail-actions">
              <SourceBadge source={data.source} />
              <button className="btn btn-primary" onClick={() => onMessage(data.id)}>✉️ Write follow-up</button>
            </div>
          </div>

          <h4 className="sub-title">Purchase history ({data.orders.length})</h4>
          {data.orders.length === 0 ? (
            <Empty text="No purchases yet" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.order_number}</strong></td>
                      <td>{formatDate(o.order_date)}</td>
                      <td>{o.item_summary || '—'}</td>
                      <td>{formatMoney(o.total)}</td>
                      <td><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 className="sub-title">Messages ({data.messages.length})</h4>
          {data.messages.length === 0 ? (
            <Empty text="No messages yet" />
          ) : (
            <ul className="feed">
              {data.messages.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.subject}</strong>
                    <div className="muted small">{formatDate(m.created_at)}</div>
                  </div>
                  <div className="feed-right">
                    <StatusBadge status={m.status} />
                    <DeliveryBadge delivery={m.delivery} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Customers({ go }) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const { data, loading, error, reload } = useLoad(
    () => api.get(`/customers?search=${encodeURIComponent(debounced)}`),
    [debounced]
  );
  const [editing, setEditing] = useState(null); // null = closed, {} = new customer
  const [viewingId, setViewingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}? Their orders and messages will also be deleted.`)) return;
    try {
      await api.del(`/customers/${c.id}`);
      setNotice({ type: 'success', text: `${c.name} was deleted` });
      reload();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p className="muted">Add, edit and search your customers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ Add customer</button>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="muted small">{data ? `${data.length} customer(s)` : ''}</span>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loading />}

      {data && (
        <section className="card">
          {data.length === 0 ? (
            <Empty text={debounced ? 'No customers match your search' : 'No customers yet. Add your first one!'} />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Total spent</th><th>Source</th><th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.email}</td>
                      <td>{c.phone || '—'}</td>
                      <td>{c.order_count}</td>
                      <td>{formatMoney(c.total_spent)}</td>
                      <td><SourceBadge source={c.source} /></td>
                      <td className="right nowrap">
                        <button className="btn btn-small" onClick={() => setViewingId(c.id)}>View</button>{' '}
                        <button className="btn btn-small" onClick={() => setEditing(c)}>Edit</button>{' '}
                        <button className="btn btn-small btn-danger" onClick={() => remove(c)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {editing && (
        <CustomerForm
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ type: 'success', text });
            reload();
          }}
        />
      )}
      {viewingId && (
        <CustomerDetails
          id={viewingId}
          onClose={() => setViewingId(null)}
          onMessage={(customerId) => go('messages', { customerId })}
        />
      )}
    </div>
  );
}
