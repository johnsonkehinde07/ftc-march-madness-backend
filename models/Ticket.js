const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  phone: String,
  ticketId: {
    type: String,
    unique: true,
    required: true
  },
  // For bulk purchases - same for all tickets in one order
  bulkOrderId: {
    type: String,
    index: true
  },
  // How many tickets in this purchase (total)
  quantity: {
    type: Number,
    default: 1
  },
  // Track which ticket type was purchased - FIXED with RUNNER UP
  ticketType: {
    type: String,
    required: true,
    enum: ['FAST FAST', 'WINNERS FC', 'RUNNER UP', 'REGULAR', 'VIP', 'EARLY BIRD']
  },
  price: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentReference: {
    type: String,
    unique: true,
    sparse: true
  },
  paidAt: Date,
  qrCode: String,
  qrCodeData: String,
  scanned: {
    type: Boolean,
    default: false
  },
  scannedAt: Date,
  scannedBy: String,
  metadata: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for performance
ticketSchema.index({ email: 1, paymentStatus: 1 });
ticketSchema.index({ ticketId: 1 });
ticketSchema.index({ paymentReference: 1 });
ticketSchema.index({ ticketType: 1 });
ticketSchema.index({ bulkOrderId: 1 });

// Generate unique ticket ID before saving
ticketSchema.pre('save', async function(next) {
  if (!this.ticketId) {
    const count = await mongoose.model('Ticket').countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.ticketId = `FTC${year}${month}${random}`;
  }
  next();
});

// Virtual for formatted price
ticketSchema.virtual('formattedPrice').get(function() {
  return `₦${this.price.toLocaleString()}`;
});

module.exports = mongoose.model('Ticket', ticketSchema);