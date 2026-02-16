const express = require('express');
const router = express.Router();

// Admin login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  // Simple check (in real app, use proper authentication)
  if (email === 'admin@ftcmarch.com' && password === 'ftc2026march') {
    res.json({
      success: true,
      token: 'admin-token-123'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Get all tickets (protected route)
router.get('/tickets', (req, res) => {
  const token = req.header('x-auth-token');
  
  if (token !== 'admin-token-123') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  res.json({
    success: true,
    message: 'Tickets will be here',
    tickets: []
  });
});

// Get stats (protected route)
router.get('/stats', (req, res) => {
  const token = req.header('x-auth-token');
  
  if (token !== 'admin-token-123') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  res.json({
    success: true,
    stats: {
      totalTickets: 0,
      scanned: 0,
      revenue: 0
    }
  });
});

module.exports = router;