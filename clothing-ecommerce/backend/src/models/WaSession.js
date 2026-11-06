const mongoose = require('mongoose');

// Shopping state for one WhatsApp customer (cart, what we're waiting for, saved address)
const waSessionSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    name: String,
    state: { type: String, default: 'idle' }, // idle | await_qty | await_address | await_payment
    pending: { productId: String, size: String },
    cart: [{ productId: String, size: String, qty: Number, _id: false }],
    address: { name: String, line1: String, city: String, state: String, pincode: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WaSession', waSessionSchema);
