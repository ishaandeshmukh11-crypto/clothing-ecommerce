/**
 * Web Push to the seller's installed admin app (Android & iPhone home-screen app).
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (generate with `npm run vapid`).
 */
const PushSubscription = require('../models/PushSubscription');

let webpush = null;
const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

function client() {
  if (!pushEnabled()) return null;
  if (!webpush) {
    webpush = require('web-push');
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@store.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }
  return webpush;
}

/** payload: { title, body, url, tag } */
async function sendToAdmins(payload) {
  const wp = client();
  if (!wp) return { sent: 0, failed: 0 };
  const subs = await PushSubscription.find();
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await wp.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
        sent++;
        await PushSubscription.updateOne({ _id: s._id }, { lastUsedAt: new Date() });
      } catch (err) {
        failed++;
        // Subscription expired or the app was uninstalled — clean it up
        if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id });
      }
    })
  );
  return { sent, failed };
}

module.exports = { pushEnabled, sendToAdmins };
