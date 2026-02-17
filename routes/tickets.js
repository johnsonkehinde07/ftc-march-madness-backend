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
      amount: amount * 100, // Paystack uses kobo (multiply by 100)
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
    
    // Log received data for debugging
    console.log('Purchase request received:', { name, email, phone });
    
    // Validation
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and email are required' 
      });
    }
    
    // Check if tickets are available
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
    console.log(`📝 Ticket created: ${ticket.ticketId} for ${email}`);
    
    // Initialize Paystack payment
    const payment = await initializePayment(email, event.firstBatch.price, {
      ticketId: ticket.ticketId,
      name: name,
      phone: phone
    });
    
    if (payment.status) {
      // Save payment reference to ticket
      ticket.paymentReference = payment.data.reference;
      await ticket.save();
      
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
    console.error('Purchase Error:', error);
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
    
    // Verify payment with Paystack
    const verification = await verifyPayment(reference);
    
    if (verification.data.status === 'success') {
      // Find ticket by payment reference
      const ticket = await Ticket.findOne({ paymentReference: reference });
      
      if (!ticket) {
        return res.status(404).json({ 
          success: false, 
          message: 'Ticket not found' 
        });
      }
      
      // Update ticket status
      ticket.paymentStatus = 'paid';
      ticket.paidAt = new Date();
      await ticket.save();
      
      // Update event sold count
      const event = await Event.getEvent();
      event.firstBatch.sold += 1;
      await event.save();
      
      console.log(`✅ Payment verified for ticket: ${ticket.ticketId}`);
      
      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          ticketId: ticket.ticketId,
          name: ticket.name,
          email: ticket.email,
          price: event.firstBatch.price
        }
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }
  } catch (error) {
    console.error('Verification Error:', error);
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