const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const generateQRCode = require('../utils/qrGenerator');
const nodemailer = require('nodemailer');

// Email sending function with better error handling
const sendTicketEmail = async (ticket, qrCode) => {
  try {
    console.log(`📧 Attempting to send email to ${ticket.email}...`);
    
    // Create transporter with timeout settings
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    const mailOptions = {
      from: `"FTC MARCH MADNESS" <${process.env.EMAIL_USER}>`,
      to: ticket.email,
      subject: '🎫 YOUR TICKET - FTC MARCH MADNESS',
      html: `
        <div style="font-family: Inter, Arial; max-width: 600px; margin: 0 auto; background: #1A1212; color: #F5E6D3; padding: 40px; border: 3px solid #8B1E1E;">
          <h1 style="color: #C69C6D; text-align: center;">FTC MARCH MADNESS</h1>
          <div style="background: rgba(139,30,30,0.2); padding: 20px; margin: 20px 0;">
            <p><strong>TICKET ID:</strong> ${ticket.ticketId}</p>
            <p><strong>NAME:</strong> ${ticket.name}</p>
            <p><strong>EMAIL:</strong> ${ticket.email}</p>
            <p><strong>DATE:</strong> MARCH 7, 2026</p>
            <p><strong>LOCATION:</strong> BEACH HOUSE</p>
          </div>
          <div style="text-align: center;">
            <p>SCAN THIS QR CODE AT ENTRY</p>
            <img src="${qrCode}" style="width: 250px; border: 3px solid #C69C6D;">
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${ticket.email}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Email Error:', error.message);
    console.log('⚠️ Continuing without email - QR code still saved in database');
    return false;
  }
};

// Paystack webhook endpoint
router.post('/paystack-webhook', async (req, res) => {
  try {
    const webhookEvent = req.body; // RENAMED from 'event' to 'webhookEvent' to avoid conflict
    
    console.log('========== WEBHOOK RECEIVED ==========');
    console.log('Event:', webhookEvent.event);
    
    // Only process successful charges
    if (webhookEvent.event === 'charge.success') {
      const reference = webhookEvent.data.reference;
      const metadata = webhookEvent.data.metadata || {};
      
      console.log(`🔍 Processing successful charge. Reference: ${reference}`);
      
      // Try to find ticket by reference first
      let ticket = await Ticket.findOne({ paymentReference: reference });
      
      // If not found, try by ticketId from metadata
      if (!ticket && metadata.ticketId) {
        console.log(`🔍 Trying ticketId: ${metadata.ticketId}`);
        ticket = await Ticket.findOne({ ticketId: metadata.ticketId });
      }
      
      if (!ticket) {
        console.log('❌ TICKET NOT FOUND IN DATABASE');
        return res.sendStatus(200);
      }
      
      console.log(`✅ TICKET FOUND: ${ticket.ticketId} for ${ticket.email}`);
      
      // Check if ticket already processed
      if (ticket.paymentStatus === 'paid') {
        console.log('⚠️ Ticket already marked as paid.');
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
      
      // Send email with QR code (don't wait for it - fire and forget)
      sendTicketEmail(ticket, qrResult.qrCode).catch(err => {
        console.log('Email sending in background failed:', err.message);
      });
      
      // Update event count
      const eventDoc = await Event.getEvent();
      eventDoc.firstBatch.sold += 1;
      await eventDoc.save();
      console.log(`✅ Event count updated: ${eventDoc.firstBatch.sold}/${eventDoc.firstBatch.limit}`);
      
      console.log(`========== WEBHOOK PROCESSING COMPLETE ==========`);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ WEBHOOK ERROR:', error);
    res.sendStatus(500);
  }
});

module.exports = router;