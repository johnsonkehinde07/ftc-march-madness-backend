const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  ticketId: String,
  paymentStatus: {
    type: String,
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Ticket', ticketSchema);