const router = require('express').Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { optionalAuth, protect, adminOnly } = require('../middleware/auth');
const { slugify, httpError } = require('../utils/helpers');

// GET /api/categories  (?all=1 for admin: include hidden)
router.get('/', optionalAuth, async (req, res) => {
  const showAll = req.query.all && req.user?.role === 'admin';
  const filter = showAll ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean();

  const counts = await Product.aggregate([
    { $match: showAll ? {} : { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  // A parent's count includes its sub-categories
  const total = (c) =>
    (countMap[String(c._id)] || 0) +
    categories.filter((k) => String(k.parent) === String(c._id)).reduce((n, k) => n + total(k), 0);
  res.json(categories.map((c) => ({ ...c, productCount: total(c) })));
});

function cleanAttributes(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => ({
      name: String(a?.name || '').trim(),
      options: (Array.isArray(a?.options) ? a.options : String(a?.options || '').split(','))
        .map((o) => String(o).trim())
        .filter(Boolean),
    }))
    .filter((a) => a.name);
}

router.post('/', protect, adminOnly, async (req, res) => {
  const { name, description, image, sortOrder, isActive, parent, attributes } = req.body || {};
  if (!name) throw httpError(400, 'Category name is required');
  const category = await Category.create({
    name,
    slug: slugify(req.body.slug || name),
    parent: parent || null,
    attributes: cleanAttributes(attributes),
    description,
    image,
    sortOrder,
    isActive,
  });
  res.status(201).json(category);
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw httpError(404, 'Category not found');
  for (const key of ['name', 'description', 'image', 'sortOrder', 'isActive']) {
    if (req.body[key] !== undefined) category[key] = req.body[key];
  }
  if (req.body.attributes !== undefined) category.attributes = cleanAttributes(req.body.attributes);
  if (req.body.parent !== undefined) {
    if (req.body.parent && String(req.body.parent) === String(category._id)) throw httpError(400, 'A category cannot be its own parent');
    category.parent = req.body.parent || null;
  }
  if (req.body.slug) category.slug = slugify(req.body.slug);
  await category.save();
  res.json(category);
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  const inUse = await Product.countDocuments({ category: req.params.id });
  if (inUse) throw httpError(400, `This category has ${inUse} product(s). Move or delete them first.`);
  const children = await Category.countDocuments({ parent: req.params.id });
  if (children) throw httpError(400, `This category has ${children} sub-categor${children === 1 ? 'y' : 'ies'}. Move or delete them first.`);
  await Category.findByIdAndDelete(req.params.id);
  res.json({ message: 'Category deleted' });
});

module.exports = router;
