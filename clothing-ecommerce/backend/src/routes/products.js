const router = require('express').Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const { optionalAuth, protect, adminOnly } = require('../middleware/auth');
const { slugify, httpError, shapeProduct } = require('../utils/helpers');
const { describeProduct, autoTags } = require('../utils/describe');

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { sold: -1, createdAt: -1 },
  name: { name: 1 },
  stock_asc: { stockTotal: 1, name: 1 },
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/products
// ?category=slug (includes sub-categories) &sale=1 &q= &sort= &min= &max= &size= &featured=1 &newArrival=1 &page= &limit= &all=1(admin)
router.get('/', optionalAuth, async (req, res) => {
  const { category, q, sort = 'newest', min, max, size, featured, newArrival, sale } = req.query;
  const isAdmin = req.user?.role === 'admin';
  const filter = {};
  if (!(isAdmin && req.query.all)) filter.isActive = true;

  if (category) {
    const cat = await Category.findOne({ slug: category });
    if (!cat) return res.json({ items: [], total: 0, page: 1, pages: 0 });
    filter.category = { $in: await Category.withDescendants([cat._id]) }; // parent shows all its sub-categories
  }
  if (q) {
    const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [{ name: rx }, { tags: rx }, { fabric: rx }, { sku: rx }];
  }
  if (min || max) {
    filter.price = {};
    if (min) filter.price.$gte = Number(min);
    if (max) filter.price.$lte = Number(max);
  }
  if (size) filter['sizes.label'] = size;
  if (featured) filter.isFeatured = true;
  if (newArrival) filter.isNewArrival = true;
  if (sale) filter.discount = { $gt: 0 };
  if (isAdmin && req.query.stock === 'low') filter.stockTotal = { $gt: 0, $lte: Number(req.query.lowAt) || 5 };
  if (isAdmin && req.query.stock === 'out') filter.stockTotal = 0;
  if (isAdmin && req.query.hidden) filter.isActive = false;
  // Attribute filters: ?a_Sleeve=Spaghetti&a_Length=Gown
  for (const [key, value] of Object.entries(req.query)) {
    if (key.startsWith('a_') && value) {
      const name = key.slice(2).replace(/[^\w -]/g, '');
      if (name) filter[`attributes.${name}`] = String(value);
    }
  }

  const limit = Math.min(Number(req.query.limit) || 12, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug parent')
      .sort(SORTS[sort] || SORTS.newest)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    items: items.map((p) => shapeProduct(p, req.user)),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// GET /api/products/id/:id  (admin edit form)
router.get('/id/:id', protect, adminOnly, async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug parent');
  if (!product) throw httpError(404, 'Product not found');
  res.json(shapeProduct(product, req.user));
});

// GET /api/products/:slug  (+ related products)
router.get('/:slug', optionalAuth, async (req, res) => {
  const filter = { slug: req.params.slug };
  if (req.user?.role !== 'admin') filter.isActive = true;
  const product = await Product.findOne(filter).populate('category', 'name slug parent');
  if (!product) throw httpError(404, 'Product not found');

  const related = await Product.find({
    _id: { $ne: product._id },
    category: product.category?._id,
    isActive: true,
  })
    .limit(4)
    .sort({ sold: -1 });

  res.json({
    product: shapeProduct(product, req.user),
    related: related.map((p) => shapeProduct(p, req.user)),
  });
});

const FIELDS = [
  'name', 'sku', 'description', 'category', 'images', 'price', 'mrp', 'wholesalePrice', 'moq',
  'sizes', 'colors', 'attributes', 'fabric', 'care', 'tags', 'isFeatured', 'isNewArrival', 'isActive',
];

function pick(body) {
  const data = {};
  for (const key of FIELDS) if (body[key] !== undefined) data[key] = body[key];
  if (data.category === '') data.category = null;
  if (data.wholesalePrice === '' || data.wholesalePrice === null) data.wholesalePrice = undefined;
  if (typeof data.tags === 'string') data.tags = data.tags.split(',').map((t) => t.trim()).filter(Boolean);
  if (Array.isArray(data.sizes) && data.sizes.length === 0) data.sizes = [{ label: 'Free Size', stock: 0 }];
  return data;
}

// Writes a description / tags automatically when the admin leaves them empty
async function autofill(data) {
  if (data.description && data.tags?.length) return;
  const cat = data.category ? await Category.findById(data.category).populate('parent', 'name') : null;
  const meta = {
    name: data.name,
    categoryPath: [cat?.parent?.name, cat?.name].filter(Boolean),
    attributes: data.attributes || {},
    fabric: data.fabric,
    colors: data.colors || [],
  };
  if (!data.description) data.description = describeProduct(meta);
  if (!data.tags?.length) data.tags = autoTags(meta);
}

async function uniqueSlug(base, ignoreId) {
  let slug = slugify(base) || 'product';
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Product.exists({ slug, _id: { $ne: ignoreId } })) slug = `${slugify(base)}-${++i}`;
  return slug;
}

router.post('/', protect, adminOnly, async (req, res) => {
  const data = pick(req.body || {});
  if (!data.name || data.price === undefined) throw httpError(400, 'Name and price are required');
  data.slug = await uniqueSlug(req.body.slug || data.name);
  await autofill(data);
  const product = await Product.create(data);
  res.status(201).json(product);
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw httpError(404, 'Product not found');
  const data = pick(req.body || {});
  if ('wholesalePrice' in req.body && data.wholesalePrice === undefined) product.wholesalePrice = undefined;
  Object.assign(product, data);
  if (!product.description) {
    const tmp = { ...product.toObject({ flattenMaps: true }), description: '', tags: product.tags };
    await autofill(tmp);
    product.description = tmp.description;
  }
  if (req.body.slug && slugify(req.body.slug) !== product.slug) {
    product.slug = await uniqueSlug(req.body.slug, product._id);
  }
  await product.save();
  res.json(product);
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Product deleted' });
});

module.exports = router;
