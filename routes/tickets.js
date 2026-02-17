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
      // Get the payment reference
      const paystackReference = payment.data.reference;
      
      if (!paystackReference) {
        console.error('❌ No reference from Paystack!');
        throw new Error('No payment reference received');
      }
      
      console.log(`💰 Paystack reference: ${paystackReference}`);
      
      // Save payment reference to ticket
      ticket.paymentReference = paystackReference;
      await ticket.save();
      
      // Verify it saved
      const verifyTicket = await Ticket.findById(ticket._id);
      console.log(`✅ Payment reference saved: ${verifyTicket.paymentReference} for ticket ${verifyTicket.ticketId}`);
      
      res.json({
        success: true,
        message: 'Redirect to payment',
        data: {
          ticketId: ticket.ticketId,
          authorization_url: payment.data.authorization_url,
          reference: paystackReference
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
    
    // Find ticket by reference
    let ticket = await Ticket.findOne({ paymentReference: reference });
    
    if (!ticket) {
      console.log(`❌ No ticket found for reference: ${reference}`);
      
      // Try to find by recent tickets with this email (maybe reference wasn't saved)
      const verification = await verifyPayment(reference).catch(() => null);
      if (verification && verification.data) {
        const customerEmail = verification.data.customer?.email;
        if (customerEmail) {
          console.log(`🔍 Looking for recent tickets with email: ${customerEmail}`);
          const recentTicket = await Ticket.findOne({ 
            email: customerEmail,
            paymentStatus: 'pending'
          }).sort({ createdAt: -1 });
          
          if (recentTicket) {
            console.log(`✅ Found recent ticket: ${recentTicket.ticketId}`);
            ticket = recentTicket;
            ticket.paymentReference = reference;
            await ticket.save();
          }
        }
      }
      
      if (!ticket) {
        return res.status(404).json({ 
          success: false, 
          message: 'Ticket not found' 
        });
      }
    }
    
    // If already paid, just return success
    if (ticket.paymentStatus === 'paid') {
      console.log(`✅ Ticket ${ticket.ticketId} already paid`);
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: {
          ticketId: ticket.ticketId,
          name: ticket.name,
          email: ticket.email,
          price: 8000
        }
      });
    }
    
    // Verify with Paystack
    const verification = await verifyPayment(reference);
    
    if (verification.data.status === 'success') {
      // Generate QR code
      const generateQRCode = require('../utils/qrGenerator');
      const sendTicketEmail = require('../utils/emailResend'); // FIXED: Changed to Resend
      
      const qrResult = await generateQRCode(ticket);
      
      // Update ticket
      ticket.paymentStatus = 'paid';
      ticket.paidAt = new Date();
      ticket.qrCode = qrResult.qrCode;
      ticket.qrCodeData = qrResult.qrData;
      await ticket.save();
      
      // Send email with Resend (don't wait for it)
      console.log(`📧 Sending email via Resend to ${ticket.email}...`);
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
      
      console.log(`✅ Ticket ${ticket.ticketId} verified and completed`);
      
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
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }
    
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