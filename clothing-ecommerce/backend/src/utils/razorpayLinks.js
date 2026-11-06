/**
 * Razorpay Payment Links — used for WhatsApp orders ("Pay online" sends a secure link).
 */
const crypto = require('crypto');

const enabled = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
let client = null;
const rzp = () => {
  if (!client) {
    const Razorpay = require('razorpay');
    client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return client;
};

const apiUrl = () => (process.env.PUBLIC_URL || 'http://localhost:5000').replace(/\/$/, '');

async function createPaymentLink(order, storeName) {
  if (!enabled()) return null;
  const link = await rzp().paymentLink.create({
    amount: Math.round(order.total * 100),
    currency: 'INR',
    accept_partial: false,
    reference_id: order.orderNumber,
    description: `${storeName} order ${order.orderNumber}`.slice(0, 2048),
    customer: { name: order.customer.name, contact: `+${String(order.customer.phone).replace(/\D/g, '')}` },
    notify: { sms: false, email: false },
    reminder_enable: true,
    callback_url: `${apiUrl()}/api/payments/razorpay/link-callback`,
    callback_method: 'get',
  });
  order.paymentLinkUrl = link.short_url;
  order.razorpayPaymentLinkId = link.id;
  await order.save();
  return link.short_url;
}

function validLinkSignature(q) {
  if (!enabled()) return false;
  const payload = `${q.razorpay_payment_link_id}|${q.razorpay_payment_link_reference_id}|${q.razorpay_payment_link_status}|${q.razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(payload).digest('hex');
  const sig = String(q.razorpay_signature || '');
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

module.exports = { paymentLinksEnabled: enabled, createPaymentLink, validLinkSignature };
