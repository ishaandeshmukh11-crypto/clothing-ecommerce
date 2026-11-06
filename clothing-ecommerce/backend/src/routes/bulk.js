/**
 * Bulk catalogue tools (admin):
 *   POST  /api/products/bulk        create / update many products at once (from a sheet or a photo batch)
 *   GET   /api/products/export      download the whole inventory as CSV (edit stock in Excel, re-upload)
 *   PATCH /api/products/:id/stock   quick stock change from the mobile inventory screen
 */
const router = require('express').Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const { protect, adminOnly } = require('../middleware/auth');
const { slugify, httpError } = require('../utils/helpers');
const { describeProduct, autoTags, aiDescription, singular } = require('../utils/describe');

// Guard each route (not router.use) — this router shares the /api/products prefix with public routes
const admin = [protect, adminOnly];

const num = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};
const yes = (v) => (v === undefined || v === '' ? undefined : /^(1|y|yes|true|on)$/i.test(String(v).trim()));

/** "S:10, M:12, L" or "S,M,L" (+ default stock) → [{label, stock}] */
function parseSizes(value, defaultStock = 0) {
  if (Array.isArray(value)) return value;
  if (!value) return null;
  return String(value)
    .split(/[,|/;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [label, stock] = part.split(/[:=]/).map((x) => x.trim());
      return { label: label.toUpperCase() === 'FREE' ? 'Free Size' : label, stock: num(stock) ?? defaultStock };
    });
}

/** "Black, Red:#ff0000" → [{name, hex}] */
function parseColors(value) {
  if (Array.isArray(value)) return value;
  if (!value) return null;
  return String(value)
    .split(/[,|;]+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [name, hex] = c.split(':').map((x) => x.trim());
      return { name, hex: /^#[0-9a-f]{3,8}$/i.test(hex || '') ? hex : '#cccccc' };
    });
}

async function uniqueSlug(base) {
  const root = slugify(base) || 'product';
  let slug = root;
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Product.exists({ slug })) slug = `${root}-${++i}`;
  return slug;
}

/** Finds (or creates) "Tops" → "Bodyfit Tops" and caches the result for the request */
function categoryResolver(createMissing) {
  const cache = new Map();
  const findOrCreate = async (name, parent) => {
    const key = `${parent || ''}|${name.toLowerCase()}`;
    if (cache.has(key)) return cache.get(key);
    const rx = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    let cat = await Category.findOne({ $or: [{ name: rx }, { slug: slugify(name) }], ...(parent ? { parent } : {}) });
    if (!cat && createMissing) {
      let slug = slugify(name);
      if (await Category.exists({ slug })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      cat = await Category.create({ name, slug, parent: parent || null });
    }
    cache.set(key, cat || null);
    return cat || null;
  };
  return async (main, sub) => {
    if (!main && !sub) return { category: null, path: [] };
    if (main) {
      const parent = await findOrCreate(String(main).trim());
      if (!parent) throw new Error(`Category "${main}" not found`);
      if (!sub) return { category: parent, path: [parent.name] };
      const child = await findOrCreate(String(sub).trim(), parent._id);
      if (!child) throw new Error(`Sub-category "${sub}" not found under ${parent.name}`);
      return { category: child, path: [parent.name, child.name] };
    }
    // only a sub-category given: look it up anywhere
    const child = await Category.findOne({ name: new RegExp(`^${String(sub).trim()}$`, 'i') });
    if (!child) throw new Error(`Category "${sub}" not found`);
    const parent = child.parent ? await Category.findById(child.parent) : null;
    return { category: child, path: [parent?.name, child.name].filter(Boolean) };
  };
}

// POST /api/products/bulk  { rows: [...], options: { createMissingCategories, updateExisting, aiDescriptions } }
router.post('/bulk', admin, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const options = { createMissingCategories: true, updateExisting: true, aiDescriptions: false, ...(req.body?.options || {}) };
  if (!rows.length) throw httpError(400, 'No rows received');
  if (rows.length > 500) throw httpError(400, 'Please send at most 500 rows per request');

  const resolve = categoryResolver(options.createMissingCategories);
  const results = [];

  for (const [index, r] of rows.entries()) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { category, path } = await resolve(r.category, r.subcategory);
      const sku = r.sku ? String(r.sku).trim() : '';
      // eslint-disable-next-line no-await-in-loop
      const existing = sku ? await Product.findOne({ sku }) : null;
      if (existing && !options.updateExisting) {
        results.push({ row: index + 1, status: 'skipped', message: `SKU ${sku} already exists`, name: existing.name });
        continue;
      }

      const attributes = Object.fromEntries(
        Object.entries(r.attributes || {}).map(([k, v]) => [String(k).trim(), String(v ?? '').trim()]).filter(([k, v]) => k && v)
      );
      const colors = parseColors(r.colors);
      const sizes = parseSizes(r.sizes, num(r.stock) ?? 0);

      if (existing) {
        // Update only what the sheet provides — great for bulk stock / price updates
        if (r.name) existing.name = String(r.name).trim();
        if (category) existing.category = category._id;
        for (const k of ['price', 'mrp', 'wholesalePrice', 'moq']) if (num(r[k]) !== undefined) existing[k] = num(r[k]);
        if (sizes) existing.sizes = sizes;
        else if (num(r.stock) !== undefined && existing.sizes.length === 1) existing.sizes[0].stock = num(r.stock);
        if (colors) existing.colors = colors;
        if (r.fabric) existing.fabric = r.fabric;
        if (Object.keys(attributes).length) existing.attributes = { ...Object.fromEntries(existing.attributes || []), ...attributes };
        if (r.description) existing.description = r.description;
        if (r.tags) existing.tags = String(r.tags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (Array.isArray(r.images) && r.images.length) existing.images = r.images;
        if (yes(r.featured) !== undefined) existing.isFeatured = yes(r.featured);
        if (yes(r.active) !== undefined) existing.isActive = yes(r.active);
        // eslint-disable-next-line no-await-in-loop
        await existing.save();
        results.push({ row: index + 1, status: 'updated', id: existing._id, name: existing.name });
        continue;
      }

      const price = num(r.price);
      if (price === undefined) throw new Error('Price is missing');
      const colourName = colors?.[0]?.name;
      const leaf = path[path.length - 1];
      const name = String(r.name || '').trim() || [colourName, leaf ? singular(leaf) : 'Product'].filter(Boolean).join(' ');

      const meta = { name, categoryPath: path, attributes, fabric: r.fabric, colors: colors || [] };
      let description = r.description ? String(r.description) : '';
      // eslint-disable-next-line no-await-in-loop
      if (!description && options.aiDescriptions) description = (await aiDescription(meta)) || '';
      if (!description) description = describeProduct(meta);

      const tags = r.tags ? String(r.tags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : autoTags(meta);

      // eslint-disable-next-line no-await-in-loop
      const product = await Product.create({
        name,
        // eslint-disable-next-line no-await-in-loop
        slug: await uniqueSlug(name),
        sku: sku || undefined,
        description,
        category: category?._id,
        images: Array.isArray(r.images) ? r.images.filter(Boolean) : [],
        price,
        mrp: num(r.mrp),
        wholesalePrice: num(r.wholesalePrice),
        moq: num(r.moq) || 1,
        sizes: sizes?.length ? sizes : [{ label: 'Free Size', stock: num(r.stock) ?? 0 }],
        colors: colors || [],
        attributes,
        fabric: r.fabric || '',
        care: r.care || 'Gentle hand wash or machine wash cold. Dry in shade.',
        tags,
        isFeatured: !!yes(r.featured),
        isNewArrival: yes(r.newArrival) ?? true,
        isActive: yes(r.active) ?? true,
      });
      if (!product.sku) {
        product.sku = `SKU-${String(product._id).slice(-6).toUpperCase()}`;
        // eslint-disable-next-line no-await-in-loop
        await product.save();
      }
      results.push({ row: index + 1, status: 'created', id: product._id, name: product.name, sku: product.sku });
    } catch (err) {
      results.push({ row: index + 1, status: 'error', message: err.message, name: r.name || r.sku || '' });
    }
  }

  const count = (s) => results.filter((r) => r.status === s).length;
  res.json({ created: count('created'), updated: count('updated'), skipped: count('skipped'), errors: count('error'), results });
});

