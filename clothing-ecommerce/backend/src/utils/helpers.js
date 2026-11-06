const { isApprovedWholesale } = require('../middleware/auth');

function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Hide wholesale pricing from everyone except approved wholesale buyers and admins
function shapeProduct(product, user) {
  const p = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };
  const canSeeWholesale = isApprovedWholesale(user) || user?.role === 'admin';
  p.hasWholesale = !!p.wholesalePrice;
  if (!canSeeWholesale) delete p.wholesalePrice;
  delete p.__v;
  return p;
}

function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ymd}-${rand}`;
}

module.exports = { slugify, httpError, shapeProduct, orderNumber };
