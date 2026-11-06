const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { signToken, protect } = require('../middleware/auth');
const { httpError } = require('../utils/helpers');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

// POST /api/auth/register  — retail or wholesale signup
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, phone, password, accountType, businessName, gstin, city } = req.body || {};
  if (!name || !email || !password) throw httpError(400, 'Name, email and password are required');
  if (String(password).length < 6) throw httpError(400, 'Password must be at least 6 characters');

  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) throw httpError(400, 'An account with this email already exists');

  const isWholesale = accountType === 'wholesale';
  if (isWholesale && !businessName) throw httpError(400, 'Business name is required for wholesale accounts');

  const user = await User.create({
    name,
    email,
    phone,
    password,
    city,
    role: isWholesale ? 'wholesale' : 'customer',
    wholesaleStatus: isWholesale ? 'pending' : 'none',
    businessName: isWholesale ? businessName : undefined,
    gstin: isWholesale ? gstin : undefined,
  });

  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw httpError(400, 'Email and password are required');
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw httpError(401, 'Invalid email or password');
  if (user.isBlocked) throw httpError(403, 'This account has been disabled. Please contact the store.');
  res.json({ token: signToken(user), user });
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => res.json({ user: req.user }));

// PUT /api/auth/me — update own profile
router.put('/me', protect, async (req, res) => {
  const allowed = ['name', 'phone', 'city', 'address', 'businessName', 'gstin'];
  for (const key of allowed) if (req.body[key] !== undefined) req.user[key] = req.body[key];
  // A retail customer can apply to become a wholesale buyer
  if (req.body.applyWholesale && req.user.role === 'customer') {
    if (!req.user.businessName) throw httpError(400, 'Business name is required for wholesale accounts');
    req.user.role = 'wholesale';
    req.user.wholesaleStatus = 'pending';
  }
  await req.user.save();
  res.json({ user: req.user });
});

// PUT /api/auth/password
router.put('/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword || ''))) throw httpError(400, 'Current password is incorrect');
  if (!newPassword || newPassword.length < 6) throw httpError(400, 'New password must be at least 6 characters');
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated' });
});

module.exports = router;
