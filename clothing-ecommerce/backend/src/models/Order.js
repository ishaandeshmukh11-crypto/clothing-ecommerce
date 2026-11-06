const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    slug: String,
    image: String,
    size: String,
    color: String,
    qty: { type: Number, min: 1 },
    price: Number, // unit price charged
  },
  { _id: false }
);

const ORDER_STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    accessKey: { type: String, select: false }, // lets a guest view their own order
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerType: { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
    source: { type: String, enum: ['website', 'whatsapp', 'instagram', 'admin'], default: 'website' }, // where the order came from
    items: [orderItemSchema],

    customer: {
      name: String,
      email: String,
      phone: String,
      businessName: String,
      gstin: String,
    },
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
    },
    notes: String,

    subtotal: Number,
    discount: { type: Number, default: 0 },
    couponCode: String,
    shipping: { type: Number, default: 0 },
    total: Number,

    paymentMethod: { type: String, enum: ['cod', 'razorpay', 'whatsapp'], default: 'cod' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    paymentLinkUrl: String, // Razorpay payment link (WhatsApp orders)
    razorpayPaymentLinkId: String,

    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    trackingNumber: String,
    courier: String,
    statusHistory: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

orderSchema.statics.STATUSES = ORDER_STATUSES;

module.exports = mongoose.model('Order', orderSchema);
