/**
 * Shop entirely inside WhatsApp: browse categories → pick product → size → quantity →
 * cart → address → Cash on Delivery / payment link. Uses WhatsApp interactive lists & buttons.
 *
 * Customers start by sending "MENU" / "SHOP" (the website's "Shop on WhatsApp" buttons do this),
 * tapping a button, or sending a cart from the WhatsApp catalogue.
 */
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const WaSession = require('../models/WaSession');
const { isApprovedWholesale } = require('../middleware/auth');
const wa = require('./whatsapp');
const { createPaymentLink, paymentLinksEnabled } = require('./razorpayLinks');

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const PAGE = 9;
const START_WORDS = /^(menu|shop|start|catalog|catalogue|order|buy|hi|hii+|hello|hey|namaste)\b/i;

const absImage = (src) => {
  if (!src || /\.svg(\?|$)/i.test(src)) return null; // WhatsApp only shows JPG/PNG
  if (/^https?:/.test(src)) return src;
  return `${(process.env.PUBLIC_URL || 'http://localhost:5000').replace(/\/$/, '')}${src}`;
};

async function session(phone) {
  return (await WaSession.findOne({ phone })) || WaSession.create({ phone });
}

// ---------- screens ----------

async function mainMenu(to, s, settings) {
  const count = s.cart.reduce((n, i) => n + i.qty, 0);
  return wa.sendButtons(
    to,
    `Welcome to *${settings.storeName}* 👋\nBrowse our collection and order right here on WhatsApp.\n\nYou can also type what you want, e.g. _"black bodyfit top"_ or _"gown under 3000"_.`,
    [
      { id: 'shop:start', title: '🛍️ Shop now' },
      { id: 'cart:view', title: count ? `🧺 Cart (${count})` : '🧺 My cart' },
      { id: 'help:human', title: '💬 Talk to us' },
    ],
    { footer: wa.storeUrl().replace(/^https?:\/\//, '') }
  );
}

async function categoryMenu(to) {
  const cats = await Category.find({ isActive: true, parent: null }).sort({ sortOrder: 1, name: 1 }).limit(10);
  if (!cats.length) return wa.sendText(to, 'Our catalogue is being updated. Please check back soon! 🙏');
  return wa.sendList(
    to,
    'What are you shopping for today?',
    'Choose category',
    cats.map((c) => ({ id: `cat:${c._id}`, title: c.name, description: c.description || '' })),
    { sectionTitle: 'Categories' }
  );
}

async function subCategoryMenu(to, catId) {
  const cat = await Category.findById(catId);
  if (!cat) return categoryMenu(to);
  const subs = await Category.find({ parent: cat._id, isActive: true }).sort({ sortOrder: 1, name: 1 }).limit(9);
  if (!subs.length) return productList(to, cat._id, 0);
  return wa.sendList(
    to,
    `*${cat.name}* — pick a type:`,
    'Choose type',
    [{ id: `list:${cat._id}:0`, title: `All ${cat.name}`, description: 'See everything' }, ...subs.map((c) => ({ id: `list:${c._id}:0`, title: c.name, description: c.description || '' }))],
    { sectionTitle: cat.name }
  );
}

async function productList(to, catId, page, user) {
  const ids = await Category.withDescendants([catId]);
  const filter = { isActive: true, category: { $in: ids } };
  const [items, total, cat] = await Promise.all([
    Product.find(filter).sort({ isFeatured: -1, createdAt: -1 }).skip(page * PAGE).limit(PAGE),
    Product.countDocuments(filter),
    Category.findById(catId),
  ]);
  if (!items.length) {
    return wa.sendButtons(to, `Nothing in *${cat?.name || 'this category'}* right now. New stock arrives every week!`, [{ id: 'shop:start', title: '🛍️ Other categories' }, { id: 'help:human', title: '💬 Talk to us' }]);
  }
  const wholesale = isApprovedWholesale(user);
  const rows = items.map((p) => {
    const price = wholesale && p.wholesalePrice ? p.wholesalePrice : p.price;
    const inStock = p.sizes.filter((x) => x.stock > 0).map((x) => x.label);
    return {
      id: `prod:${p._id}`,
      title: p.name,
      description: `${inr(price)}${p.mrp > p.price && !wholesale ? ` (MRP ${inr(p.mrp)})` : ''} · ${inStock.length ? inStock.join(' ') : 'Sold out'}`,
    };
  });
  if (total > (page + 1) * PAGE) rows.push({ id: `list:${catId}:${page + 1}`, title: 'More styles ▶', description: `See ${total - (page + 1) * PAGE} more` });
  return wa.sendList(to, `*${cat?.name}* — ${total} style${total === 1 ? '' : 's'}${page ? ` (page ${page + 1})` : ''}. Tap one to see photos & sizes.`, 'View styles', rows, { sectionTitle: cat?.name || 'Styles' });
}

async function productCard(to, productId, user) {
  const p = await Product.findById(productId);
  if (!p || !p.isActive) return wa.sendText(to, 'Sorry, this style is no longer available.');
  const wholesale = isApprovedWholesale(user) && p.wholesalePrice;
  const price = wholesale ? p.wholesalePrice : p.price;
  const attrs = [...(p.attributes?.entries?.() || [])].map(([k, v]) => `${k}: ${v}`).join(' · ');
  const caption = [
    `*${p.name}*`,
    `${inr(price)}${wholesale ? ` (wholesale · MOQ ${p.moq} pcs)` : p.mrp > p.price ? `  ~${inr(p.mrp)}~` : ''}`,
    attrs,
    p.fabric ? `Fabric: ${p.fabric}` : '',
    p.colors?.length ? `Colour: ${p.colors.map((c) => c.name).join(', ')}` : '',
    '',
    (p.description || '').slice(0, 300),
    '',
    `${wa.storeUrl()}/product/${p.slug}?src=whatsapp`,
  ].filter((x) => x !== null && x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');

  const image = absImage(p.images?.[0]);
  if (image) await wa.sendImage(to, image, caption);
  else await wa.sendText(to, caption);

  const sizes = p.sizes.filter((x) => x.stock > 0);
  if (!sizes.length) return wa.sendButtons(to, 'This style is sold out right now.', [{ id: 'shop:start', title: '🛍️ See other styles' }, { id: 'help:human', title: '🔔 Notify me' }]);
  return wa.sendList(
    to,
    'Select your size:',
    'Choose size',
    sizes.slice(0, 10).map((x) => ({ id: `size:${p._id}:${x.label}`, title: x.label, description: x.stock <= 3 ? `Only ${x.stock} left` : 'In stock' })),
    { sectionTitle: 'Sizes' }
  );
}

async function askQty(to, s, productId, size, user) {
  const p = await Product.findById(productId);
  if (!p) return categoryMenu(to);
  s.state = 'await_qty';
  s.pending = { productId, size };
  await s.save();
  const wholesale = isApprovedWholesale(user) && p.wholesalePrice;
  const stock = p.sizes.find((x) => x.label === size)?.stock || 0;
  const opts = wholesale ? [p.moq, p.moq * 2, p.moq * 3] : [1, 2, 3];
  return wa.sendButtons(
    to,
    `*${p.name}* — size *${size}*\nHow many pieces?${wholesale ? `\n(Wholesale MOQ: ${p.moq} pcs per style — sizes can be mixed)` : ''}\n\nTap below or type a number (max ${stock}).`,
    opts.filter((n) => n <= stock).slice(0, 3).map((n) => ({ id: `qty:${n}`, title: `${n} pc${n > 1 ? 's' : ''}` })).concat(opts.some((n) => n <= stock) ? [] : [{ id: `qty:${stock}`, title: `${stock} pcs` }])
  );
}

async function addToCart(to, s, qty) {
  const { productId, size } = s.pending || {};
  const p = productId && (await Product.findById(productId));
  if (!p) {
    s.state = 'idle';
    await s.save();
    return categoryMenu(to);
  }
  const stock = p.sizes.find((x) => x.label === size)?.stock || 0;
  const already = s.cart.filter((i) => i.productId === productId && i.size === size).reduce((n, i) => n + i.qty, 0);
  if (qty + already > stock) return wa.sendText(to, `Sorry, only ${stock - already} left in size ${size}. Please type a smaller number.`);
  const line = s.cart.find((i) => i.productId === productId && i.size === size);
  if (line) line.qty += qty;
  else s.cart.push({ productId, size, qty });
  s.state = 'idle';
  s.pending = {};
  await s.save();
  const count = s.cart.reduce((n, i) => n + i.qty, 0);
  return wa.sendButtons(to, `✅ Added ${qty} × *${p.name}* (${size}) to your cart.\nCart: ${count} item${count > 1 ? 's' : ''}.`, [
    { id: 'checkout:start', title: '✅ Checkout' },
    { id: 'shop:start', title: '➕ Add more' },
    { id: 'cart:view', title: '🧺 View cart' },
  ]);
}

async function quote(s, user) {
  const { priceCart } = require('../routes/orders');
  return priceCart(s.cart.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty })), user);
}

