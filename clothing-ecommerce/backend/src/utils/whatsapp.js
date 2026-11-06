/**
 * WhatsApp Business Cloud API (Meta) helper.
 * Needs WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env. If they are missing,
 * every function quietly does nothing, so the store still works without it.
 */
const crypto = require('crypto');

const graphBase = () => (process.env.GRAPH_API_BASE || `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v21.0'}`).replace(/\/$/, '');

const whatsappEnabled = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

function normalizeNumber(num = '') {
  let digits = String(num).replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`; // default to India
  return digits;
}

async function send(to, message) {
  if (!whatsappEnabled() || !to) return null;
  try {
    const res = await fetch(`${graphBase()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: normalizeNumber(to), ...message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error('WhatsApp send failed:', data?.error?.message || data);
    return data;
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return null;
  }
}

const clip = (s, n) => {
  const t = String(s ?? '');
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function sendText(to, body) {
  if (!body) return null;
  return send(to, { type: 'text', text: { preview_url: true, body: clip(body, 4000) } });
}

/** Up to 3 tap buttons. buttons: [{ id, title }] */
function sendButtons(to, body, buttons, { header, footer } = {}) {
  return send(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(header ? { header: { type: 'text', text: clip(header, 60) } } : {}),
      body: { text: clip(body, 1024) },
      ...(footer ? { footer: { text: clip(footer, 60) } } : {}),
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: clip(b.id, 256), title: clip(b.title, 20) } })) },
    },
  });
}

/** A pick-list (max 10 rows). rows: [{ id, title, description }] */
function sendList(to, body, buttonText, rows, { header, footer, sectionTitle } = {}) {
  return send(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(header ? { header: { type: 'text', text: clip(header, 60) } } : {}),
      body: { text: clip(body, 1024) },
      ...(footer ? { footer: { text: clip(footer, 60) } } : {}),
      action: {
        button: clip(buttonText, 20),
        sections: [{ title: clip(sectionTitle || 'Options', 24), rows: rows.slice(0, 10).map((r) => ({ id: clip(r.id, 200), title: clip(r.title, 24), ...(r.description ? { description: clip(r.description, 72) } : {}) })) }],
      },
    },
  });
}

function sendImage(to, link, caption) {
  return send(to, { type: 'image', image: { link, caption: clip(caption, 1024) } });
}

// Validates Meta's X-Hub-Signature-256 header when WHATSAPP_APP_SECRET is set
function validSignature(req) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  const header = req.get('x-hub-signature-256') || '';
  if (!req.rawBody || !header.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;
  return expected.length === header.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}

const storeUrl = () => (process.env.STORE_URL || (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0]).replace(/\/$/, '');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function orderSummary(order) {
  const lines = order.items.map((i) => `• ${i.name} (${i.size}${i.color ? `, ${i.color}` : ''}) × ${i.qty} = ${inr(i.price * i.qty)}`);
  return [
    `*Order ${order.orderNumber}*`,
    ...lines,
    `Subtotal: ${inr(order.subtotal)}`,
    order.discount ? `Discount: -${inr(order.discount)}` : null,
    `Shipping: ${order.customerType === 'wholesale' ? 'To be confirmed' : inr(order.shipping)}`,
    `*Total: ${inr(order.total)}*`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function notifyNewOrder(order, settings, { skipCustomer = false } = {}) {
  if (!whatsappEnabled()) return;
  if (settings.notifyOwnerOnOrder && settings.whatsappNumber) {
    const a = order.shippingAddress || {};
    await sendText(
      settings.whatsappNumber,
      `🛍️ New ${order.customerType} order (${order.source || 'website'})!\n\n${orderSummary(order)}\n\nCustomer: ${order.customer.name} (${order.customer.phone})${
        order.customer.businessName ? `\nBusiness: ${order.customer.businessName}` : ''
      }\nAddress: ${[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}\nPayment: ${order.paymentMethod.toUpperCase()}`
    );
  }
  if (order.customer?.phone && !skipCustomer) {
    await sendText(
      order.customer.phone,
      `Hi ${order.customer.name}, thank you for shopping with ${settings.storeName}! 🎉\n\n${orderSummary(order)}\n\nWe'll update you here as your order moves. Reply to this message any time if you have a question.`
    );
  }
}

const STATUS_TEXT = {
  confirmed: 'has been confirmed ✅',
  packed: 'is packed and ready to ship 📦',
  shipped: 'has been shipped 🚚',
  delivered: 'has been delivered 🎉 We hope you love it!',
  cancelled: 'has been cancelled. If this is unexpected, just reply here.',
};

async function notifyStatus(order, settings) {
  if (!whatsappEnabled() || !settings.notifyCustomerOnStatus || !STATUS_TEXT[order.status]) return;
  const tracking = order.status === 'shipped' && order.trackingNumber
    ? `\nCourier: ${order.courier || '-'}\nTracking no: ${order.trackingNumber}`
    : '';
  await sendText(order.customer.phone, `Hi ${order.customer.name}, your order ${order.orderNumber} ${STATUS_TEXT[order.status]}${tracking}`);
}

module.exports = { whatsappEnabled, sendText, sendButtons, sendList, sendImage, graphBase, validSignature, notifyNewOrder, notifyStatus, normalizeNumber, storeUrl, inr, orderSummary };
