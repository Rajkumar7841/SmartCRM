import { api } from '../api.js';
import {
  useLoad, Loading, ErrorBox, StatusBadge, DeliveryBadge, SourceBadge, Empty, formatMoney, formatDate,
} from '../components/ui.jsx';

export default function Dashboard({ go }) {
  const { data, loading, error, reload } = useLoad(() => api.get('/dashboard'), []);

  if (loading && !data) return <Loading text="Loading dashboard…" />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const { totals, recentOrders, recentCustomers, recentMessages, woo } = data;

  const cards = [
    { label: 'Total customers', value: totals.customers, cls: 'c-blue', icon: '👥' },
    { label: 'Total orders', value: totals.orders, cls: 'c-purple', icon: '🧾' },
    { label: 'Pending orders', value: totals.pending, cls: 'c-amber', icon: '⏳' },
    { label: 'Completed orders', value: totals.completed, cls: 'c-green', icon: '✅' },
    { label: 'Total sales', value: formatMoney(totals.sales), cls: 'c-teal', icon: '💰' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Overview of your customers, orders and follow-ups</p>
        </div>
        <button className="btn" onClick={reload} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className={`stat-card ${c.cls}`}>
            <div className="stat-icon">{c.icon}</div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="hint">Pending = pending + processing + on-hold. Total sales = completed orders only.</p>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Recent orders</h2>
            <button className="link-btn" onClick={() => go('orders')}>View all →</button>
          </div>
          {recentOrders.length === 0 ? (
            <Empty text="No orders yet" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.order_number}</strong></td>
                      <td>{o.customer_name}</td>
                      <td>{formatDate(o.order_date)}</td>
                      <td>{formatMoney(o.total)}</td>
                      <td><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Customer activity</h2>
            <button className="link-btn" onClick={() => go('customers')}>View all →</button>
          </div>
          <h4 className="sub-title">Newest customers</h4>
          {recentCustomers.length === 0 ? (
            <Empty text="No customers yet" />
          ) : (
            <ul className="feed">
              {recentCustomers.map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>{c.name}</strong>
                    <div className="muted small">{c.email}</div>
                  </div>
                  <div className="feed-right">
                    <SourceBadge source={c.source} />
                    <span className="muted small">{formatDate(c.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <h4 className="sub-title">Latest messages</h4>
          {recentMessages.length === 0 ? (
            <Empty text="No messages yet" />
          ) : (
            <ul className="feed">
              {recentMessages.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.subject}</strong>
                    <div className="muted small">To {m.customer_name}</div>
                  </div>
                  <div className="feed-right">
                    <StatusBadge status={m.status} />
                    <DeliveryBadge delivery={m.delivery} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
