/**
 * Instagram: auto-reply to DMs with the store assistant, and show the latest posts on the website.
 * Needs an Instagram professional account connected to your Meta app:
 *   INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID  (and subscribe the webhook to Instagram "messages")
 */
const { reply, toWhatsAppText } = require('./botEngine');
const { storeUrl } = require('./whatsapp');

const IG_BASE = () => (process.env.INSTAGRAM_GRAPH_BASE || process.env.GRAPH_API_BASE || 'https://graph.instagram.com/v21.0').replace(/\/$/, '');
const instagramEnabled = () => !!(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID);

async function sendDM(recipientId, text) {
  try {
    const res = await fetch(`${IG_BASE()}/${process.env.INSTAGRAM_ACCOUNT_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text.slice(0, 1000) } }),
    });
    if (!res.ok) console.error('Instagram send failed:', await res.text());
  } catch (err) {
    console.error('Instagram send error:', err.message);
  }
}

async function handleWebhook(body, settings, firstTime) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const m = event.message;
      if (!m || m.is_echo || !firstTime(m.mid)) continue;
      const senderId = event.sender?.id;
      if (!senderId || senderId === process.env.INSTAGRAM_ACCOUNT_ID) continue;
      const text = m.text || '';
      const wa = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent('MENU')}`;
      if (!text) {
        // eslint-disable-next-line no-await-in-loop
        await sendDM(senderId, `Thanks for reaching out to ${settings.storeName}! 💕\nShop online: ${storeUrl()}?src=instagram\nOrder on WhatsApp: ${wa}`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const r = await reply(text, { channel: 'instagram' });
      const out = `${toWhatsAppText(r, { src: 'instagram', menuHint: false }).replace(/\*/g, '')}\n\n🛍️ Shop: ${storeUrl()}?src=instagram\n💬 Order on WhatsApp: ${wa}`;
      // eslint-disable-next-line no-await-in-loop
      await sendDM(senderId, out);
    }
  }
}

let feedCache = { at: 0, items: [] };
async function latestPosts(limit = 8) {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) return [];
  if (Date.now() - feedCache.at < 30 * 60 * 1000) return feedCache.items.slice(0, limit);
  try {
    const url = `${IG_BASE()}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=12&access_token=${encodeURIComponent(process.env.INSTAGRAM_ACCESS_TOKEN)}`;
    const res = await fetch(url);
    const data = await res.json();
    const items = (data.data || []).map((p) => ({
      id: p.id,
      image: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
      caption: (p.caption || '').slice(0, 140),
      url: p.permalink,
    })).filter((p) => p.image);
    feedCache = { at: Date.now(), items };
    return items.slice(0, limit);
  } catch {
    return feedCache.items.slice(0, limit);
  }
}

module.exports = { instagramEnabled, handleWebhook, latestPosts };
