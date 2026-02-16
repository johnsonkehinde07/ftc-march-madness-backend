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
    default: 'Beach House'
  },
  firstBatch: {
    price: {
      type: Number,
      default: 8000
    },
    limit: {
      type: Number,
      default: 30
    },
    sold: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    default: 'active'
  }
});

// THIS IS THE IMPORTANT PART - make sure it's here
eventSchema.statics.getEvent = async function() {
  let event = await this.findOne();
  if (!event) {
    event = await this.create({});
  }
  return event;
};

module.exports = mongoose.model('Event', eventSchema);