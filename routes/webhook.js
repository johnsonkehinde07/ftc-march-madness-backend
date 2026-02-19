const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const generateQRCode = require('../utils/qrGenerator');
const sendTicketEmail = require('../utils/emailResend');

// Paystack webhook endpoint
router.post('/paystack-webhook', async (req, res) => {
  try {
    const webhookEvent = req.body;
    
    console.log('========== WEBHOOK RECEIVED ==========');
    console.log('Event:', webhookEvent.event);
    
    if (webhookEvent.event === 'charge.success') {
      const reference = webhookEvent.data.reference;
      const metadata = webhookEvent.data.metadata || {};
      const customerEmail = webhookEvent.data.customer?.email;
      
      console.log(`🔍 Webhook processing reference: ${reference}`);
      
      // Find ticket by reference
      let ticket = await Ticket.findOne({ paymentReference: reference });
      
      if (!ticket && metadata.bulkOrderId) {
        console.log(`🔍 Looking for tickets with bulkOrderId: ${metadata.bulkOrderId}`);
        const tickets = await Ticket.find({ bulkOrderId: metadata.bulkOrderId });
        if (tickets && tickets.length > 0) {
          ticket = tickets[0];
          console.log(`✅ Found ${tickets.length} tickets via bulkOrderId`);
        }
      }
      
      if (!ticket) {
        console.log(`❌ No ticket found for reference: ${reference}`);
        return res.sendStatus(200);
      }
      
      // Find ALL tickets in this bulk order
      const tickets = await Ticket.find({ 
        $or: [
          { paymentReference: reference },
          { bulkOrderId: ticket.bulkOrderId }
        ]
      });
      
      console.log(`✅ Found ${tickets.length} tickets to process`);
      
      // Process each ticket
      for (const t of tickets) {
        if (t.paymentStatus === 'paid') continue;
        
        // Generate QR code if not exists
        if (!t.qrCode) {
          console.log(`🔄 Generating QR for ticket ${t.ticketId}...`);
          const qrResult = await generateQRCode(t);
          t.qrCode = qrResult.qrCode;
          t.qrCodeData = qrResult.qrData;
        }
        
        t.paymentStatus = 'paid';
        t.paidAt = new Date();
        await t.save();
        console.log(`✅ Ticket ${t.ticketId} marked as paid`);
      }
      
      // ===== FIXED: Update event sold count with better error handling =====
      try {
        const event = await Event.getEvent();
        console.log('Available ticket types:', event.ticketTypes.map(t => t.name));
        
        // Find the ticket type (case-insensitive match)
        const ticketTypeName = tickets[0].ticketType;
        const ticketType = event.ticketTypes.find(t => 
          t.name.toLowerCase() === ticketTypeName?.toLowerCase()
        );
        
        if (ticketType) {
          // Count how many of this type are actually paid
          const paidCount = await Ticket.countDocuments({ 
            ticketType: ticketType.name, 
            paymentStatus: 'paid' 
          });
          
          // Update the sold count
          ticketType.sold = paidCount;
          await event.save();
          console.log(`✅ Updated ${ticketType.name} sold count to ${paidCount}`);
        } else {
          console.log(`⚠️ Ticket type "${tickets[0].ticketType}" not found in event`);
          // Log the available types for debugging
          console.log('Available types:', event.ticketTypes.map(t => t.name));
        }
      } catch (eventError) {
        console.error('❌ Error updating event count:', eventError.message);
      }
      // ===== END FIX =====
      
      // Send single email with all tickets
      console.log(`📧 Sending email with ${tickets.length} tickets to ${tickets[0].email}...`);
      try {
        await sendTicketEmail(tickets, tickets[0]);
        console.log(`✅ Email sent successfully`);
      } catch (emailError) {
        console.log(`⚠️ Email sending failed:`, emailError.message);
      }
      
      console.log(`========== WEBHOOK COMPLETE ==========`);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;