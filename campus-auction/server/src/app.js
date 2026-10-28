import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { isFirebaseConfigured } from './config/firebaseAdmin.js';
import auctionRoutes from './routes/auctions.js';
import bidRoutes from './routes/bids.js';
import autoBidRoutes from './routes/autoBids.js';
import uploadRoutes from './routes/uploads.js';
import notificationRoutes from './routes/notifications.js';
import userRoutes from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getAuctions } from './services/auctionService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Middleware
const allowedOrigins = [
  CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://tcc-hackathon-campus-auction.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server, curl, mobile or pre-fetch without origin
    if (!origin) return callback(null, true);

    // Allow configured origins, Vercel app domains, and local development
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));

// Request logger for visibility
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Campus Auction REST API',
    timestamp: new Date().toISOString(),
    isFirebaseConfigured,
    mode: isFirebaseConfigured ? 'PRODUCTION_FIREBASE' : 'LOCAL_DEMO_STORE'
  });
});

// API Routes
app.use('/api/auctions', auctionRoutes);
app.use('/api/auctions/:id/bids', bidRoutes);
app.use('/api/auctions/:id/auto-bid', autoBidRoutes);
app.use('/api/auctions/:id/auto-bids', autoBidRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

// Error Handling
app.use(errorHandler);

// Background sweep timer for expired auctions (every 30 seconds)
setInterval(async () => {
  try {
    await getAuctions({ status: 'LIVE' });
  } catch (err) {
    // Silent sweep catch
  }
}, 30000);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` Campus Auction (CampusBid) Server running on:`);
    console.log(` -> http://localhost:${PORT}`);
    console.log(` Mode: ${isFirebaseConfigured ? 'FIREBASE_PRODUCTION' : 'LOCAL_DEMO_STORE'}`);
    console.log(` Client Origin: ${CLIENT_ORIGIN}`);
    console.log(`===============================================`);
  });
}

export default app;