function cartText(q) {
  const lines = q.lines.map((l) => `• ${l.name} (${l.size}) × ${l.qty} = ${inr(l.price * l.qty)}`);
  return [
    ...lines,
    '',
    `Subtotal: ${inr(q.totals.subtotal)}`,
    q.totals.discount ? `Discount: -${inr(q.totals.discount)}` : null,
    `Shipping: ${q.wholesale ? 'confirmed after packing' : q.totals.shipping ? inr(q.totals.shipping) : 'FREE'}`,
    `*Total: ${inr(q.totals.total)}*`,
  ].filter((x) => x !== null).join('\n');
}

async function viewCart(to, s, user) {
  if (!s.cart.length) return wa.sendButtons(to, 'Your cart is empty.', [{ id: 'shop:start', title: '🛍️ Shop now' }]);
  try {
    const q = await quote(s, user);
    return wa.sendButtons(to, `🧺 *Your cart*\n\n${cartText(q)}`, [
      { id: 'checkout:start', title: '✅ Checkout' },
      { id: 'shop:start', title: '➕ Add more' },
      { id: 'cart:clear', title: '🗑️ Clear cart' },
    ]);
  } catch (err) {
    return wa.sendButtons(to, `⚠️ ${err.message}`, [{ id: 'shop:start', title: '➕ Add more' }, { id: 'cart:clear', title: '🗑️ Clear cart' }]);
  }
}

