const router = require('express').Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Setting = require('../models/Setting');
const Coupon = require('../models/Coupon');
const { optionalAuth, protect, adminOnly, isApprovedWholesale } = require('../middleware/auth');
const { httpError, orderNumber } = require('../utils/helpers');
const { applyCoupon } = require('../utils/coupon');
const { notifyStatus } = require('../utils/whatsapp');
const { notifyNewOrder } = require('../utils/notify');

const razorpayEnabled = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/**
 * Prices every cart line on the server (never trust prices from the browser),
 * checks stock and wholesale minimum quantities, and returns order totals.
 */
async function priceCart(items, user, couponCode) {
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'Your cart is empty');
  const settings = await Setting.get();
  const wholesale = isApprovedWholesale(user);

  const ids = [...new Set(items.map((i) => String(i.productId)))];
  const products = await Product.find({ _id: { $in: ids }, isActive: true });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const qtyByProduct = {};
  const qtyBySize = {};
  const lines = items.map((item) => {
    const p = byId.get(String(item.productId));
    if (!p) throw httpError(400, 'One of the items in your cart is no longer available');
    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    const sizeEntry = p.sizes.find((s) => s.label === item.size) || (p.sizes.length === 1 ? p.sizes[0] : null);
    if (!sizeEntry) throw httpError(400, `Please choose a size for ${p.name}`);

    const sizeKey = `${p._id}|${sizeEntry.label}`;
    qtyBySize[sizeKey] = (qtyBySize[sizeKey] || 0) + qty;
    if (qtyBySize[sizeKey] > sizeEntry.stock) {
      throw httpError(400, `Only ${sizeEntry.stock} left of ${p.name} (${sizeEntry.label})`);
    }
    qtyByProduct[p._id] = (qtyByProduct[p._id] || 0) + qty;

    const price = wholesale && p.wholesalePrice ? p.wholesalePrice : p.price;
    return {
      product: p._id,
      name: p.name,
      slug: p.slug,
      image: p.images?.[0] || '',
      size: sizeEntry.label,
      color: item.color || '',
      qty,
      price,
    };
  });

  if (wholesale) {
    for (const p of products) {
      if (p.wholesalePrice && (qtyByProduct[p._id] || 0) < (p.moq || 1)) {
        throw httpError(400, `Minimum wholesale order for ${p.name} is ${p.moq} pieces`);
      }
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  if (wholesale && settings.wholesaleMinOrderValue && subtotal < settings.wholesaleMinOrderValue) {
    throw httpError(400, `Minimum wholesale order value is ₹${settings.wholesaleMinOrderValue}`);
  }

  const { coupon, discount } = await applyCoupon(couponCode, subtotal, wholesale);
  const afterDiscount = subtotal - discount;
  const shipping = wholesale ? 0 : afterDiscount >= settings.freeShippingAbove ? 0 : settings.shippingFee;

  return {
    lines,
    wholesale,
    coupon,
    settings,
    totals: { subtotal, discount, shipping, total: afterDiscount + shipping },
  };
}

/**
 * Adjusts stock per size. sign = -1 reserves (order placed), +1 releases (order cancelled).
 * Uses optimistic concurrency (document version) so two simultaneous orders can't oversell.
 */
async function adjustProductStock(productId, lines, sign) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const p = await Product.findById(productId);
    if (!p) {
      if (sign < 0) throw httpError(400, 'A product in your cart is no longer available');
      return;
    }
    for (const l of lines) {
      const size = p.sizes.find((s) => s.label === l.size);
      if (!size) {
        if (sign < 0) throw httpError(400, `${l.name} (${l.size}) is no longer available`);
        continue;
      }
      if (sign < 0 && size.stock < l.qty) {
        throw httpError(400, `${l.name} (${l.size}) just went out of stock. Please update your cart.`);
      }
      size.stock += sign * l.qty;
      p.sold = Math.max(0, (p.sold || 0) - sign * l.qty);
    }
    try {
      await p.save();
      return;
    } catch (err) {
      if (err.name !== 'VersionError') throw err; // someone else changed it — retry with fresh data
    }
  }
  throw httpError(409, 'Too many people are ordering right now. Please try again.');
}

function groupByProduct(lines) {
  const map = new Map();
  for (const l of lines) {
    const key = String(l.product);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(l);
  }
  return map;
}

async function reserveStock(lines) {
  const done = [];
  for (const [productId, group] of groupByProduct(lines)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await adjustProductStock(productId, group, -1);
      done.push(...group);
    } catch (err) {
      await releaseStock(done);
      throw err;
    }
  }
}

async function releaseStock(lines) {
  for (const [productId, group] of groupByProduct(lines)) {
    // eslint-disable-next-line no-await-in-loop
    await adjustProductStock(productId, group, 1);
  }
}

function canView(order, req) {
  if (req.user?.role === 'admin') return true;
  if (req.user && order.user && String(order.user) === String(req.user._id)) return true;
  return !!req.query.key && req.query.key === order.accessKey;
}

