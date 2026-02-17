const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const generateQRCode = require('../utils/qrGenerator');
const sendTicketEmail = require('../utils/emailService');

// Paystack webhook endpoint
router.post('/paystack-webhook', async (req, res) => {
  try {
    const webhookEvent = req.body;
    
    console.log('========== WEBHOOK RECEIVED ==========');
    console.log('Event:', webhookEvent.event);
    
    if (webhookEvent.event === 'charge.success') {
      const reference = webhookEvent.data.reference;
      const metadata = webhookEvent.data.metadata || {};
      
      console.log(`🔍 Webhook processing reference: ${reference}`);
      
      // Find ticket by reference
      const ticket = await Ticket.findOne({ paymentReference: reference });
      
      if (!ticket) {
        console.log(`❌ No ticket found for reference: ${reference}`);
        return res.sendStatus(200);
      }
      
      console.log(`✅ Ticket found: ${ticket.ticketId}`);
      
      // Check if already processed
      if (ticket.paymentStatus === 'paid') {
        console.log('⚠️ Ticket already paid');
        return res.sendStatus(200);
      }
      
      // Generate QR code
      const qrResult = await generateQRCode(ticket);
      
      // Update ticket
      ticket.paymentStatus = 'paid';
      ticket.paidAt = new Date();
      ticket.qrCode = qrResult.qrCode;
      ticket.qrCodeData = qrResult.qrData;
      await ticket.save();
      
      // Send email
      await sendTicketEmail(ticket, qrResult.qrCode);
      
      // Update event count
      const event = await Event.getEvent();
      event.firstBatch.sold += 1;
      await event.save();
      
      console.log(`✅ Ticket ${ticket.ticketId} completed via webhook`);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;