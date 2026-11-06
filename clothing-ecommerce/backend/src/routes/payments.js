const router = require('express').Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const { optionalAuth } = require('../middleware/auth');
const { httpError } = require('../utils/helpers');
const { razorpayEnabled } = require('./orders');

let client = null;
function razorpay() {
  if (!razorpayEnabled()) throw httpError(400, 'Online payment is not configured');
  if (!client) {
    const Razorpay = require('razorpay');
    client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return client;
}

async function findOrderForPayment(orderId, key, user) {
  const order = await Order.findById(orderId).select('+accessKey');
  if (!order) throw httpError(404, 'Order not found');
  const owner = user && order.user && String(order.user) === String(user._id);
  if (!owner && key !== order.accessKey) throw httpError(404, 'Order not found');
  return order;
}

// POST /api/payments/razorpay/create { orderId, key }
router.post('/razorpay/create', optionalAuth, async (req, res) => {
  const order = await findOrderForPayment(req.body.orderId, req.body.key, req.user);
  if (order.paymentStatus === 'paid') throw httpError(400, 'This order is already paid');

  const rzpOrder = await razorpay().orders.create({
    amount: Math.round(order.total * 100),
    currency: 'INR',
    receipt: order.orderNumber,
  });
  order.razorpayOrderId = rzpOrder.id;
  await order.save();

  const settings = await Setting.get();
  res.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    storeName: settings.storeName,
    prefill: { name: order.customer.name, email: order.customer.email, contact: order.customer.phone },
  });
});

// POST /api/payments/razorpay/verify
router.post('/razorpay/verify', optionalAuth, async (req, res) => {
  const { orderId, key, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  const order = await findOrderForPayment(orderId, key, req.user);
  if (order.razorpayOrderId !== razorpay_order_id) throw httpError(400, 'Payment does not match this order');

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const valid =
    typeof razorpay_signature === 'string' &&
    expected.length === razorpay_signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

  if (!valid) {
    order.paymentStatus = 'failed';
    await order.save();
    throw httpError(400, 'Payment verification failed');
  }

  order.paymentStatus = 'paid';
  order.razorpayPaymentId = razorpay_payment_id;
  if (order.status === 'pending') {
    order.status = 'confirmed';
    order.statusHistory.push({ status: 'confirmed', note: 'Paid online' });
  }
  await order.save();
  res.json({ message: 'Payment successful' });
});

// GET /api/payments/razorpay/link-callback — customer returns here after paying a WhatsApp payment link
router.get('/razorpay/link-callback', async (req, res) => {
  const { validLinkSignature } = require('../utils/razorpayLinks');
  const { storeUrl, sendText } = require('../utils/whatsapp');
  const order = await Order.findOne({ orderNumber: req.query.razorpay_payment_link_reference_id }).select('+accessKey');
  if (!order) return res.redirect(storeUrl());
  if (validLinkSignature(req.query) && req.query.razorpay_payment_link_status === 'paid' && order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
    order.razorpayPaymentId = req.query.razorpay_payment_id;
    if (order.status === 'pending') {
      order.status = 'confirmed';
      order.statusHistory.push({ status: 'confirmed', note: 'Paid via payment link' });
    }
    await order.save();
    sendText(order.customer.phone, `✅ Payment received for order ${order.orderNumber}. Thank you! We'll update you when it ships.`).catch(() => {});
    require('../utils/push').sendToAdmins({ title: `💳 Payment received · ₹${order.total}`, body: `${order.orderNumber} · ${order.customer.name}`, url: `/admin/orders/${order._id}`, tag: `paid-${order._id}` }).catch(() => {});
  }
  res.redirect(`${storeUrl()}/order/${order._id}?key=${order.accessKey}`);
});

module.exports = router;
