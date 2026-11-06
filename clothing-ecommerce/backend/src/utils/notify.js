/**
 * One place that tells the seller about new orders, whatever channel they came from:
 * push notification on the seller's phone app + WhatsApp alert + low-stock warnings.
 */
const Product = require('../models/Product');
const whatsapp = require('./whatsapp');
const { sendToAdmins } = require('./push');

const SOURCE_LABEL = { website: 'Website', whatsapp: 'WhatsApp', instagram: 'Instagram', admin: 'Admin' };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

async function notifyNewOrder(order, settings, opts = {}) {
  const pieces = order.items.reduce((n, i) => n + i.qty, 0);
  const tasks = [
    sendToAdmins({
      title: `🛍️ New order · ${inr(order.total)}`,
      body: `${order.orderNumber} · ${order.customer?.name} · ${pieces} pcs · via ${SOURCE_LABEL[order.source] || 'Website'}${order.customerType === 'wholesale' ? ' · WHOLESALE' : ''}`,
      url: `/admin/orders/${order._id}`,
      tag: `order-${order._id}`,
    }),
    whatsapp.notifyNewOrder(order, settings, opts),
  ];

  // Low-stock warning for the sizes this order just used up
  const ids = [...new Set(order.items.map((i) => String(i.product)))];
  const products = await Product.find({ _id: { $in: ids } }).select('name sizes');
  const low = [];
  for (const p of products) {
    for (const i of order.items.filter((x) => String(x.product) === String(p._id))) {
      const s = p.sizes.find((x) => x.label === i.size);
      if (s && s.stock <= 3) low.push(`${p.name} (${s.label}): ${s.stock} left`);
    }
  }
  if (low.length) {
    tasks.push(sendToAdmins({ title: '⚠️ Low stock', body: low.slice(0, 4).join('\n'), url: '/admin/inventory?low=1', tag: 'low-stock' }));
  }

  await Promise.allSettled(tasks);
}

module.exports = { notifyNewOrder };
