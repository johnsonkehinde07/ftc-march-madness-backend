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
    console.log('Full webhook data:', JSON.stringify(webhookEvent.data, null, 2));
    
    if (webhookEvent.event === 'charge.success') {
      const reference = webhookEvent.data.reference;
      const metadata = webhookEvent.data.metadata || {};
      const customerEmail = webhookEvent.data.customer?.email;
      
      console.log(`🔍 Webhook processing reference: ${reference}`);
      console.log('Customer email:', customerEmail);
      console.log('Metadata:', metadata);
      
      // Try multiple ways to find the ticket
      let ticket = null;
      
      // Method 1: Find by payment reference
      ticket = await Ticket.findOne({ paymentReference: reference });
      if (ticket) console.log('✅ Found by paymentReference');
      
      // Method 2: Find by ticketId from metadata
      if (!ticket && metadata.ticketId) {
        console.log(`🔍 Trying ticketId: ${metadata.ticketId}`);
        ticket = await Ticket.findOne({ ticketId: metadata.ticketId });
        if (ticket) {
          console.log('✅ Found by metadata.ticketId');
          // Update the ticket with the reference
          ticket.paymentReference = reference;
          await ticket.save();
        }
      }
      
      // Method 3: Find by email (most recent pending)
      if (!ticket && customerEmail) {
        console.log(`🔍 Looking for recent pending tickets with email: ${customerEmail}`);
        const recentTickets = await Ticket.find({ 
          email: customerEmail,
          paymentStatus: 'pending'
        }).sort({ createdAt: -1 }).limit(1);
        
        if (recentTickets.length > 0) {
          ticket = recentTickets[0];
          console.log(`✅ Found by email: ${ticket.ticketId}`);
          ticket.paymentReference = reference;
          await ticket.save();
        }
      }
      
      if (!ticket) {
        console.log(`❌ No ticket found for reference: ${reference}`);
        return res.sendStatus(200);
      }
      
      console.log(`✅ Ticket found: ${ticket.ticketId} (Status: ${ticket.paymentStatus})`);
      
      // Check if already processed
      if (ticket.paymentStatus === 'paid') {
        console.log('⚠️ Ticket already paid');
        return res.sendStatus(200);
      }
      
      // Generate QR code
      console.log('🔄 Generating QR code...');
      const qrResult = await generateQRCode(ticket);
      console.log('✅ QR code generated');
      
      // Update ticket
      ticket.paymentStatus = 'paid';
      ticket.paidAt = new Date();
      ticket.qrCode = qrResult.qrCode;
      ticket.qrCodeData = qrResult.qrData;
      await ticket.save();
      console.log('✅ Ticket updated in database');
      
      // Send email (don't wait for it - fire and forget)
      console.log(`📧 Sending email to ${ticket.email}...`);
      sendTicketEmail(ticket, qrResult.qrCode)
        .then(success => {
          if (success) {
            console.log(`✅ Email sent successfully to ${ticket.email}`);
          } else {
            console.log(`❌ Email failed to send to ${ticket.email}`);
          }
        })
        .catch(err => {
          console.log('Email sending error:', err.message);
        });
      
      // Update event count
      const event = await Event.getEvent();
      event.firstBatch.sold += 1;
      await event.save();
      console.log(`✅ Event count updated: ${event.firstBatch.sold}/${event.firstBatch.limit}`);
      
      console.log(`========== WEBHOOK PROCESSING COMPLETE for ${ticket.ticketId} ==========`);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;