const addressText = (a) => [a.name, a.line1, [a.city, a.state].filter(Boolean).join(', '), a.pincode].filter(Boolean).join('\n');

async function startCheckout(to, s, user) {
  if (!s.cart.length) return viewCart(to, s, user);
  try {
    await quote(s, user); // validates stock, MOQ etc.
  } catch (err) {
    return wa.sendButtons(to, `⚠️ ${err.message}`, [{ id: 'shop:start', title: '➕ Add more' }, { id: 'cart:view', title: '🧺 View cart' }]);
  }
  if (!s.address?.pincode) {
    const last = await Order.findOne({ 'customer.phone': new RegExp(`${String(to).slice(-10)}$`) }).sort({ createdAt: -1 });
    if (last?.shippingAddress?.pincode) {
      s.address = { name: last.customer.name, line1: [last.shippingAddress.line1, last.shippingAddress.line2].filter(Boolean).join(', '), city: last.shippingAddress.city, state: last.shippingAddress.state, pincode: last.shippingAddress.pincode };
      await s.save();
    }
  }
  if (s.address?.pincode) {
    return wa.sendButtons(to, `📦 Deliver to:\n\n${addressText(s.address)}`, [
      { id: 'addr:use', title: '✅ Use this address' },
      { id: 'addr:new', title: '✏️ New address' },
    ]);
  }
  return askAddress(to, s);
}

