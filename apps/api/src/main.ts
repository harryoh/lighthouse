import express from 'express';
import cors from 'cors';
import { prisma, performHealthCheck } from '@lighthouse/database';
import contentRoutes from './routes/content.routes';
import queueRoutes from './routes/queue.routes';
import { queueService } from './services/queue.service';
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
  const dbHealth = await performHealthCheck();

  // Get queue health
  let queueHealth: { status: string; queues: any[] } = {
    status: 'unknown',
    queues: [],
  };
  try {
    const queues = await queueService.getAllQueuesHealth();
    queueHealth = {
      status: queues.every((q) => q.isHealthy) ? 'healthy' : 'unhealthy',
      queues,
    };
  } catch {
    queueHealth = {
      status: 'unhealthy',
      queues: [],
    };
  }

  const overallStatus =
    dbHealth.status === 'healthy' && queueHealth.status === 'healthy'
      ? 'healthy'
      : 'unhealthy';
  const status = overallStatus === 'healthy' ? 200 : 503;

  res.status(status).json({
    status: overallStatus,
    database: dbHealth,
    queue: queueHealth,
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Lighthouse API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      contents: '/api/contents',
      queues: '/api/queues',
    },
  });
});

// API Routes
app.use('/api/contents', contentRoutes);
app.use('/api/queues', queueRoutes);

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

  // Initialize queue system
  try {
    await queueService.initialize();
    console.log('✅ Queue system initialized successfully');
  } catch (error) {
    console.error('⚠️ Queue system initialization failed:', error);
    // Don't exit - queues are optional for now
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
  });
  await queueService.shutdown();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
  });
  await queueService.shutdown();
  await prisma.$disconnect();
  process.exit(0);
});
