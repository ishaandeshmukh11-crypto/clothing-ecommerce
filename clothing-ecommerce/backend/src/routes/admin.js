const router = require('express').Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { httpError } = require('../utils/helpers');

router.use(protect, adminOnly);

// GET /api/admin/stats — dashboard numbers
router.get('/stats', async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const since = new Date(startOfToday);
  since.setDate(since.getDate() - 13);

  const notCancelled = { status: { $ne: 'cancelled' } };

  const [revenueAgg, totalOrders, todayOrders, pendingOrders, customers, wholesalePending, allProducts, recentOrders, recent] =
    await Promise.all([
      Order.aggregate([{ $match: notCancelled }, { $group: { _id: '$customerType', revenue: { $sum: '$total' }, count: { $sum: 1 } } }]),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),
      Order.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'wholesale', wholesaleStatus: 'pending' }),
      Product.find().select('name slug images sizes').lean(),
      Order.find().sort({ createdAt: -1 }).limit(8),
      Order.find({ ...notCancelled, createdAt: { $gte: since } }).select('total createdAt source').lean(),
    ]);

  const byType = Object.fromEntries(revenueAgg.map((r) => [r._id, r]));

  const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const map = {};
  for (const o of recent) {
    const k = dayKey(o.createdAt);
    map[k] = map[k] || { revenue: 0, orders: 0 };
    map[k].revenue += o.total || 0;
    map[k].orders += 1;
  }
  const bySource = { website: 0, whatsapp: 0, instagram: 0, admin: 0 };
  for (const o of recent) bySource[o.source || 'website'] = (bySource[o.source || 'website'] || 0) + 1;
  const lowStock = allProducts
    .map((p) => ({ _id: p._id, name: p.name, slug: p.slug, images: p.images, stock: (p.sizes || []).reduce((n, x) => n + (x.stock || 0), 0) }))
    .filter((p) => p.stock <= 5)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8);

  // Fill missing days with zero so the chart has 14 bars
  const sales = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = dayKey(d);
    sales.push({ date: key, revenue: map[key]?.revenue || 0, orders: map[key]?.orders || 0 });
  }

  res.json({
    revenue: (byType.retail?.revenue || 0) + (byType.wholesale?.revenue || 0),
    retailRevenue: byType.retail?.revenue || 0,
    wholesaleRevenue: byType.wholesale?.revenue || 0,
    totalOrders,
    todayOrders,
    pendingOrders,
    customers,
    wholesalePending,
    products: allProducts.length,
    lowStock,
    bySource, // last 14 days
    recentOrders,
    sales,
  });
});

// GET /api/admin/users?role=&wholesaleStatus=&q=
router.get('/users', async (req, res) => {
  const { role, wholesaleStatus, q } = req.query;
  const filter = { role: { $ne: 'admin' } };
  if (role) filter.role = role;
  if (wholesaleStatus) filter.wholesaleStatus = wholesaleStatus;
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { businessName: rx }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(500).lean();

  const orderCounts = await Order.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) } } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$total' } } },
  ]);
  const map = Object.fromEntries(orderCounts.map((o) => [String(o._id), o]));
  res.json(users.map(({ password, ...u }) => ({ ...u, orders: map[String(u._id)]?.orders || 0, spent: map[String(u._id)]?.spent || 0 })));
});

// PUT /api/admin/users/:id — approve/reject wholesale, change role, block
router.put('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, 'User not found');
  const { wholesaleStatus, role, isBlocked } = req.body || {};
  if (wholesaleStatus) {
    user.wholesaleStatus = wholesaleStatus;
    if (wholesaleStatus === 'approved') user.role = 'wholesale';
  }
  if (role && ['customer', 'wholesale'].includes(role)) {
    user.role = role;
    if (role === 'customer') user.wholesaleStatus = 'none';
  }
  if (typeof isBlocked === 'boolean') user.isBlocked = isBlocked;
  await user.save();
  res.json(user);
});

module.exports = router;
