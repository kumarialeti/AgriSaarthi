import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from './utils/logger.js';
import { testConnection } from './db/pool.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { verifyToken } from './utils/jwt.js';

// Routes
import authRoutes from './routes/auth.js';
import farmerRoutes from './routes/farmer.js';
import soilRoutes from './routes/soil.js';
import cropHealthRoutes from './routes/cropHealth.js';
import weatherRoutes from './routes/weather.js';
import marketRoutes from './routes/market.js';
import buyerRoutes from './routes/buyer.js';
import chatRoutes from './routes/chat.js';
import schemesRoutes from './routes/schemes.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Socket.io auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const user = verifyToken(token);
    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  logger.info('Socket connected', { userId });
  socket.join(`user:${userId}`);

  socket.on('disconnect', () => {
    logger.debug('Socket disconnected', { userId });
  });
});

// Export io for use in controllers
export { io };

// ─── Express Middleware ───────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.url === '/health',
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many authentication attempts.' },
});
app.use('/api/auth/', authLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static files (uploads)
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadDir));

// ─── Health Check ─────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const dbTime = await testConnection();
    res.json({
      status: 'healthy',
      service: 'agrisaarthi-backend',
      timestamp: new Date().toISOString(),
      db: dbTime,
    });
  } catch {
    res.status(503).json({ status: 'unhealthy', service: 'agrisaarthi-backend', db: 'unavailable' });
  }
});

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/soil', soilRoutes);
app.use('/api/crop-health', cropHealthRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', schemesRoutes);
app.use('/api/admin', adminRoutes);

// ─── Error Handling ────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ──────────────────────────────────────────────────
const PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);

const startServer = async () => {
  try {
    await testConnection();
    logger.info('✅ Database connection established');

    httpServer.listen(PORT, () => {
      logger.info(`🚀 AgriSaarthi Backend running on port ${PORT}`);
      logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`   Health: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    logger.error('❌ Failed to start server', { error: err.message });
    process.exit(1);
  }
};

startServer();

export default app;
