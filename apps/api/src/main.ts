import express from 'express';
import cors from 'cors';
import { prisma, performHealthCheck } from '@lighthouse/database';
import contentRoutes from './routes/content.routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', async (_req, res) => {
  const healthStatus = await performHealthCheck();
  const status = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(status).json(healthStatus);
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Lighthouse API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      contents: '/api/contents',
    },
  });
});

// API Routes
app.use('/api/contents', contentRoutes);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const server = app.listen(port, host, async () => {
  console.log(`🚀 Lighthouse API server running at http://${host}:${port}`);

  // Test database connection
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});
