/**
 * Seeds the database with an admin account, store settings, categories, demo products,
 * a welcome coupon and the chatbot knowledge base.
 *   npm run seed            → adds anything missing (safe to run again)
 *   npm run seed -- --fresh → wipes catalogue, orders & FAQs first, then seeds
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Setting = require('./models/Setting');
const Coupon = require('./models/Coupon');
const FaqEntry = require('./models/FaqEntry');
const Order = require('./models/Order');
const { slugify } = require('./utils/helpers');
const { describeProduct, autoTags } = require('./utils/describe');

const SEED_DIR = path.join(__dirname, '..', 'uploads', 'seed');

// Elegant placeholder artwork so the store looks finished before real photos are uploaded.
const esc = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function placeholder(file, { title, sub, bg, fg, accent, w = 900, h = 1200, shape = 'kurta' }) {
  const shapes = {
    kurta: 'M330 300 L400 260 Q450 300 500 260 L570 300 L660 420 L610 460 L570 410 L580 900 L320 900 L330 410 L290 460 L240 420 Z',
    shirt: 'M320 300 L400 265 L450 320 L500 265 L580 300 L680 430 L620 470 L580 420 L585 820 L315 820 L320 420 L280 470 L220 430 Z',
    saree: 'M330 280 Q450 240 570 280 L620 900 L280 900 Z M470 280 Q640 420 600 900',
    dress: 'M380 280 L450 300 L520 280 L540 420 L650 900 L250 900 L360 420 Z',
    set: 'M330 280 L450 250 L570 280 L620 560 L280 560 Z M320 600 L580 600 L600 920 L470 920 L450 700 L430 920 L300 920 Z',
    top: 'M330 330 L400 300 Q450 330 500 300 L570 330 L640 420 L600 450 L570 420 L575 700 L325 700 L330 420 L300 450 L260 420 Z',
    crop: 'M330 360 L400 330 Q450 360 500 330 L570 360 L640 450 L600 480 L570 450 L575 600 L325 600 L330 450 L300 480 L260 450 Z',
    pants: 'M340 280 L560 280 L590 920 L480 920 L450 420 L420 920 L310 920 Z',
    wide: 'M340 280 L560 280 L640 920 L470 920 L450 440 L430 920 L260 920 Z',
    skirt: 'M360 320 L540 320 L640 820 L260 820 Z',
    shorts: 'M330 340 L570 340 L600 640 L470 640 L450 480 L430 640 L300 640 Z',
    gown: 'M395 270 L450 290 L505 270 L525 430 L720 950 L180 950 L375 430 Z',
    slip: 'M400 280 L420 280 L450 300 L480 280 L500 280 L520 420 L600 860 L300 860 L380 420 Z',
    kids: 'M360 380 L420 350 Q450 380 480 350 L540 380 L600 470 L560 500 L535 470 L540 780 L360 780 L365 470 L340 500 L300 470 Z',
  };
  const sx = w / 900;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${accent}" stop-opacity="0.55"/></linearGradient>
    <pattern id="p" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="18" cy="18" r="1.4" fill="${fg}" opacity="0.12"/></pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#p)"/>
  <g transform="translate(${(w - 900 * sx) / 2} ${h * 0.04}) scale(${sx})">
    <path d="${shapes[shape]}" fill="${fg}" opacity="0.14"/>
    <path d="${shapes[shape]}" fill="none" stroke="${fg}" stroke-width="3" opacity="0.5"/>
    <path d="M450 210 q0 -30 22 -30 q22 0 22 22 M450 230 L330 290 M450 230 L570 290" stroke="${fg}" stroke-width="5" fill="none" opacity="0.45"/>
  </g>
  <text x="50%" y="${h - 150}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(54 * Math.min(1.4, sx))}" fill="${fg}">${esc(title)}</text>
  <text x="50%" y="${h - 95}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" letter-spacing="6" font-size="${Math.round(20 * Math.min(1.4, sx))}" fill="${fg}" opacity="0.7">${esc(sub.toUpperCase())}</text>
</svg>`;
  fs.writeFileSync(path.join(SEED_DIR, file), svg);
  return `/uploads/seed/${file}`;
}

const PALETTES = [
  { bg: '#ebe7df', fg: '#2b2925', accent: '#d8d1c3' },
  { bg: '#e6e3dc', fg: '#3a3f37', accent: '#cfd3c8' },
  { bg: '#ece6df', fg: '#4a2f2a', accent: '#dccbbf' },
  { bg: '#e4e4e1', fg: '#262b33', accent: '#cdd0d6' },
  { bg: '#eee8dc', fg: '#4a3c24', accent: '#ddd0b4' },
  { bg: '#e8e4e6', fg: '#3b3040', accent: '#d4cbd6' },
];

// Main categories → types (sub-categories) + filters (attributes). All editable in Admin → Categories.
const SLEEVES = ['Spaghetti', 'Sleeveless', 'Half sleeves', 'Full sleeves'];
const CATEGORIES = [
  { name: 'Tops', description: 'Bodyfit, comfort fit, crop and plus-size tops', shape: 'top',
    attributes: [{ name: 'Sleeve', options: SLEEVES }, { name: 'Neck', options: ['Round', 'V-neck', 'Square', 'Off-shoulder', 'Collar'] }],
    children: [
      { name: 'Bodyfit Tops', shape: 'crop' }, { name: 'Comfort Fit Tops', shape: 'top' }, { name: 'Crop Tops', shape: 'crop' },
      { name: 'Plus Size Tops', shape: 'top' }, { name: 'Shirts & Blouses', shape: 'shirt' },
    ] },
  { name: 'Dresses', description: 'Short dresses, full-length dresses and gowns', shape: 'dress',
    attributes: [{ name: 'Sleeve', options: SLEEVES }, { name: 'Occasion', options: ['Casual', 'Party', 'Office', 'Wedding'] }],
    children: [
      { name: 'Short Dresses', shape: 'slip' }, { name: 'Midi Dresses', shape: 'dress' },
      { name: 'Full Length Dresses', shape: 'dress' }, { name: 'Gowns', shape: 'gown' },
    ] },
  { name: 'Pants', description: 'Korean, formal and casual pants', shape: 'pants',
    attributes: [{ name: 'Fit', options: ['Straight', 'Wide leg', 'Slim', 'Flared', 'Relaxed'] }, { name: 'Rise', options: ['High rise', 'Mid rise'] }],
    children: [
      { name: 'Korean Pants', shape: 'wide' }, { name: 'Formal Pants', shape: 'pants' },
      { name: 'Casual Pants', shape: 'pants' }, { name: 'Cargo & Joggers', shape: 'pants' },
    ] },
  { name: 'Denims', description: 'Skinny, straight, wide-leg and mom-fit jeans', shape: 'pants',
    attributes: [{ name: 'Wash', options: ['Light', 'Mid', 'Dark', 'Black'] }, { name: 'Rise', options: ['High rise', 'Mid rise'] }],
    children: [
      { name: 'Skinny Jeans', shape: 'pants' }, { name: 'Straight Jeans', shape: 'pants' },
      { name: 'Wide Leg Jeans', shape: 'wide' }, { name: 'Mom Fit Jeans', shape: 'pants' },
    ] },
  { name: 'Shorts', description: 'Denim, casual and biker shorts', shape: 'shorts',
    attributes: [{ name: 'Rise', options: ['High rise', 'Mid rise'] }],
    children: [{ name: 'Denim Shorts', shape: 'shorts' }, { name: 'Casual Shorts', shape: 'shorts' }, { name: 'Biker Shorts', shape: 'shorts' }] },
  { name: 'Skirts', description: 'Mini, midi and maxi skirts', shape: 'skirt',
    attributes: [{ name: 'Style', options: ['A-line', 'Pleated', 'Bodycon', 'Wrap', 'Flared'] }],
    children: [{ name: 'Mini Skirts', shape: 'skirt' }, { name: 'Midi Skirts', shape: 'skirt' }, { name: 'Maxi Skirts', shape: 'skirt' }] },
];

const SIZES = (n = 12) => ['XS', 'S', 'M', 'L', 'XL'].map((label) => ({ label, stock: n }));
const PLUS = ['XL', 'XXL', '3XL', '4XL'].map((label) => ({ label, stock: 10 }));
const WAIST = ['26', '28', '30', '32', '34'].map((label) => ({ label, stock: 10 }));

// cat = sub-category name
const PRODUCTS = [
  { name: 'Ribbed Square Neck Bodyfit Top', cat: 'Bodyfit Tops', price: 549, mrp: 899, wholesalePrice: 290, moq: 12, fabric: 'Cotton Lycra rib', colors: [['Black', '#111111']], attributes: { Sleeve: 'Sleeveless', Neck: 'Square' }, featured: true },
  { name: 'Off-Shoulder Bodyfit Top', cat: 'Bodyfit Tops', price: 599, mrp: 999, wholesalePrice: 320, moq: 12, fabric: 'Polyester spandex', colors: [['White', '#f5f5f5']], attributes: { Sleeve: 'Full sleeves', Neck: 'Off-shoulder' } },
  { name: 'Relaxed Cotton Comfort Tee', cat: 'Comfort Fit Tops', price: 449, mrp: 699, wholesalePrice: 230, moq: 12, fabric: 'Cotton', colors: [['Beige', '#d8c3a5']], attributes: { Sleeve: 'Half sleeves', Neck: 'Round' } },
  { name: 'Floral Plus Size Peplum Top', cat: 'Plus Size Tops', price: 799, mrp: 1199, wholesalePrice: 430, moq: 8, fabric: 'Rayon', colors: [['Blue', '#2b3a67']], attributes: { Sleeve: 'Half sleeves', Neck: 'V-neck' }, sizes: PLUS, featured: true },
  { name: 'Satin Button-Down Shirt', cat: 'Shirts & Blouses', price: 899, mrp: 1399, wholesalePrice: 480, moq: 8, fabric: 'Satin', colors: [['Champagne', '#e6d3b3']], attributes: { Sleeve: 'Full sleeves', Neck: 'Collar' } },
  { name: 'Spaghetti Strap Slip Dress', cat: 'Short Dresses', price: 999, mrp: 1599, wholesalePrice: 540, moq: 8, fabric: 'Satin', colors: [['Emerald', '#1f5c4a']], attributes: { Sleeve: 'Spaghetti', Occasion: 'Party' }, featured: true },
  { name: 'Puff Sleeve Short Dress', cat: 'Short Dresses', price: 899, mrp: 1399, wholesalePrice: 490, moq: 8, fabric: 'Cotton poplin', colors: [['Pink', '#e8a6b8']], attributes: { Sleeve: 'Half sleeves', Occasion: 'Casual' } },
  { name: 'Ruched Sleeveless Midi Dress', cat: 'Midi Dresses', price: 1199, mrp: 1899, wholesalePrice: 650, moq: 6, fabric: 'Jersey', colors: [['Black', '#111111']], attributes: { Sleeve: 'Sleeveless', Occasion: 'Party' } },
  { name: 'Tiered Full Length Maxi Dress', cat: 'Full Length Dresses', price: 1399, mrp: 2199, wholesalePrice: 760, moq: 6, fabric: 'Georgette', colors: [['Lilac', '#b7a2c9']], attributes: { Sleeve: 'Full sleeves', Occasion: 'Casual' }, featured: true },
  { name: 'Sequin Evening Gown', cat: 'Gowns', price: 3499, mrp: 5499, wholesalePrice: 2100, moq: 3, fabric: 'Net with sequins', colors: [['Silver', '#c0c0c0']], attributes: { Sleeve: 'Spaghetti', Occasion: 'Wedding' }, featured: true, sizes: ['S', 'M', 'L', 'XL'].map((label) => ({ label, stock: 5 })) },
  { name: 'Korean Wide Leg Trousers', cat: 'Korean Pants', price: 899, mrp: 1399, wholesalePrice: 480, moq: 10, fabric: 'Polyester blend', colors: [['Grey', '#8c8c8c']], attributes: { Fit: 'Wide leg', Rise: 'High rise' }, sizes: WAIST, featured: true },
  { name: 'Tailored Formal Straight Pants', cat: 'Formal Pants', price: 1099, mrp: 1699, wholesalePrice: 590, moq: 8, fabric: 'Poly viscose', colors: [['Black', '#111111']], attributes: { Fit: 'Straight', Rise: 'Mid rise' }, sizes: WAIST },
  { name: 'Linen Drawstring Casual Pants', cat: 'Casual Pants', price: 849, mrp: 1299, wholesalePrice: 450, moq: 10, fabric: 'Linen blend', colors: [['Sand', '#d8c3a5']], attributes: { Fit: 'Relaxed', Rise: 'High rise' } },
  { name: 'High Rise Wide Leg Jeans', cat: 'Wide Leg Jeans', price: 1299, mrp: 1999, wholesalePrice: 720, moq: 8, fabric: 'Denim', colors: [['Light blue', '#9db4d0']], attributes: { Wash: 'Light', Rise: 'High rise' }, sizes: WAIST, featured: true },
  { name: 'Classic Skinny Jeans', cat: 'Skinny Jeans', price: 1099, mrp: 1699, wholesalePrice: 600, moq: 8, fabric: 'Stretch denim', colors: [['Dark blue', '#25314f']], attributes: { Wash: 'Dark', Rise: 'Mid rise' }, sizes: WAIST },
  { name: 'Distressed Mom Fit Jeans', cat: 'Mom Fit Jeans', price: 1199, mrp: 1799, wholesalePrice: 660, moq: 8, fabric: 'Denim', colors: [['Mid blue', '#5c7aa3']], attributes: { Wash: 'Mid', Rise: 'High rise' }, sizes: WAIST },
  { name: 'Frayed Denim Shorts', cat: 'Denim Shorts', price: 699, mrp: 999, wholesalePrice: 360, moq: 12, fabric: 'Denim', colors: [['Light blue', '#9db4d0']], attributes: { Rise: 'High rise' }, sizes: WAIST },
  { name: 'Ribbed Biker Shorts', cat: 'Biker Shorts', price: 449, mrp: 699, wholesalePrice: 230, moq: 12, fabric: 'Cotton Lycra', colors: [['Black', '#111111']], attributes: { Rise: 'High rise' } },
  { name: 'Pleated Tennis Mini Skirt', cat: 'Mini Skirts', price: 699, mrp: 1099, wholesalePrice: 370, moq: 10, fabric: 'Polyester', colors: [['White', '#f5f5f5']], attributes: { Style: 'Pleated' }, featured: true },
  { name: 'Satin Midi Slip Skirt', cat: 'Midi Skirts', price: 899, mrp: 1399, wholesalePrice: 480, moq: 8, fabric: 'Satin', colors: [['Mocha', '#8a6a55']], attributes: { Style: 'A-line' } },
];

const FAQS = [
  { question: 'Do you offer wholesale prices?', keywords: ['wholesale price', 'bulk price', 'wholesale rate', 'bulk order'], answer: 'Yes! Register a free wholesale account on our Wholesale page. Once approved, you will see wholesale prices and minimum order quantities on every product.' },
  { question: 'What is the minimum order for wholesale?', keywords: ['minimum order', 'moq', 'minimum quantity'], answer: 'Each product has its own minimum order quantity (MOQ), usually 6–12 pieces in any mix of sizes. It is shown on the product page after you log in as a wholesale buyer.' },
  { question: 'Can I get a catalogue on WhatsApp?', keywords: ['catalogue', 'catalog', 'pdf', 'photos'], answer: 'Of course! Tap "Chat on WhatsApp" and tell us the category you want — we will send you the latest catalogue right away. You can also browse everything live on this website.' },
  { question: 'Do you do cash on delivery?', keywords: ['cod', 'cash on delivery'], answer: 'Yes, Cash on Delivery is available on retail orders across India. You can also pay online by UPI, card or net-banking.' },
  { question: 'Do you give a GST invoice?', keywords: ['gst invoice', 'bill', 'invoice', 'tax invoice'], answer: 'Yes, we provide a GST invoice with every order. Wholesale buyers can add their GSTIN at registration or checkout.' },
  { question: 'Are the colours the same as in the photos?', keywords: ['colour', 'color same', 'real photo', 'actual'], answer: 'We shoot our products in natural light so colours stay true. Slight variation (5–10%) can happen due to screen settings. Ask us on WhatsApp for a real video of any piece.' },
];

async function run() {
  await connectDB();
  fs.mkdirSync(SEED_DIR, { recursive: true });

  if (process.argv.includes('--fresh')) {
    await Promise.all([Product.deleteMany({}), Category.deleteMany({}), Order.deleteMany({}), FaqEntry.deleteMany({}), Coupon.deleteMany({})]);
    console.log('Cleared catalogue, orders, coupons and FAQs');
  }

  // Admin
  const email = (process.env.ADMIN_EMAIL || 'admin@store.com').toLowerCase();
  if (!(await User.findOne({ email }))) {
    await User.create({ name: process.env.ADMIN_NAME || 'Store Admin', email, password: process.env.ADMIN_PASSWORD || 'Admin@123', role: 'admin' });
    console.log(`Admin created: ${email}`);
  }

  // Settings + hero slides
  const settings = await Setting.get();
  if (!settings.heroSlides?.length) {
    settings.heroSlides = [
      { eyebrow: 'New Season', title: 'Dresses for every moment', subtitle: 'Spaghetti, sleeveless, short, full length and gowns — all in one place.', image: placeholder('hero-1.svg', { title: '', sub: '', w: 1600, h: 1000, shape: 'gown', ...PALETTES[0] }), ctaLabel: 'Shop dresses', ctaLink: '/shop?category=dresses' },
      { eyebrow: 'New Collection', title: 'Everyday essentials, elevated', subtitle: 'Tops, Korean pants and denims made for the way you live.', image: placeholder('hero-2.svg', { title: '', sub: '', w: 1600, h: 1000, shape: 'wide', ...PALETTES[1] }), ctaLabel: 'Shop now', ctaLink: '/shop?newArrival=1' },
    ];
    await settings.save();
  }

  // Categories (main groups + sub-categories)
  const catByName = {};
  let pi = 0;
  const upsertCat = async (c, sortOrder, parent = null) => {
    const slug = slugify(c.name);
    let cat = await Category.findOne({ slug });
    if (!cat) {
      cat = await Category.create({
        name: c.name, slug, description: c.description || '', sortOrder, parent, attributes: c.attributes || [],
        image: placeholder(`cat-${slug}.svg`, { title: '', sub: '', shape: c.shape, ...PALETTES[pi++ % PALETTES.length] }),
      });
    }
    catByName[c.name] = cat;
    return cat;
  };
  for (const [i, group] of CATEGORIES.entries()) {
    const parent = await upsertCat(group, i);
    for (const [j, child] of (group.children || []).entries()) await upsertCat({ ...child }, j, parent._id);
  }
  const shapeOf = Object.fromEntries(CATEGORIES.flatMap((g) => (g.children || []).map((c) => [c.name, c.shape])));
  const parentOf = Object.fromEntries(CATEGORIES.flatMap((g) => (g.children || []).map((c) => [c.name, g.name])));

  // Products
  let created = 0;
  for (const [i, p] of PRODUCTS.entries()) {
    const slug = slugify(p.name);
    if (await Product.exists({ slug })) continue;
    const shape = shapeOf[p.cat] || 'kurta';
    const pal = PALETTES[i % PALETTES.length];
    const pal2 = PALETTES[(i + 2) % PALETTES.length];
    const meta = { name: p.name, categoryPath: [parentOf[p.cat], p.cat], attributes: p.attributes, fabric: p.fabric, colors: p.colors.map(([name]) => ({ name })) };
    await Product.create({
      name: p.name,
      slug,
      sku: `SKU-${String(i + 1).padStart(4, '0')}`,
      description: describeProduct({ ...meta }),
      category: catByName[p.cat]._id,
      images: [
        placeholder(`${slug}-1.svg`, { title: '', sub: '', shape, ...pal }),
        placeholder(`${slug}-2.svg`, { title: '', sub: '', shape, ...pal2 }),
      ],
      price: p.price,
      mrp: p.mrp,
      wholesalePrice: p.wholesalePrice,
      moq: p.moq,
      sizes: p.sizes || SIZES(),
      colors: p.colors.map(([name, hex]) => ({ name, hex })),
      fabric: p.fabric,
      care: 'Gentle hand wash or dry clean. Do not bleach. Dry in shade.',
      attributes: p.attributes || {},
      tags: autoTags(meta),
      isFeatured: !!p.featured,
      isNewArrival: i % 2 === 0,
      sold: Math.floor(Math.random() * 60),
    });
    created++;
  }
  console.log(`Products added: ${created}`);

  if (!(await Coupon.exists({ code: 'WELCOME10' }))) {
    await Coupon.create({ code: 'WELCOME10', type: 'percent', value: 10, minOrder: 999, maxDiscount: 300, appliesTo: 'retail' });
    console.log('Coupon WELCOME10 created');
  }

  if (!(await FaqEntry.countDocuments())) {
    await FaqEntry.insertMany(FAQS);
    console.log('Chatbot knowledge base seeded');
  }

  console.log('Seed complete ✔');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
