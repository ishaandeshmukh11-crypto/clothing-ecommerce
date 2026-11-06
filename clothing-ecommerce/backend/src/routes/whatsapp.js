/**
 * Meta webhook for WhatsApp Business Cloud API **and** Instagram messaging.
 * In Meta Developer Console set:
 *   Callback URL:  https://<your-api-domain>/api/whatsapp/webhook
 *   Verify token:  WHATSAPP_VERIFY_TOKEN from .env
 *   Subscribe to:  WhatsApp → messages;  Instagram → messages
 */
const router = require('express').Router();
const Setting = require('../models/Setting');
const User = require('../models/User');
const { reply, toWhatsAppText } = require('../utils/botEngine');
const wa = require('../utils/whatsapp');
const waShop = require('../utils/waShop');
const instagram = require('../utils/instagram');

// Meta verification handshake
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

const seen = new Set(); // Meta can deliver the same message twice
const firstTime = (id) => {
  if (!id || seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 5000) seen.clear();
  return true;
};

async function handleWhatsApp(value, settings) {
  const owner = wa.normalizeNumber(settings.whatsappNumber);
  const names = Object.fromEntries((value.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
  for (const msg of value.messages || []) {
    if (!firstTime(msg.id)) continue;
    const from = msg.from;
    if (from === owner) continue; // never auto-reply to the shop owner

    const user = await User.findOne({ phone: new RegExp(`${from.slice(-10)}$`) });
    msg.profileName = names[from];

    // 1) Shopping flow (menu, categories, product, size, qty, cart, checkout)
    // eslint-disable-next-line no-await-in-loop
    if (await waShop.handle(from, msg, user, settings)) continue;

    // 2) Everything else → store assistant (FAQ, product search, order tracking)
    const text = msg.text?.body || msg.button?.text || '';
    if (!text) {
      await wa.sendText(from, 'Thanks! 🙏 Our team will look at this and reply shortly. Type *MENU* to browse and order here on WhatsApp.');
      continue;
    }
    const r = await reply(text, { user, phone: from, channel: 'whatsapp' });
    if (r.products?.length) {
      // Let them order straight from the search results
      await wa.sendList(from, `${r.text}`, 'View & order', r.products.map((p) => ({ id: `prod:${p.id}`, title: p.name, description: wa.inr(p.price) })), { sectionTitle: 'Matching styles' });
    } else {
      await wa.sendText(from, toWhatsAppText(r, { src: 'whatsapp' }));
    }
  }
}

router.post('/webhook', async (req, res) => {
  if (!wa.validSignature(req)) return res.sendStatus(401);
  res.sendStatus(200); // acknowledge immediately, then process

  try {
    const settings = await Setting.get();
    const body = req.body || {};

    if (body.object === 'instagram') {
      if (instagram.instagramEnabled()) await instagram.handleWebhook(body, settings, firstTime);
      return;
    }

    if (!wa.whatsappEnabled() || !settings.whatsappBotEnabled) return;
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        // eslint-disable-next-line no-await-in-loop
        if (change.value?.messages) await handleWhatsApp(change.value, settings);
      }
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }
});

module.exports = router;
