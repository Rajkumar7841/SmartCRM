import { useCallback, useEffect, useRef, useState } from 'react';

export const ORDER_STATUSES = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];

export const formatMoney = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (s) => (s ? String(s).slice(0, 10) : '—');

// Returns `value` only after the user stops typing for `delay` ms (for search boxes)
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Loads data from the API and tracks loading / error state
export function useLoad(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const counter = useRef(0);

  const load = useCallback(async () => {
    const id = ++counter.current; // ignore answers from older requests
    setLoading(true);
    setError('');
    try {
      const result = await fetcher();
      if (id === counter.current) setData(result);
    } catch (err) {
      if (id === counter.current) setError(err.message);
    } finally {
      if (id === counter.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export function Loading({ text = 'Loading…' }) {
  return (
    <div className="center-box">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="alert alert-error">
      <span>⚠️ {message}</span>
      {onRetry && (
        <button className="btn btn-small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`alert ${notice.type === 'error' ? 'alert-error' : notice.type === 'warn' ? 'alert-warn' : 'alert-success'}`}>
      <span>{notice.text}</span>
      <button className="close-x" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export function StatusBadge({ status }) {
  const slug = String(status).toLowerCase().replace(/[^a-z]/g, '-');
  return <span className={`badge badge-${slug}`}>{status}</span>;
}

export function SourceBadge({ source }) {
  const labels = { demo: 'Demo data', woocommerce: 'WooCommerce', manual: 'Manual' };
  return <span className={`badge badge-src-${source}`}>{labels[source] || source}</span>;
}

export function DeliveryBadge({ delivery }) {
  const map = {
    saved: ['Saved only (not emailed)', 'badge-saved'],
    simulated: ['Simulated: no email sent', 'badge-simulated'],
    sent: ['Emailed ✓', 'badge-sent'],
  };
  const [label, cls] = map[delivery] || [delivery, ''];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="close-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ text }) {
  return <div className="empty">{text}</div>;
}
