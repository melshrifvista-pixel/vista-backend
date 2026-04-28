const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const entitiesRoutes = require('./routes/entities');
const transactionsRoutes = require('./routes/transactions');
const contractsRoutes = require('./routes/contracts');

const { apiLimiter } = require('./middlewares/rateLimiter');

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Ensure critical secrets have defaults for ease of deployment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_vista_2026';
process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || 'superrefreshkey_vista_2026';

app.use(cors());
app.use(express.json());
app.use(apiLimiter); // Apply global rate limiting

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  req.io = io; // Attach io to request to use in routes
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/entities', entitiesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/contracts', contractsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log the error details to the server console for debugging
  console.error(`[SERVER ERROR] ${err.name}: ${err.message}`);
  console.error(err.stack);

  res.status(statusCode).json({
    error: isProduction ? 'Internal Server Error' : err.name,
    message: err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
});



httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