async function askAddress(to, s) {
  s.state = 'await_address';
  await s.save();
  return wa.sendText(to, '📝 Please send your *name and full delivery address with pincode* in one message.\n\nExample:\nPriya Sharma\nFlat 12, Green Park Society, MG Road\nPune, Maharashtra 411001');
}

/** Very forgiving address parser: needs a 6-digit pincode, takes the first line/part as the name */
function parseAddress(text) {
  const pin = text.match(/\b\d{6}\b/);
  if (!pin) return null;
  const parts = text.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const name = parts[0];
  const pinIdx = parts.findIndex((x) => x.includes(pin[0]));
  const beforePin = parts[pinIdx].replace(pin[0], '').trim();
  const tail = parts.slice(1, pinIdx).concat(beforePin ? [beforePin] : []);
  const city = tail.length > 1 ? tail[tail.length - 1] : tail[0] || '';
  const line1 = tail.slice(0, Math.max(1, tail.length - 1)).join(', ');
  const cityState = city.split(/\s+/);
  return { name, line1: line1 || city, city: cityState[0] || city, state: cityState.slice(1).join(' '), pincode: pin[0] };
}

async function askPayment(to, s, user, settings) {
  let q;
  try {
    q = await quote(s, user);
  } catch (err) {
    return wa.sendButtons(to, `⚠️ ${err.message}`, [{ id: 'cart:view', title: '🧺 View cart' }]);
  }
  s.state = 'await_payment';
  await s.save();
  const buttons = [];
  if (paymentLinksEnabled()) buttons.push({ id: 'pay:online', title: '💳 Pay online' });
  if (settings.codEnabled && !q.wholesale) buttons.push({ id: 'pay:cod', title: '💵 Cash on delivery' });
  if (settings.whatsappOrderEnabled) buttons.push({ id: 'pay:whatsapp', title: '🤝 Confirm, pay later' });
  if (!buttons.length) buttons.push({ id: 'help:human', title: '💬 Talk to us' });
  return wa.sendButtons(to, `🧾 *Order summary*\n\n${cartText(q)}\n\n📦 ${addressText(s.address).replace(/\n/g, ', ')}\n\nHow would you like to pay?`, buttons);
}

async function placeOrder(to, s, user, settings, method) {
  const { createOrder } = require('../routes/orders');
  try {
    const order = await createOrder({
      items: s.cart.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty })),
      customer: { name: s.address.name || s.name || 'WhatsApp customer', phone: to, email: user?.email },
      shippingAddress: { line1: s.address.line1, city: s.address.city, state: s.address.state, pincode: s.address.pincode },
      paymentMethod: method === 'online' ? 'razorpay' : method,
      user,
      source: 'whatsapp',
    });
    s.cart = [];
    s.state = 'idle';
    s.pending = {};
    await s.save();

    const track = `${wa.storeUrl()}/order/${order._id}?key=${order.accessKey}`;
    let payLine = '';
    if (method === 'online') {
      const link = await createPaymentLink(order, settings.storeName).catch((e) => {
        console.error('Payment link failed:', e.message);
        return null;
      });
      payLine = link ? `\n\n💳 *Pay securely here:* ${link}` : '\n\nWe will send you a payment link shortly.';
    } else if (method === 'cod') payLine = '\n\n💵 Pay in cash when your parcel arrives.';
    else payLine = '\n\n🤝 Our team will confirm your order and payment details here shortly.';

    await wa.sendText(to, `🎉 *Order placed!*\nOrder no: *${order.orderNumber}*\n\n${wa.orderSummary(order)}${payLine}\n\nTrack your order: ${track}\nType *MENU* any time to shop again.`);
    return order;
  } catch (err) {
    s.state = 'idle';
    await s.save();
    return wa.sendButtons(to, `⚠️ ${err.message}`, [{ id: 'cart:view', title: '🧺 View cart' }, { id: 'help:human', title: '💬 Talk to us' }]);
  }
}

