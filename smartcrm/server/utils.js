export const ORDER_STATUSES = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];

// Lets us use async/await in routes: any error goes to the error handler
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function parseId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw httpError(400, 'Invalid id');
  return n;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns cleaned customer data or throws a 400 error
export function validateCustomer(body = {}) {
  const errors = [];
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? '').trim();
  const address = String(body.address ?? '').trim();

  if (!name) errors.push('Name is required');
  else if (name.length > 100) errors.push('Name must be 100 characters or fewer');

  if (!email) errors.push('Email is required');
  else if (!EMAIL_RE.test(email) || email.length > 150) errors.push('Email is not valid');

  if (phone && !/^[0-9+()\-\s]{6,25}$/.test(phone)) errors.push('Phone may only contain digits, spaces, + - ( ) (6-25 characters)');
  if (address.length > 255) errors.push('Address must be 255 characters or fewer');

  if (errors.length) throw httpError(400, errors.join('. '));
  return { name, email, phone: phone || null, address: address || null };
}
