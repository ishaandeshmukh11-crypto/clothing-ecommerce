const Coupon = require('../models/Coupon');
const { httpError } = require('./helpers');

// Returns { coupon, discount } or throws a 400 with a friendly message
async function applyCoupon(code, subtotal, isWholesale) {
  if (!code) return { coupon: null, discount: 0 };
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim(), isActive: true });
  if (!coupon) throw httpError(400, 'This coupon code is not valid');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw httpError(400, 'This coupon has expired');
  if (coupon.usageLimit && coupon.used >= coupon.usageLimit) throw httpError(400, 'This coupon has reached its usage limit');
  if (coupon.appliesTo === 'retail' && isWholesale) throw httpError(400, 'This coupon is for retail orders only');
  if (coupon.appliesTo === 'wholesale' && !isWholesale) throw httpError(400, 'This coupon is for wholesale orders only');
  if (subtotal < coupon.minOrder) throw httpError(400, `Add items worth ₹${coupon.minOrder} to use this coupon`);

  let discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.type === 'percent' && coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(Math.round(discount), subtotal);
  return { coupon, discount };
}

module.exports = { applyCoupon };
