// ==========================================================
// SMART CART SPLITTER - CLIENT CONFIGURATION
// ==========================================================

// When deploying the frontend to Netlify and the backend to Railway/Render:
// replace window.APP_CONFIG.API_BASE_URL with your deployed backend URL.
// Example: API_BASE_URL: 'https://smart-cart-splitter-production.up.railway.app'

window.APP_CONFIG = {
  // Empty string or null means auto-detect current origin (recommended for single domain or proxy)
  API_BASE_URL: window.location.port === '5500' ? 'http://localhost:5000' : ''
};
