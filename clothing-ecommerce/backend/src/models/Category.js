const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // e.g. Bodyfit Tops → Tops
    description: { type: String, default: '' },
    // Filters for products in this category, e.g. [{ name: 'Sleeve', options: ['Spaghetti', 'Sleeveless'] }]
    // Set on a main category; its sub-categories inherit them.
    attributes: {
      type: [{ name: { type: String, trim: true }, options: [{ type: String, trim: true }], _id: false }],
      default: [],
    },
    image: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Returns the ids of a category and all of its sub-categories (2 levels is plenty for clothing)
categorySchema.statics.withDescendants = async function (rootIds) {
  const ids = rootIds.map(String);
  let frontier = ids;
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    // eslint-disable-next-line no-await-in-loop
    const kids = await this.find({ parent: { $in: frontier } }).select('_id').lean();
    frontier = kids.map((k) => String(k._id)).filter((id) => !ids.includes(id));
    ids.push(...frontier);
  }
  return ids;
};

module.exports = mongoose.model('Category', categorySchema);
