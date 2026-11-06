const router = require('express').Router();
const Setting = require('../models/Setting');
const { protect, adminOnly } = require('../middleware/auth');
const { razorpayEnabled } = require('./orders');
const { whatsappEnabled } = require('../utils/whatsapp');
const { pushEnabled } = require('../utils/push');
const { instagramEnabled } = require('../utils/instagram');
const flags = () => ({ razorpayEnabled: razorpayEnabled(), whatsappApiConnected: whatsappEnabled(), aiEnabled: !!process.env.ANTHROPIC_API_KEY, pushEnabled: pushEnabled(), instagramConnected: instagramEnabled() });

const EDITABLE = [
  'storeName', 'tagline', 'logo', 'announcement', 'heroSlides', 'whatsappNumber', 'phone', 'email',
  'address', 'instagram', 'facebook', 'shippingFee', 'freeShippingAbove', 'wholesaleShippingNote',
  'codEnabled', 'whatsappOrderEnabled', 'wholesaleMinOrderValue', 'returnPolicy', 'deliveryTime',
  'chatbotEnabled', 'chatbotName', 'chatbotWelcome', 'whatsappBotEnabled', 'notifyOwnerOnOrder', 'notifyCustomerOnStatus',
];

// GET /api/settings — public store info
router.get('/', async (_req, res) => {
  const s = (await Setting.get()).toJSON();
  delete s.__v;
  res.json({ ...s, ...flags() });
});

// PUT /api/settings — admin
router.put('/', protect, adminOnly, async (req, res) => {
  const s = await Setting.get();
  for (const key of EDITABLE) if (req.body[key] !== undefined) s[key] = req.body[key];
  if (s.whatsappNumber) s.whatsappNumber = String(s.whatsappNumber).replace(/\D/g, '');
  await s.save();
  res.json({ ...s.toJSON(), ...flags() });
});

module.exports = router;
