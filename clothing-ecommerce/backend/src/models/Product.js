const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true }, // e.g. S, M, L, XL, Free Size
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const colorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    hex: { type: String, default: '#000000' },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sku: { type: String, trim: true },
    description: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    images: [{ type: String }],

    // Retail pricing
    price: { type: Number, required: true, min: 0 }, // selling price
    mrp: { type: Number, min: 0 }, // shown struck-through when higher than price

    // Wholesale pricing (only visible to approved wholesale buyers)
    wholesalePrice: { type: Number, min: 0 },
    moq: { type: Number, default: 1, min: 1 }, // minimum order quantity (pieces) for wholesale

    sizes: { type: [sizeSchema], default: [{ label: 'Free Size', stock: 0 }] },
    colors: { type: [colorSchema], default: [] },

    // Category-specific details, e.g. { Fit: 'Bodyfit', Sleeve: 'Spaghetti', Length: 'Gown' }
    attributes: { type: Map, of: String, default: {} },
    fabric: { type: String, default: '' },
    care: { type: String, default: '' },
    tags: [{ type: String, trim: true, lowercase: true }],

    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    sold: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    stockTotal: { type: Number, default: 0 }, // sum of all sizes, kept in sync on save (inventory filters) // % off MRP, kept in sync on save (used for the Sale filter)
  },
  { timestamps: true, optimisticConcurrency: true }
);

productSchema.pre('save', function () {
  this.stockTotal = (this.sizes || []).reduce((n, x) => n + (x.stock || 0), 0);
  this.discount = this.mrp && this.mrp > this.price ? Math.round(((this.mrp - this.price) / this.mrp) * 100) : 0;
});

productSchema.virtual('totalStock').get(function () {
  return (this.sizes || []).reduce((sum, s) => sum + (s.stock || 0), 0);
});

productSchema.set('toJSON', { virtuals: true });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Product', productSchema);
