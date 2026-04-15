const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  selectedVariants: [{
    name: String,
    value: String
  }],
  price: {
    type: Number,
    required: true
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  appliedCoupons: [{
    code: String,
    discount: Number,
    type: {
      type: String,
      enum: ['percentage', 'fixed']
    }
  }],
  expiresAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 7 // 7 days
  }
}, {
  timestamps: true
});

cartSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  
  // Apply coupons
  let discount = 0;
  this.appliedCoupons.forEach(coupon => {
    if (coupon.type === 'percentage') {
      discount += this.subtotal * (coupon.discount / 100);
    } else {
      discount += coupon.discount;
    }
  });
  
  const subtotalAfterDiscount = Math.max(0, this.subtotal - discount);
  this.tax = subtotalAfterDiscount * 0.1; // 10% tax
  this.total = subtotalAfterDiscount + this.tax + this.shipping;
};

cartSchema.pre('save', function() {
  this.calculateTotals();
});

module.exports = mongoose.model('Cart', cartSchema);