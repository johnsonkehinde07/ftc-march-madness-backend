const mongoose = require('mongoose');

// Function to generate random short code
const generateShortCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0,1,I,O)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

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
  // NEW: Short code for easy manual entry at door
  shortCode: {
    type: String,
    unique: true,
    sparse: true,
    default: function() {
      return generateShortCode();
    }
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
  // Track which ticket type was purchased
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
  // Removed unique constraint to allow multiple tickets with same payment reference
  paymentReference: {
    type: String,
    index: true,  // Index for performance, but allows duplicates
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
ticketSchema.index({ ticketId: 1 }, { unique: true });
ticketSchema.index({ shortCode: 1 }, { unique: true, sparse: true });
ticketSchema.index({ paymentReference: 1 }); // Index but not unique
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
  
  // Generate short code if not exists and ensure uniqueness
  if (!this.shortCode) {
    let isUnique = false;
    let attempts = 0;
    let newCode;
    
    while (!isUnique && attempts < 10) {
      newCode = generateShortCode();
      const existing = await mongoose.model('Ticket').findOne({ shortCode: newCode });
      if (!existing) {
        isUnique = true;
        this.shortCode = newCode;
      }
      attempts++;
    }
    
    // Fallback if all attempts fail (very unlikely)
    if (!isUnique) {
      this.shortCode = 'CODE' + Date.now().toString().slice(-3);
    }
  }
  
  next();
});

// Virtual for formatted price
ticketSchema.virtual('formattedPrice').get(function() {
  return `₦${this.price.toLocaleString()}`;
});

// Virtual for short display (last 6 chars of ticket ID if no short code)
ticketSchema.virtual('displayCode').get(function() {
  return this.shortCode || this.ticketId.slice(-6);
});

module.exports = mongoose.model('Ticket', ticketSchema);