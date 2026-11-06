const router = require('express').Router();
const Coupon = require('../models/Coupon');
const { optionalAuth, protect, adminOnly, isApprovedWholesale } = require('../middleware/auth');
const { applyCoupon } = require('../utils/coupon');
const { httpError } = require('../utils/helpers');

// POST /api/coupons/validate { code, subtotal }
router.post('/validate', optionalAuth, async (req, res) => {
  const { coupon, discount } = await applyCoupon(req.body.code, Number(req.body.subtotal) || 0, isApprovedWholesale(req.user));
  res.json({ code: coupon.code, discount });
});

router.get('/', protect, adminOnly, async (_req, res) => {
  res.json(await Coupon.find().sort({ createdAt: -1 }));
});

const FIELDS = ['code', 'type', 'value', 'minOrder', 'maxDiscount', 'appliesTo', 'usageLimit', 'expiresAt', 'isActive'];
const pick = (b) => Object.fromEntries(FIELDS.filter((k) => b[k] !== undefined).map((k) => [k, b[k] === '' ? undefined : b[k]]));

router.post('/', protect, adminOnly, async (req, res) => {
  res.status(201).json(await Coupon.create(pick(req.body || {})));
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw httpError(404, 'Coupon not found');
  Object.assign(coupon, pick(req.body || {}));
  await coupon.save();
  res.json(coupon);
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  await Coupon.findByIdAndDelete(req.params.id);
  res.json({ message: 'Coupon deleted' });
});

module.exports = router;
