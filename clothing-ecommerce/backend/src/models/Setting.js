const mongoose = require('mongoose');

// A single document holding store-wide settings, editable from the admin panel.
const slideSchema = new mongoose.Schema(
  {
    eyebrow: String,
    title: String,
    subtitle: String,
    image: String,
    ctaLabel: { type: String, default: 'Shop now' },
    ctaLink: { type: String, default: '/shop' },
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: 'VASTRA' },
    tagline: { type: String, default: 'Clothing crafted for every day and every occasion' },
    logo: { type: String, default: '' },
    announcement: { type: String, default: 'Free shipping on retail orders above ₹1,999 · Wholesale enquiries welcome' },
    heroSlides: { type: [slideSchema], default: [] },

    whatsappNumber: { type: String, default: '919999999999' }, // with country code, digits only
    phone: { type: String, default: '+91 99999 99999' },
    email: { type: String, default: 'hello@store.com' },
    address: { type: String, default: 'Shop No. 1, Main Market, Your City' },
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' },

    currency: { type: String, default: 'INR' },
    shippingFee: { type: Number, default: 99 },
    freeShippingAbove: { type: Number, default: 1999 },
    wholesaleShippingNote: {
      type: String,
      default: 'Shipping for wholesale orders is calculated on weight and confirmed on WhatsApp.',
    },
    codEnabled: { type: Boolean, default: true },
    whatsappOrderEnabled: { type: Boolean, default: true },
    wholesaleMinOrderValue: { type: Number, default: 0 },

    // Policies (also used by the chatbot)
    returnPolicy: {
      type: String,
      default: 'Easy 7-day exchange on retail orders for unused items with tags. Wholesale orders are non-returnable except for manufacturing defects.',
    },
    deliveryTime: { type: String, default: '3–7 working days across India' },

    // Chatbot
    chatbotEnabled: { type: Boolean, default: true },
    chatbotName: { type: String, default: 'Style Assistant' },
    chatbotWelcome: {
      type: String,
      default: 'Hi! 👋 I can help you find outfits, check sizes, track your order or explain wholesale pricing. What are you looking for?',
    },
    whatsappBotEnabled: { type: Boolean, default: true },
    notifyOwnerOnOrder: { type: Boolean, default: true },
    notifyCustomerOnStatus: { type: Boolean, default: true },
  },
  { timestamps: true }
);

settingSchema.statics.get = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('Setting', settingSchema);