/** Cart sent from the WhatsApp catalogue (needs product retailer ID = SKU, optionally "SKU__SIZE") */
async function catalogueOrder(to, s, order, user) {
  const added = [];
  for (const item of order.product_items || []) {
    const [sku, size] = String(item.product_retailer_id || '').split('__');
    // eslint-disable-next-line no-await-in-loop
    const p = await Product.findOne({ sku, isActive: true });
    if (!p) continue;
    const entry = (size && p.sizes.find((x) => x.label === size)) || p.sizes.find((x) => x.stock > 0);
    if (!entry) continue;
    s.cart.push({ productId: String(p._id), size: entry.label, qty: Math.max(1, Number(item.quantity) || 1) });
    added.push(`${p.name} (${entry.label}) × ${item.quantity}`);
  }
  await s.save();
  if (!added.length) return wa.sendText(to, 'Sorry, we could not find those items. Type *MENU* to browse.');
  await wa.sendText(to, `🧺 Added to your cart:\n${added.map((a) => `• ${a}`).join('\n')}`);
  return startCheckout(to, s, user);
}

/**
 * Handles one incoming WhatsApp message. Returns true if the shopping flow handled it,
 * false if it should go to the general chatbot.
 */
async function handle(from, msg, user, settings = null) {
  settings = settings || (await Setting.get());
  const s = await session(from);
  if (msg.profileName && !s.name) s.name = msg.profileName;

  if (msg.type === 'order' && msg.order) {
    await catalogueOrder(from, s, msg.order, user);
    return true;
  }

  const id = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || msg.button?.payload || '';
  const text = (msg.text?.body || msg.button?.text || '').trim();

  if (id) {
    const [kind, a, b] = id.split(':');
    switch (kind) {
      case 'shop': await categoryMenu(from); return true;
      case 'cat': await subCategoryMenu(from, a); return true;
      case 'list': await productList(from, a, Number(b) || 0, user); return true;
      case 'prod': await productCard(from, a, user); return true;
      case 'size': await askQty(from, s, a, id.split(':').slice(2).join(':'), user); return true;
      case 'qty': await addToCart(from, s, Math.max(1, Number(a) || 1)); return true;
      case 'cart':
        if (a === 'clear') { s.cart = []; s.state = 'idle'; await s.save(); await wa.sendButtons(from, 'Cart cleared.', [{ id: 'shop:start', title: '🛍️ Shop now' }]); }
        else await viewCart(from, s, user);
        return true;
      case 'checkout': await startCheckout(from, s, user); return true;
      case 'addr':
        if (a === 'use') await askPayment(from, s, user, settings);
        else await askAddress(from, s);
        return true;
      case 'pay': await placeOrder(from, s, user, settings, a); return true;
      case 'help':
        await wa.sendText(from, `Sure! A team member will reply here shortly 🙏\n📞 ${settings.phone}`);
        return true;
      default: break;
    }
  }

  if (text) {
    if (s.state === 'await_qty' && /^\d{1,4}$/.test(text)) { await addToCart(from, s, Number(text)); return true; }
    if (s.state === 'await_address') {
      const addr = parseAddress(text);
      if (!addr) { await wa.sendText(from, 'Please include your name, address and 6-digit pincode, each on a new line or separated by commas. 🙏'); return true; }
      s.address = addr;
      s.state = 'idle';
      await s.save();
      await askPayment(from, s, user, settings);
      return true;
    }
    if (/^(cart|my cart|view cart)$/i.test(text)) { await viewCart(from, s, user); return true; }
    if (/^(checkout|check out|place order)$/i.test(text)) { await startCheckout(from, s, user); return true; }
    if ((START_WORDS.test(text) && text.split(/\s+/).length <= 3) || (/^(hi|hello|hey|namaste)\b/i.test(text) && text.length < 60 && !/\d{6}|ORD-/i.test(text))) {
      await mainMenu(from, s, settings);
      return true;
    }
  }
  return false; // let the general chatbot answer (product search, FAQ, tracking…)
}

module.exports = { handle, parseAddress, mainMenu };
