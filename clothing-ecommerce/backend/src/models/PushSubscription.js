const mongoose = require('mongoose');

// One row per phone/browser where the seller turned on order notifications
const pushSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: String, auth: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    device: String,
    lastUsedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', pushSchema);
