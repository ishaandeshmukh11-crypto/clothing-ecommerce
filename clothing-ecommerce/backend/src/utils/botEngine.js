/**
 * Store chatbot "brain" — shared by the website chat widget and the WhatsApp bot.
 *
 * Answers come from (in this order):
 *  1. Live order lookup (order number, or the sender's phone on WhatsApp)
 *  2. The admin-trained knowledge base (Admin → Chatbot)
 *  3. Built-in store topics using live settings (wholesale, shipping, returns, payment, sizes, contact)
 *  4. Live product search from the catalogue (with price filters like "under 1500")
 *  5. Optional AI answer (if ANTHROPIC_API_KEY is set) grounded on the store data above
 *  6. Hand-off to the shop owner on WhatsApp
 */
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const FaqEntry = require('../models/FaqEntry');
const Setting = require('../models/Setting');
const { isApprovedWholesale } = require('../middleware/auth');
const { storeUrl, inr, normalizeNumber } = require('./whatsapp');

const STOP = new Set(
  'a an the and or for to of in on at is are am be do does did i me my we you your it this that with from can could would should will please pls plz want need looking look show find get buy have has any some some what which who how when where there here hai hain kya ka ki ke ko mujhe chahiye dikhao me se aur bhi'.split(' ')
);
const tokenize = (s = '') =>
  s.toLowerCase().replace(/[^a-z0-9₹\s-]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));

const has = (text, words) => words.some((w) => new RegExp(`\\b${w}`, 'i').test(text));

