const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const axios = require('axios');

// Paystack initialization function
const initializePayment = async (email, amount, metadata) => {
  try {
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: email,
      amount: amount * 100,
      metadata: metadata,
      callback_url: 'https://ftc-march-madness.netlify.app/payment-callback.html'
    }, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Paystack Error:', error.response?.data || error.message);
    throw error;
  }
};

// Verify payment function
const verifyPayment = async (reference) => {
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Verification Error:', error.response?.data || error.message);
    throw error;
  }
};

// Check availability
router.get('/availability', async (req, res) => {
  try {
    const event = await Event.findOne();
    const available = event ? event.firstBatch.limit - event.firstBatch.sold : 30;
    const price = event ? event.firstBatch.price : 8000;
    
    res.json({
      success: true,
      data: {
        available: available,
        price: price,
        total: 30,
        sold: event ? event.firstBatch.sold : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Initialize ticket purchase (redirect to Paystack)
router.post('/purchase', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    console.log('📝 Purchase request received:', { name, email, phone });
    
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and email are required' 
      });
    }
    
    const event = await Event.getEvent();
    if (event.firstBatch.sold >= event.firstBatch.limit) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tickets are sold out' 
      });
    }
    
    // Create ticket with pending status
    const ticket = new Ticket({
      name,
      email,
      phone,
      ticketId: 'FTC' + Date.now() + Math.floor(Math.random() * 1000),
      paymentStatus: 'pending'
    });
    
    await ticket.save();
    console.log(`🎫 Ticket created: ${ticket.ticketId} for ${email}`);
    
    // Initialize Paystack payment
    const payment = await initializePayment(email, event.firstBatch.price, {
      ticketId: ticket.ticketId,
      name: name,
      phone: phone
    });
    
    if (payment.status) {
      // CRITICAL FIX: Save payment reference and verify immediately
      ticket.paymentReference = payment.data.reference;
      await ticket.save();
      
      // Double-check it saved
      const verifyTicket = await Ticket.findById(ticket._id);
      console.log(`✅ Payment reference saved: ${verifyTicket.paymentReference} for ticket ${verifyTicket.ticketId}`);
      
      res.json({
        success: true,
        message: 'Redirect to payment',
        data: {
          ticketId: ticket.ticketId,
          authorization_url: payment.data.authorization_url,
          reference: payment.data.reference
        }
      });
    } else {
      throw new Error('Payment initialization failed');
    }
    
  } catch (error) {
    console.error('❌ Purchase Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing purchase: ' + error.message 
    });
  }
});

// WEBHOOK ENDPOINT - This is what Paystack calls automatically
router.post('/paystack-webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('📩 Webhook received:', event.event);
    console.log('Webhook data:', JSON.stringify(event.data, null, 2));
    
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const metadata = event.data.metadata;
      
      console.log(`🔍 Looking for ticket with reference: ${reference}`);
      
      // Find ticket by payment reference
      const ticket = await Ticket.findOne({ paymentReference: reference });
      
      if (!ticket) {
        console.log(`❌ No ticket found for reference: ${reference}`);
        // Try to find by metadata.ticketId as fallback
        if (metadata && metadata.ticketId) {
          console.log(`🔍 Trying fallback search with ticketId: ${metadata.ticketId}`);
          const fallbackTicket = await Ticket.findOne({ ticketId: metadata.ticketId });
          if (fallbackTicket) {
            console.log(`✅ Found ticket via fallback: ${fallbackTicket.ticketId}`);
            // Update the ticket with the reference
            fallbackTicket.paymentReference = reference;
            fallbackTicket.paymentStatus = 'paid';
            fallbackTicket.paidAt = new Date();
            await fallbackTicket.save();
            
            // Generate QR code and send email here
            const generateQRCode = require('../utils/qrGenerator');
            const sendTicketEmail = require('../utils/emailService');
            
            const qrResult = await generateQRCode(fallbackTicket);
            fallbackTicket.qrCode = qrResult.qrCode;
            fallbackTicket.qrCodeData = qrResult.qrData;
            await fallbackTicket.save();
            
            await sendTicketEmail(fallbackTicket, qrResult.qrCode);
            
            const eventDoc = await Event.getEvent();
            eventDoc.firstBatch.sold += 1;
            await eventDoc.save();
            
            console.log(`✅ Ticket ${fallbackTicket.ticketId} completed via fallback`);
          }
        }
        return res.sendStatus(200);
      }
      
      console.log(`✅ Ticket found: ${ticket.ticketId}`);
      
      // Generate QR code
      const generateQRCode = require('../utils/qrGenerator');
      const sendTicketEmail = require('../utils/emailService');
      
      const qrResult = await generateQRCode(ticket);
      
      // Update ticket
      ticket.paymentStatus = 'paid';
      ticket.paidAt = new Date();
      ticket.qrCode = qrResult.qrCode;
      ticket.qrCodeData = qrResult.qrData;
      await ticket.save();
      
      // Send email with QR code
      await sendTicketEmail(ticket, qrResult.qrCode);
      
      // Update event count
      const eventDoc = await Event.getEvent();
      eventDoc.firstBatch.sold += 1;
      await eventDoc.save();
      
      console.log(`✅ Ticket ${ticket.ticketId} completed successfully`);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    res.sendStatus(500);
  }
});

// Verify payment after Paystack redirect
router.post('/verify-payment', async (req, res) => {
  try {
    const { reference } = req.body;
    
    if (!reference) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment reference required' 
      });
    }
    
    console.log(`🔍 Verifying payment: ${reference}`);
    
    // First check if ticket already exists with this reference
    let ticket = await Ticket.findOne({ paymentReference: reference });
    
    if (!ticket) {
      // If not found, verify with Paystack
      const verification = await verifyPayment(reference);
      
      if (verification.data.status === 'success') {
        // Try to find by metadata
        const metadata = verification.data.metadata;
        if (metadata && metadata.ticketId) {
          ticket = await Ticket.findOne({ ticketId: metadata.ticketId });
          
          if (ticket) {
            // Update ticket with reference
            ticket.paymentReference = reference;
            ticket.paymentStatus = 'paid';
            ticket.paidAt = new Date();
            
            // Generate QR code
            const generateQRCode = require('../utils/qrGenerator');
            const sendTicketEmail = require('../utils/emailService');
            
            const qrResult = await generateQRCode(ticket);
            ticket.qrCode = qrResult.qrCode;
            ticket.qrCodeData = qrResult.qrData;
            await ticket.save();
            
            // Send email
            await sendTicketEmail(ticket, qrResult.qrCode);
            
            // Update event count
            const event = await Event.getEvent();
            event.firstBatch.sold += 1;
            await event.save();
            
            console.log(`✅ Ticket ${ticket.ticketId} verified and completed`);
          }
        }
      }
    }
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        ticketId: ticket.ticketId,
        name: ticket.name,
        email: ticket.email,
        price: 8000
      }
    });
    
  } catch (error) {
    console.error('❌ Verification Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying payment: ' + error.message 
    });
  }
});

// Check ticket by email
router.get('/check/:email', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ 
      email: req.params.email.toLowerCase(),
      paymentStatus: 'paid'
    });
    
    if (!ticket) {
      return res.json({
        success: true,
        hasTicket: false,
        message: 'No paid ticket found for this email'
      });
    }
    
    res.json({
      success: true,
      hasTicket: true,
      data: {
        ticketId: ticket.ticketId,
        name: ticket.name,
        scanned: ticket.scanned
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;