const router = require('express').Router();
const PushSubscription = require('../models/PushSubscription');
const { protect, adminOnly } = require('../middleware/auth');
const { pushEnabled, sendToAdmins } = require('../utils/push');
const { httpError } = require('../utils/helpers');

// GET /api/push/public-key — the admin app needs this to subscribe
router.get('/public-key', (_req, res) => {
  res.json({ enabled: pushEnabled(), publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

// POST /api/push/subscribe { subscription, device }
router.post('/subscribe', protect, adminOnly, async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw httpError(400, 'Invalid subscription');
  await PushSubscription.findOneAndUpdate(
    { endpoint: sub.endpoint },
    { endpoint: sub.endpoint, keys: sub.keys, user: req.user._id, device: String(req.body.device || '').slice(0, 120) },
    { upsert: true, new: true }
  );
  res.json({ ok: true, devices: await PushSubscription.countDocuments() });
});

// POST /api/push/unsubscribe { endpoint }
router.post('/unsubscribe', protect, adminOnly, async (req, res) => {
  if (req.body?.endpoint) await PushSubscription.deleteOne({ endpoint: req.body.endpoint });
  res.json({ ok: true });
});

// GET /api/push/devices
router.get('/devices', protect, adminOnly, async (_req, res) => {
  res.json(await PushSubscription.find().select('device createdAt lastUsedAt').sort({ createdAt: -1 }));
});

// POST /api/push/test — sends a test notification to every registered device
router.post('/test', protect, adminOnly, async (_req, res) => {
  if (!pushEnabled()) throw httpError(400, 'Push is not configured on the server (VAPID keys missing)');
  res.json(await sendToAdmins({ title: '✅ Notifications are working', body: 'You will get an alert here for every new order.', url: '/admin', tag: 'test' }));
});

module.exports = router;