// GET /api/products/export — inventory as CSV (same columns as the import template)
router.get('/export', admin, async (_req, res) => {
  const products = await Product.find().populate({ path: 'category', select: 'name parent', populate: { path: 'parent', select: 'name' } }).sort({ createdAt: -1 });
  const attrNames = [...new Set(products.flatMap((p) => [...(p.attributes?.keys?.() || [])]))];
  const header = ['sku', 'name', 'category', 'subcategory', 'price', 'mrp', 'wholesalePrice', 'moq', 'sizes', 'colors', 'fabric', ...attrNames, 'featured', 'active', 'images', 'description'];
  const esc = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const p of products) {
    const cat = p.category;
    const main = cat?.parent ? cat.parent.name : cat?.name;
    const sub = cat?.parent ? cat.name : '';
    lines.push(
      [
        p.sku, p.name, main, sub, p.price, p.mrp, p.wholesalePrice, p.moq,
        p.sizes.map((s) => `${s.label}:${s.stock}`).join(', '),
        p.colors.map((c) => `${c.name}:${c.hex}`).join(', '),
        p.fabric,
        ...attrNames.map((a) => p.attributes?.get?.(a) || ''),
        p.isFeatured ? 'yes' : 'no', p.isActive ? 'yes' : 'no',
        p.images.join(' | '), p.description,
      ].map(esc).join(',')
    );
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="inventory-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${lines.join('\n')}`);
});

// PATCH /api/products/:id/stock  { size, delta } or { size, stock } or { sizes: [...] } or { isActive }
router.patch('/:id/stock', admin, async (req, res) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const p = await Product.findById(req.params.id);
    if (!p) throw httpError(404, 'Product not found');
    const { size, delta, stock, sizes, isActive, price } = req.body || {};
    if (Array.isArray(sizes)) p.sizes = sizes.map((s) => ({ label: s.label, stock: Math.max(0, Number(s.stock) || 0) }));
    if (size) {
      let entry = p.sizes.find((s) => s.label === size);
      if (!entry) {
        p.sizes.push({ label: size, stock: 0 });
        entry = p.sizes[p.sizes.length - 1];
      }
      if (delta !== undefined) entry.stock = Math.max(0, entry.stock + Number(delta));
      if (stock !== undefined) entry.stock = Math.max(0, Number(stock) || 0);
    }
    if (typeof isActive === 'boolean') p.isActive = isActive;
    if (price !== undefined && Number(price) > 0) p.price = Number(price);
    try {
      // eslint-disable-next-line no-await-in-loop
      await p.save();
      return res.json({ _id: p._id, sizes: p.sizes, totalStock: p.totalStock, isActive: p.isActive, price: p.price });
    } catch (err) {
      if (err.name !== 'VersionError') throw err;
    }
  }
  throw httpError(409, 'Stock was changing too fast — please try again');
});

module.exports = router;
