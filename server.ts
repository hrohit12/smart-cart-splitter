import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

// Import backend routes
const backendRoutes = require('./backend/routes');

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature']
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 1. Mount API Routes FIRST
  app.use('/api', backendRoutes.router);

  // 2. Serve frontend static files
  const frontendPath = path.join(process.cwd(), 'frontend');
  app.use(express.static(frontendPath));

  // Direct page routes
  app.get('/store', (req, res) => {
    res.sendFile(path.join(frontendPath, 'store.html'));
  });

  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(frontendPath, 'dashboard.html'));
  });

  app.get('/order', (req, res) => {
    res.sendFile(path.join(frontendPath, 'order.html'));
  });

  app.get('/demo-payment', (req, res) => {
    res.sendFile(path.join(frontendPath, 'demo-payment.html'));
  });

  // Vite integration for SPA fallback if needed
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Prefer frontend index.html for store checkout
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Fallback unhandled routes to frontend index
    app.get('/', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ Smart Cart Splitter running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