// POST /api/orders/quote — price a cart without placing the order (cart & checkout pages)
router.post('/quote', optionalAuth, async (req, res) => {
  const { lines, totals, wholesale, coupon } = await priceCart(req.body.items, req.user, req.body.couponCode);
  res.json({ lines, ...totals, customerType: wholesale ? 'wholesale' : 'retail', couponCode: coupon?.code || null });
});

// POST /api/orders — place an order (guest or logged in)
/**
 * Creates an order from any channel (website, WhatsApp, Instagram). Prices are always
 * recalculated on the server, stock is reserved and the seller is notified everywhere.
 */
async function createOrder({ items, customer = {}, shippingAddress = {}, notes, paymentMethod = 'cod', couponCode, user, source = 'website' }) {
  if (!customer.name || !customer.phone) throw httpError(400, 'Name and phone number are required');
  if (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.pincode) {
    throw httpError(400, 'Please fill in the delivery address');
  }

  const { lines, totals, wholesale, coupon, settings } = await priceCart(items, user, couponCode);

  if (paymentMethod === 'razorpay' && !razorpayEnabled()) throw httpError(400, 'Online payment is not available right now');
  if (paymentMethod === 'cod' && !settings.codEnabled) throw httpError(400, 'Cash on delivery is not available');
  if (paymentMethod === 'whatsapp' && !settings.whatsappOrderEnabled) throw httpError(400, 'WhatsApp ordering is not available');
  if (!['cod', 'razorpay', 'whatsapp'].includes(paymentMethod)) throw httpError(400, 'Invalid payment method');

  await reserveStock(lines);

  const order = await Order.create({
    orderNumber: orderNumber(),
    accessKey: crypto.randomBytes(16).toString('hex'),
    user: user?._id,
    source: ['website', 'whatsapp', 'instagram', 'admin'].includes(source) ? source : 'website',
    customerType: wholesale ? 'wholesale' : 'retail',
    items: lines,
    customer: {
      name: customer.name,
      email: customer.email || user?.email,
      phone: customer.phone,
      businessName: customer.businessName || user?.businessName,
      gstin: customer.gstin || user?.gstin,
    },
    shippingAddress,
    notes,
    ...totals,
    couponCode: coupon?.code,
    paymentMethod,
    statusHistory: [{ status: 'pending', note: `Order placed via ${source}` }],
  });

  if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { used: 1 } });
  // Seller's phone app (push) + WhatsApp alerts — never blocks the order
  notifyNewOrder(order, settings, { skipCustomer: source === 'whatsapp' }).catch((e) => console.error('notify failed', e.message));
  return order;
}

// POST /api/orders — place an order from the website (guest or logged in)
router.post('/', optionalAuth, async (req, res) => {
  const src = String(req.body?.source || '').toLowerCase();
  const order = await createOrder({ ...(req.body || {}), user: req.user, source: ['instagram', 'whatsapp'].includes(src) ? src : 'website' });
  res.status(201).json({ order, accessKey: order.accessKey });
});

// GET /api/orders/mine — logged-in customer's orders
router.get('/mine', protect, async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json(orders);
});

// GET /api/orders — admin list
router.get('/', protect, adminOnly, async (req, res) => {
  const { status, type, q, source } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (source) filter.source = source;
  if (type) filter.customerType = type;
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ orderNumber: rx }, { 'customer.name': rx }, { 'customer.phone': rx }, { 'customer.email': rx }];
  }
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/orders/:id — owner (logged in), holder of the access key, or admin
router.get('/:id', optionalAuth, async (req, res) => {
  const order = await Order.findById(req.params.id).select('+accessKey');
  if (!order || !canView(order, req)) throw httpError(404, 'Order not found');
  const json = order.toJSON();
  delete json.accessKey;
  res.json(json);
});

// PUT /api/orders/:id — admin updates status / tracking / payment
router.put('/:id', protect, adminOnly, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, 'Order not found');
  const { status, note, trackingNumber, courier, paymentStatus } = req.body || {};

  if (status && status !== order.status) {
    if (!Order.STATUSES.includes(status)) throw httpError(400, 'Invalid status');
    if (status === 'cancelled' && order.status !== 'cancelled') await releaseStock(order.items);
    if (order.status === 'cancelled' && status !== 'cancelled') await reserveStock(order.items);
    order.status = status;
    order.statusHistory.push({ status, note });
  } else if (note) {
    order.statusHistory.push({ status: order.status, note });
  }
  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
  if (courier !== undefined) order.courier = courier;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  const statusChanged = order.isModified('status');
  await order.save();
  if (statusChanged) Setting.get().then((s) => notifyStatus(order, s)).catch(() => {});
  res.json(order);
});

module.exports = router;
module.exports.razorpayEnabled = razorpayEnabled;
module.exports.createOrder = createOrder;
module.exports.priceCart = priceCart;
