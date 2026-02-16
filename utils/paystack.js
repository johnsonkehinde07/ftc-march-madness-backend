const axios = require('axios');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Initialize payment
const initializePayment = async (email, amount, metadata) => {
  try {
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: email,
      amount: amount * 100, // Paystack uses kobo (multiply by 100)
      metadata: metadata,
      callback_url: `${process.env.FRONTEND_URL}/payment-callback.html`
    }, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Paystack Error:', error.response?.data || error.message);
    throw error;
  }
};

// Verify payment
const verifyPayment = async (reference) => {
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Verification Error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = { initializePayment, verifyPayment };