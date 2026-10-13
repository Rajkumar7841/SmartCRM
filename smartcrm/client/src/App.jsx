import { useEffect, useState } from 'react';
import { api } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import Orders from './pages/Orders.jsx';
import Messages from './pages/Messages.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'customers', label: 'Customers', icon: '👥' },
  { id: 'orders', label: 'Orders', icon: '🧾' },
  { id: 'messages', label: 'Messages', icon: '✉️' }
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [prefill, setPrefill] = useState(null); // lets Customers open a pre-filled message form
  const [apiStatus, setApiStatus] = useState('checking');

  const go = (target, data = null) => {
    setPrefill(data);
    setPage(target);
  };

  useEffect(() => {
    const check = () =>
      api
        .get('/health')
        .then(() => setApiStatus('online'))
        .catch(() => setApiStatus('offline'));
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, []);

  const pageKey = page + (prefill?.customerId ?? '');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">S</span>
          <span className="brand-name">SmartCRM</span>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => go(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className={`dot dot-${apiStatus}`} />
          API {apiStatus}
        </div>
      </aside>

      <main className="content">
        {apiStatus === 'offline' && (
          <div className="alert alert-error">
            ⚠️ The backend is not reachable. Start it with <code>npm run dev</code> inside the <code>server</code> folder.
          </div>
        )}
        {page === 'dashboard' && <Dashboard key={pageKey} go={go} />}
        {page === 'customers' && <Customers key={pageKey} go={go} />}
        {page === 'orders' && <Orders key={pageKey} />}
        {page === 'messages' && <Messages key={pageKey} prefill={prefill} />}
      </main>
    </div>
  );
}
