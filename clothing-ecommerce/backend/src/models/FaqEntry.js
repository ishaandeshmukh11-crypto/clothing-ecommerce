const mongoose = require('mongoose');

// Knowledge base the chatbot is "trained" on. Editable from Admin → Chatbot.
const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    keywords: [{ type: String, trim: true, lowercase: true }],
    isActive: { type: Boolean, default: true },
    hits: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FaqEntry', faqSchema);