const STATUS_LABEL = {
  pending: 'Order received — awaiting confirmation',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function waLink(settings, text) {
  return `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(text || `Hi ${settings.storeName}, I need help.`)}`;
}

function describeOrder(order) {
  const lines = [
    `Order *${order.orderNumber}*`,
    `Status: *${STATUS_LABEL[order.status] || order.status}*`,
    `Items: ${order.items.reduce((s, i) => s + i.qty, 0)} piece(s) · Total ${inr(order.total)}`,
    `Payment: ${order.paymentMethod.toUpperCase()} (${order.paymentStatus})`,
  ];
  if (order.trackingNumber) lines.push(`Tracking: ${order.courier || ''} ${order.trackingNumber}`.trim());
  return lines.join('\n');
}

async function lookupOrder(message, ctx) {
  const match = message.match(/ORD-?\d{6}-?[A-Z0-9]{4}/i);
  if (match) {
    const raw = match[0].toUpperCase().replace(/^ORD-?(\d{6})-?([A-Z0-9]{4})$/, 'ORD-$1-$2');
    const order = await Order.findOne({ orderNumber: raw });
    if (!order) return { text: `I couldn't find an order with number ${raw}. Please check the number on your confirmation message.` };
    return { text: describeOrder(order), quickReplies: ['Talk to the store', 'Return / exchange'] };
  }
  if (has(message, ['track', 'order status', 'my order', 'where is', 'delivery status', 'kab aayega', 'parcel'])) {
    if (ctx.phone) {
      const last10 = normalizeNumber(ctx.phone).slice(-10);
      const order = await Order.findOne({ 'customer.phone': new RegExp(`${last10}$`) }).sort({ createdAt: -1 });
      if (order) return { text: `Here's your latest order:\n\n${describeOrder(order)}` };
    }
    if (ctx.user) {
      const order = await Order.findOne({ user: ctx.user._id }).sort({ createdAt: -1 });
      if (order) return { text: `Here's your latest order:\n\n${describeOrder(order)}` };
    }
    return { text: 'Sure! Please send me your order number — it looks like *ORD-261106-AB12* and is on your order confirmation.' };
  }
  return null;
}

async function matchFaq(message) {
  const faqs = await FaqEntry.find({ isActive: true }).lean();
  const tokens = new Set(tokenize(message));
  const lower = message.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const f of faqs) {
    let score = 0;
    for (const k of f.keywords || []) if (k && lower.includes(k)) score += k.includes(' ') ? 4 : 3;
    const qTokens = tokenize(f.question);
    const overlap = qTokens.filter((t) => tokens.has(t)).length;
    score += overlap;
    if (qTokens.length && overlap / qTokens.length >= 0.6) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  if (best && bestScore >= 3) {
    await FaqEntry.updateOne({ _id: best._id }, { $inc: { hits: 1 } });
    return { text: best.answer };
  }
  return null;
}

function builtInTopics(message, settings, ctx) {
  const s = settings;
  if (has(message, ['human', 'agent', 'person', 'owner', 'call', 'talk', 'baat', 'contact', 'number', 'whatsapp'])) {
    return {
      text: `You can reach ${s.storeName} directly:\n📞 ${s.phone}\n✉️ ${s.email}\n📍 ${s.address}\n\nTap below to chat with us on WhatsApp.`,
      handoff: true,
    };
  }
  if (has(message, ['wholesale', 'bulk', 'reseller', 'moq', 'minimum order', 'gst', 'b2b', 'dealer', 'retailer', 'shop owner', 'thok'])) {
    const approved = isApprovedWholesale(ctx.user);
    return {
      text: approved
        ? `You're an approved wholesale buyer ✅ Wholesale prices are shown on every product. Each product has a minimum order quantity (MOQ) — add at least that many pieces (any sizes) to check out.\n\n${s.wholesaleShippingNote}`
        : `Yes, we supply wholesale! 🧾\n1. Register a free wholesale account (business name, GSTIN optional): ${storeUrl()}/wholesale\n2. We approve it — usually within a few hours\n3. Log in to see wholesale prices and MOQ on every product.\n\n${s.wholesaleShippingNote}`,
      quickReplies: ['Talk to the store', 'Show new arrivals'],
    };
  }
  if (has(message, ['shipping', 'delivery', 'deliver', 'courier', 'dispatch', 'how long', 'days'])) {
    return {
      text: `🚚 We deliver ${s.deliveryTime}.\nRetail shipping is ${inr(s.shippingFee)}, and *free on orders above ${inr(s.freeShippingAbove)}*.\nWholesale: ${s.wholesaleShippingNote}`,
    };
  }
  if (has(message, ['return', 'exchange', 'refund', 'replace', 'wapas', 'badal'])) {
    return { text: `↩️ ${s.returnPolicy}`, quickReplies: ['Talk to the store'] };
  }
  if (has(message, ['payment', 'pay', 'cod', 'cash', 'upi', 'card', 'online', 'razorpay'])) {
    const ways = [s.codEnabled && 'Cash on Delivery', 'UPI / cards / net-banking (secure online payment)', s.whatsappOrderEnabled && 'Order on WhatsApp and pay as agreed with the store'].filter(Boolean);
    return { text: `💳 You can pay by:\n• ${ways.join('\n• ')}` };
  }
  if (has(message, ['size', 'fit', 'measurement', 'chart', 'xl', 'xxl', 'small', 'medium', 'large'])) {
    return {
      text: 'Each product page lists the sizes in stock. General guide (chest, inches):\nS 36 · M 38 · L 40 · XL 42 · XXL 44 · 3XL 46\nBetween sizes? Choose the bigger one for a relaxed fit, or send us your measurements on WhatsApp and we\'ll suggest the right size.',
      quickReplies: ['Talk to the store'],
    };
  }
  if (has(message, ['timing', 'open', 'address', 'location', 'store', 'visit', 'dukan', 'kaha'])) {
    return { text: `📍 ${s.address}\n📞 ${s.phone}\nMessage us on WhatsApp before visiting so we can keep your pieces ready.`, handoff: true };
  }
  return null;
}

async function searchProducts(message, ctx) {
  const lower = message.toLowerCase();
  let max;
  let min;
  const under = lower.match(/(?:under|below|less than|within|upto|up to|<)\s*₹?\s*(\d{3,6})/);
  const above = lower.match(/(?:above|over|more than|>)\s*₹?\s*(\d{3,6})/);
  if (under) max = Number(under[1]);
  if (above) min = Number(above[1]);

  const wantsNew = has(lower, ['new', 'latest', 'arrival']);
  const wantsBest = has(lower, ['best', 'popular', 'trending', 'bestseller', 'top']);

  const tokens = tokenize(lower).filter(
    (t) => !/^\d+$/.test(t) && !['under', 'below', 'above', 'over', 'less', 'more', 'than', 'price', 'rs', 'new', 'latest', 'arrivals', 'arrival', 'best', 'popular', 'trending', 'top', 'show', 'collection', 'products', 'items', 'clothes', 'clothing', 'cloth', 'wear', 'kapde', 'dress'].includes(t)
  );
  // simple singularisation: "kurtis" → "kurti", "shirts" → "shirt"
  const terms = [...new Set(tokens.map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)))];

  const filter = { isActive: true };
  if (min || max) filter.price = { ...(min && { $gte: min }), ...(max && { $lte: max }) };

  if (terms.length) {
    const rxs = terms.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    // word-start match so "men" doesn't match "Women"
    const cats = await Category.find({ $or: terms.map((t) => ({ name: new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') })) }).select('_id');
    filter.$or = [
      ...rxs.flatMap((r) => [{ name: r }, { tags: r }, { fabric: r }, { 'colors.name': r }]),
      ...(cats.length ? [{ category: { $in: await Category.withDescendants(cats.map((c) => c._id)) } }] : []),
    ];
  } else if (!wantsNew && !wantsBest && !min && !max) {
    return null;
  }

  const candidates = await Product.find(filter)
    .populate('category', 'name')
    .sort(wantsBest ? { sold: -1 } : { createdAt: -1 })
    .limit(40)
    .lean();
  if (!candidates.length) return { products: [], terms };

  const score = (p) => {
    const hay = `${p.name} ${(p.tags || []).join(' ')} ${p.fabric} ${p.category?.name || ''} ${(p.colors || []).map((c) => c.name).join(' ')}`.toLowerCase();
    return terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
  };
  const ranked = candidates.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s);
  const top = ranked.filter((r) => !terms.length || r.s === ranked[0].s).slice(0, 4).map((r) => r.p);

  const wholesale = isApprovedWholesale(ctx.user);
  return {
    terms,
    products: top.map((p) => ({
      id: String(p._id),
      name: p.name,
      slug: p.slug,
      image: p.images?.[0] || '',
      price: wholesale && p.wholesalePrice ? p.wholesalePrice : p.price,
      mrp: p.mrp,
      moq: wholesale && p.wholesalePrice ? p.moq : undefined,
      url: `${storeUrl()}/product/${p.slug}`,
    })),
  };
}

async function askAI(message, ctx, settings, products) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const faqs = await FaqEntry.find({ isActive: true }).limit(40).lean();
    const system = [
      `You are "${settings.chatbotName}", the friendly shopping assistant for ${settings.storeName}, an Indian clothing store that sells retail and wholesale.`,
      'Answer in the same language the customer uses (English, Hindi or Hinglish). Keep replies short (max ~80 words), warm and helpful.',
      'Only use the store information below. Never invent products, prices, offers or policies. If you are not sure, say the store team will help on WhatsApp.',
      'Never reveal wholesale prices unless listed in the products below.',
      `STORE: phone ${settings.phone}, email ${settings.email}, address ${settings.address}. Delivery ${settings.deliveryTime}. Retail shipping ₹${settings.shippingFee}, free above ₹${settings.freeShippingAbove}. Wholesale: ${settings.wholesaleShippingNote}. Returns: ${settings.returnPolicy}. Website: ${storeUrl()}`,
      `FAQ:\n${faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n')}`,
      products?.length ? `MATCHING PRODUCTS:\n${products.map((p) => `${p.name} — ₹${p.price} — ${p.url}`).join('\n')}` : '',
    ].join('\n\n');

    const history = (ctx.history || [])
      .slice(-6)
      .filter((m) => m && m.text)
      .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: String(m.text).slice(0, 800) }));
    while (history.length && history[0].role !== 'user') history.shift();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        max_tokens: 300,
        system,
        messages: [...history, { role: 'user', content: message.slice(0, 1000) }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.find((c) => c.type === 'text')?.text?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * @param {string} message
 * @param {{ user?: object, phone?: string, channel?: 'web'|'whatsapp', history?: Array }} ctx
 * @returns {Promise<{ text: string, products?: Array, quickReplies?: string[], handoff?: boolean, whatsappLink: string }>}
 */
async function reply(message, ctx = {}) {
  const settings = await Setting.get();
  const msg = String(message || '').trim().slice(0, 1000);
  const base = { whatsappLink: waLink(settings) };
  const defaultQuick = ['Show new arrivals', 'Wholesale prices', 'Track my order', 'Shipping & returns'];

  if (!msg || /^(hi+|hello+|hey+|hii+|namaste|namaskar|hola|good (morning|afternoon|evening)|start|menu)\b[!. ]*$/i.test(msg)) {
    return { ...base, text: settings.chatbotWelcome, quickReplies: defaultQuick };
  }
  if (/^(thanks|thank you|thx|ok|okay|great|dhanyavad|shukriya)\b/i.test(msg)) {
    return { ...base, text: `You're welcome! 😊 Anything else I can help you with?`, quickReplies: defaultQuick };
  }

  const order = await lookupOrder(msg, ctx);
  if (order) return { ...base, ...order };

  const faq = await matchFaq(msg);
  if (faq) return { ...base, ...faq };

  const topic = builtInTopics(msg, settings, ctx);
  if (topic) return { ...base, ...topic };

  const found = await searchProducts(msg, ctx);
  if (found?.products?.length) {
    return {
      ...base,
      text: `Here ${found.products.length === 1 ? 'is something' : 'are some picks'} you might like:`,
      products: found.products,
      quickReplies: ['Show bestsellers', 'Wholesale prices', 'Talk to the store'],
    };
  }

  const ai = await askAI(msg, ctx, settings, found?.products);
  if (ai) return { ...base, text: ai, quickReplies: ['Talk to the store'] };

  if (found && found.terms?.length) {
    return {
      ...base,
      text: `I couldn't find "${found.terms.join(' ')}" in our catalogue right now. Our team can check new stock for you on WhatsApp 👇`,
      handoff: true,
      whatsappLink: waLink(settings, `Hi ${settings.storeName}, do you have ${found.terms.join(' ')}?`),
    };
  }

  return {
    ...base,
    text: "I'm not sure about that one, but our team can help you right away on WhatsApp. You can also ask me about products, sizes, wholesale, shipping or your order.",
    handoff: true,
    quickReplies: defaultQuick,
  };
}

// Turns a bot reply into plain WhatsApp text (WhatsApp has no product cards in a basic text message)
function toWhatsAppText(r, { src = 'whatsapp', menuHint = true } = {}) {
  let text = r.text;
  if (r.products?.length) {
    text += `\n\n${r.products
      .map((p, i) => `${i + 1}. *${p.name}* — ${inr(p.price)}${p.moq ? ` (MOQ ${p.moq})` : ''}\n${p.url}?src=${src}`)
      .join('\n\n')}`;
  }
  if (r.quickReplies?.length) text += `\n\nYou can also ask: ${r.quickReplies.filter((q) => q !== 'Talk to the store').join(' · ')}`;
  if (r.handoff) text += '\n\nA team member will also reply here shortly. 🙏';
  if (menuHint && src === 'whatsapp') text += '\n\n👉 Type *MENU* to browse & order right here on WhatsApp.';
  return text;
}

module.exports = { reply, toWhatsAppText };
