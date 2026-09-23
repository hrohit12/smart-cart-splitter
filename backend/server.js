// ==========================================================
// SMART CART SPLITTER - EXPRESS SERVER
// ==========================================================

const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const { router } = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients (Netlify, localhost, etc.)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature']
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount API routes
app.use('/api', router);

// Serve frontend static files if present (for single-container or unified local preview)
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Fallback for html pages
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

app.get('/order', (req, res) => {
  res.sendFile(path.join(frontendPath, 'order.html'));
});

app.get('/demo-payment', (req, res) => {
  res.sendFile(path.join(frontendPath, 'demo-payment.html'));
});

// Root fallback to frontend index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start listening
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`⚡ SMART CART SPLITTER BACKEND RUNNING`);
    console.log(`📍 URL: http://0.0.0.0:${PORT}`);
    console.log(`🛠️  DEMO_MODE: ${process.env.DEMO_MODE !== 'false' ? 'ENABLED (Simulation ready)' : 'DISABLED (Razorpay live test mode)'}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
