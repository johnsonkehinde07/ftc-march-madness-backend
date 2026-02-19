const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'FTC MARCH MADNESS'
  },
  date: {
    type: Date,
    default: '2026-03-07'
  },
  location: {
    type: String,
    default: 'KODO BEACH HOUSE'
  },
  // Multiple ticket types array
  ticketTypes: [
    {
      name: { 
        type: String, 
        required: true,
        enum: ['FAST FAST', 'WINNERS FC', 'REGULAR', 'VIP', 'EARLY BIRD'] // Added WINNERS FC
      },
      price: { 
        type: Number, 
        required: true 
      },
      limit: { 
        type: Number, 
        required: true,
        default: 30
      },
      sold: { 
        type: Number, 
        default: 0 
      },
      description: { 
        type: String, 
        default: '' 
      },
      isActive: { 
        type: Boolean, 
        default: true 
      }
    }
  ],
  status: {
    type: String,
    enum: ['active', 'sold_out', 'cancelled', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Get or create event
eventSchema.statics.getEvent = async function() {
  let event = await this.findOne();
  if (!event) {
    // Create with default FAST FAST ticket
    event = await this.create({
      ticketTypes: [{
        name: 'FAST FAST',
        price: 7000,
        limit: 30,
        sold: 0,
        description: 'Early bird special',
        isActive: true
      }]
    });
    console.log('✅ Event created with FAST FAST ticket type');
  }
  return event;
};

// Helper method to get a specific ticket type
eventSchema.methods.getTicketType = function(typeName) {
  return this.ticketTypes.find(t => 
    t.name === typeName && t.isActive
  );
};

// Helper method to check availability
eventSchema.methods.checkAvailability = function(typeName) {
  const ticketType = this.getTicketType(typeName);
  return ticketType ? ticketType.sold < ticketType.limit : false;
};

// Helper method to increment sold count
eventSchema.methods.incrementSold = async function(typeName) {
  const ticketType = this.ticketTypes.find(t => t.name === typeName);
  if (ticketType) {
    ticketType.sold += 1;
    
    // Check if this specific type is sold out
    if (ticketType.sold >= ticketType.limit) {
      console.log(`📢 ${typeName} tickets are sold out!`);
    }
    
    // Check if all ticket types are sold out
    const allSoldOut = this.ticketTypes.every(t => 
      !t.isActive || t.sold >= t.limit
    );
    
    if (allSoldOut) {
      this.status = 'sold_out';
    }
    
    await this.save();
  }
  return this;
};

module.exports = mongoose.model('Event', eventSchema);