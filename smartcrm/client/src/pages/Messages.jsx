import { useState } from 'react';
import { api } from '../api.js';
import {
  useLoad, Loading, ErrorBox, Notice, Modal, Empty, StatusBadge, DeliveryBadge, formatDate,
} from '../components/ui.jsx';

const TEMPLATES = {
  update: {
    label: 'Order update',
    subject: 'Update on your order {{order_number}}',
    body: 'Hi {{name}},\n\nThis is a quick update on your order {{order_number}} ({{order_total}}). Its current status is: {{order_status}}.\n\nThank you for shopping with us!\nTeam SmartCRM',
  },
  thanks: {
    label: 'Thank you',
    subject: 'Thank you for your purchase',
    body: 'Hi {{name}},\n\nThank you for order {{order_number}}. We hope you love it!\n\nTeam SmartCRM',
  },
  followup: {
    label: 'Follow-up',
    subject: 'How was your experience?',
    body: 'Hi {{name}},\n\nWe would love to hear how things went with your recent order {{order_number}}. Just reply to this email with your feedback.\n\nTeam SmartCRM',
  },
};

function Compose({ initialCustomerId, onClose, onSaved }) {
  const customers = useLoad(() => api.get('/customers'), []);
  const orders = useLoad(() => api.get('/orders'), []);
  const [form, setForm] = useState({
    customer_id: initialCustomerId ? String(initialCustomerId) : '',
    order_id: '',
    subject: '',
    body: '',
  });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setPreview(null); // old preview no longer matches
  };

  const applyTemplate = (key) => {
    if (!key) return;
    setForm((f) => ({ ...f, subject: TEMPLATES[key].subject, body: TEMPLATES[key].body }));
    setPreview(null);
  };

  const payload = () => ({
    customer_id: Number(form.customer_id),
    order_id: form.order_id ? Number(form.order_id) : null,
    subject: form.subject,
    body: form.body,
  });

  const check = () => {
    if (!form.customer_id) return 'Please choose a customer';
    if (!form.subject.trim()) return 'Subject is required';
    if (!form.body.trim()) return 'Message body is required';
    return '';
  };

  const doPreview = async () => {
    const problem = check();
    if (problem) return setError(problem);
    setBusy('preview');
    setError('');
    try {
      setPreview(await api.post('/messages/preview', payload()));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const doSave = async () => {
    const problem = check();
    if (problem) return setError(problem);
    setBusy('save');
    setError('');
    try {
      await api.post('/messages', payload());
      onSaved('Message saved as Pending. Nothing has been emailed yet. Use the Send button in the list.');
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  const customerOrders = (orders.data || []).filter((o) => String(o.customer_id) === String(form.customer_id));

  return (
    <Modal title="New follow-up message" onClose={onClose} wide>
      {(customers.loading || orders.loading) && !customers.data && <Loading />}
      {(customers.error || orders.error) && <ErrorBox message={customers.error || orders.error} />}
      {customers.data && orders.data && (
        <div className="form">
          {error && <div className="alert alert-error"><span>{error}</span></div>}

          <div className="form-row">
            <label>Customer *
              <select
                value={form.customer_id}
                onChange={(e) => {
                  setForm((f) => ({ ...f, customer_id: e.target.value, order_id: '' }));
                  setPreview(null);
                }}
              >
                <option value="">Choose a customer…</option>
                {customers.data.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            </label>
            <label>Linked order (optional)
              <select value={form.order_id} onChange={(e) => set('order_id', e.target.value)} disabled={!form.customer_id}>
                <option value="">No order</option>
                {customerOrders.map((o) => <option key={o.id} value={o.id}>{o.order_number} · {o.status}</option>)}
              </select>
            </label>
          </div>

          <label>Start from a template
            <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Choose a template…</option>
              {Object.entries(TEMPLATES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
            </select>
          </label>

          <label>Subject *<input value={form.subject} onChange={(e) => set('subject', e.target.value)} maxLength={200} /></label>
          <label>Message *
            <textarea rows={7} value={form.body} onChange={(e) => set('body', e.target.value)} maxLength={5000} />
          </label>
          <p className="hint">
            Placeholders you can use: <code>{'{{name}}'}</code> <code>{'{{email}}'}</code> <code>{'{{order_number}}'}</code>{' '}
            <code>{'{{order_total}}'}</code> <code>{'{{order_status}}'}</code>
          </p>

          {preview && (
            <div className="preview">
              <div className="preview-tag">PREVIEW: not saved, not sent</div>
              <div><strong>To:</strong> {preview.to}</div>
              <div><strong>Subject:</strong> {preview.subject}</div>
              <pre>{preview.body}</pre>
            </div>
          )}

          <div className="form-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={doPreview} disabled={busy !== ''}>{busy === 'preview' ? 'Loading…' : '👁 Preview'}</button>
            <button className="btn btn-primary" onClick={doSave} disabled={busy !== ''}>{busy === 'save' ? 'Saving…' : 'Save message'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Messages({ prefill }) {
  const [status, setStatus] = useState('all');
  const { data, loading, error, reload } = useLoad(() => api.get(`/messages?status=${encodeURIComponent(status)}`), [status]);
  const config = useLoad(() => api.get('/messages/config'), []);
  const [composing, setComposing] = useState(Boolean(prefill?.customerId));
  const [viewing, setViewing] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const simulated = config.data?.emailMode !== 'smtp';

  const send = async (m) => {
    const question = simulated
      ? `Email is NOT configured, so this will only be SIMULATED (no real email goes to ${m.customer_email}). Continue?`
      : `Send this email to ${m.customer_email} now?`;
    if (!window.confirm(question)) return;
    setSendingId(m.id);
    try {
      const r = await api.post(`/messages/${m.id}/send`);
      setNotice({ type: r.delivery === 'sent' ? 'success' : 'warn', text: r.note });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setSendingId(null);
      reload();
    }
  };

  const remove = async (m) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.del(`/messages/${m.id}`);
      setNotice({ type: 'success', text: 'Message deleted' });
      reload();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Messages</h1>
          <p className="muted">Create follow-ups, preview them, then send</p>
        </div>
        <button className="btn btn-primary" onClick={() => setComposing(true)}>+ New message</button>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
          <option value="Failed">Failed</option>
        </select>
        <span className="muted small">{data ? `${data.length} message(s)` : ''}</span>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loading />}

      {data && (
        <section className="card">
          {data.length === 0 ? (
            <Empty text="No messages found" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Customer</th><th>Order</th><th>Subject</th><th>Created</th><th>Status</th><th>Delivery</th><th className="right">Actions</th></tr>
                </thead>
                <tbody>
                  {data.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.customer_name}</strong>
                        <div className="muted small">{m.customer_email}</div>
                      </td>
                      <td>{m.order_number || '—'}</td>
                      <td>{m.subject}</td>
                      <td>{formatDate(m.created_at)}</td>
                      <td>
                        <StatusBadge status={m.status} />
                        {m.status === 'Failed' && m.error_message && <div className="muted small">{m.error_message}</div>}
                      </td>
                      <td><DeliveryBadge delivery={m.delivery} /></td>
                      <td className="right nowrap">
                        <button className="btn btn-small" onClick={() => setViewing(m)}>View</button>{' '}
                        {m.delivery !== 'sent' && (
                          <button className="btn btn-small btn-primary" disabled={sendingId === m.id} onClick={() => send(m)}>
                            {sendingId === m.id ? 'Sending…' : m.status === 'Failed' ? 'Retry' : 'Send'}
                          </button>
                        )}{' '}
                        <button className="btn btn-small btn-danger" onClick={() => remove(m)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {composing && (
        <Compose
          initialCustomerId={prefill?.customerId}
          onClose={() => setComposing(false)}
          onSaved={(text) => {
            setComposing(false);
            setNotice({ type: 'success', text });
            reload();
          }}
        />
      )}

      {viewing && (
        <Modal title={viewing.subject} onClose={() => setViewing(null)}>
          <div className="preview">
            <div><strong>To:</strong> {viewing.customer_name} &lt;{viewing.customer_email}&gt;</div>
            <div><strong>Order:</strong> {viewing.order_number || 'none'}</div>
            <div className="badge-row"><StatusBadge status={viewing.status} /> <DeliveryBadge delivery={viewing.delivery} /></div>
            <pre>{viewing.body}</pre>
            {viewing.error_message && <div className="alert alert-error"><span>{viewing.error_message}</span></div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
