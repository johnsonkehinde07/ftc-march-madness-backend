const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const generateQRCode = require('../utils/qrGenerator');
const sendTicketEmail = require('../utils/emailService');

// Paystack webhook endpoint
router.post('/paystack-webhook', async (req, res) => {
  try {
    const event = req.body;
    
    console.log('========== WEBHOOK RECEIVED ==========');
    console.log('Event:', event.event);
    console.log('Full webhook payload:', JSON.stringify(event, null, 2));
    
    // Only process successful charges
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const metadata = event.data.metadata || {};
      
      console.log(`🔍 Processing successful charge. Reference: ${reference}`);
      console.log('Metadata:', metadata);
      
      // Try to find ticket by reference first
      let ticket = await Ticket.findOne({ paymentReference: reference });
      
      // If not found, try by ticketId from metadata
      if (!ticket && metadata.ticketId) {
        console.log(`🔍 Ticket not found by reference. Trying ticketId: ${metadata.ticketId}`);
        ticket = await Ticket.findOne({ ticketId: metadata.ticketId });
      }
      
      if (!ticket) {
        console.log('❌ TICKET NOT FOUND IN DATABASE');
        return res.sendStatus(200);
      }
      
      console.log(`✅ TICKET FOUND: ${ticket.ticketId} for ${ticket.email}`);
      
      // Check if ticket already processed
      if (ticket.paymentStatus === 'paid') {
        console.log('⚠️ Ticket already marked as paid. Skipping...');
        return res.sendStatus(200);
      }
      
      // Generate QR code
      console.log('🔄 Generating QR code...');
      const qrResult = await generateQRCode(ticket);
      console.log('✅ QR code generated');
      
      // Update ticket
      ticket.paymentStatus = 'paid';
      ticket.paidAt = new Date();
      ticket.paymentReference = reference;
      ticket.qrCode = qrResult.qrCode;
      ticket.qrCodeData = qrResult.qrData;
      await ticket.save();
      console.log(`✅ Ticket updated in database`);
      
      // Send email with QR code
      console.log(`📧 Sending email to ${ticket.email}...`);
      const emailSent = await sendTicketEmail(ticket, qrResult.qrCode);
      
      if (emailSent) {
        console.log(`✅ EMAIL SENT SUCCESSFULLY to ${ticket.email}`);
      } else {
        console.log(`❌ EMAIL FAILED to send to ${ticket.email}`);
      }
      
      // Update event count
      const event = await Event.getEvent();
      event.firstBatch.sold += 1;
      await event.save();
      console.log(`✅ Event count updated: ${event.firstBatch.sold}/${event.firstBatch.limit}`);
      
      console.log(`========== WEBHOOK PROCESSING COMPLETE ==========`);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ WEBHOOK ERROR:', error);
    res.sendStatus(500);
  }
});

module.exports = router;