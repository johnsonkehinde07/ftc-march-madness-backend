const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const generateQRCode = require('../utils/qrGenerator');
const sendTicketEmail = require('../utils/emailService');

// Paystack webhook
router.post('/paystack-webhook', async (req, res) => {
  try {
    const event = req.body;
    
    console.log('📩 Webhook received:', event.event);
    
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const metadata = event.data.metadata;
      
      // Find ticket by payment reference
      const ticket = await Ticket.findOne({ paymentReference: reference });
      
      if (ticket) {
        console.log(`🎫 Ticket found: ${ticket.ticketId}`);
        
        // Generate QR code
        const qrResult = await generateQRCode(ticket);
        console.log('✅ QR Code generated');
        
        // Update ticket
        ticket.paymentStatus = 'paid';
        ticket.paidAt = new Date();
        ticket.qrCode = qrResult.qrCode;
        ticket.qrCodeData = qrResult.qrData;
        await ticket.save();
        console.log(`✅ Ticket updated in database`);
        
        // Send email with QR code
        const emailSent = await sendTicketEmail(ticket, qrResult.qrCode);
        if (emailSent) {
          console.log(`✅ Email sent to ${ticket.email}`);
        } else {
          console.log(`❌ Email failed but ticket is saved`);
        }
        
        // Update event count
        const eventDoc = await Event.getEvent();
        eventDoc.firstBatch.sold += 1;
        await eventDoc.save();
        
        console.log(`✅ Ticket ${ticket.ticketId} completed`);
      } else {
        console.log(`❌ No ticket found for reference: ${reference}`);
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook Error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;