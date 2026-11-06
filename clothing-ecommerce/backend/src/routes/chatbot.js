const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const FaqEntry = require('../models/FaqEntry');
const Setting = require('../models/Setting');
const { optionalAuth, protect, adminOnly } = require('../middleware/auth');
const { reply } = require('../utils/botEngine');
const { httpError } = require('../utils/helpers');

const chatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

// POST /api/chatbot/message { message, history? } — website chat widget
router.post('/message', chatLimiter, optionalAuth, async (req, res) => {
  const settings = await Setting.get();
  if (!settings.chatbotEnabled) throw httpError(403, 'Chat is turned off');
  const r = await reply(req.body?.message, {
    user: req.user,
    channel: 'web',
    history: Array.isArray(req.body?.history) ? req.body.history : [],
  });
  res.json(r);
});

// ---- Knowledge base (admin) ----
const pick = (b = {}) => {
  const d = {};
  if (b.question !== undefined) d.question = b.question;
  if (b.answer !== undefined) d.answer = b.answer;
  if (b.isActive !== undefined) d.isActive = b.isActive;
  if (b.keywords !== undefined) {
    d.keywords = (Array.isArray(b.keywords) ? b.keywords : String(b.keywords).split(','))
      .map((k) => String(k).trim().toLowerCase())
      .filter(Boolean);
  }
  return d;
};

router.get('/faqs', protect, adminOnly, async (_req, res) => {
  res.json(await FaqEntry.find().sort({ createdAt: -1 }));
});

router.post('/faqs', protect, adminOnly, async (req, res) => {
  res.status(201).json(await FaqEntry.create(pick(req.body)));
});

router.put('/faqs/:id', protect, adminOnly, async (req, res) => {
  const faq = await FaqEntry.findByIdAndUpdate(req.params.id, pick(req.body), { new: true, runValidators: true });
  if (!faq) throw httpError(404, 'Entry not found');
  res.json(faq);
});

router.delete('/faqs/:id', protect, adminOnly, async (req, res) => {
  await FaqEntry.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
