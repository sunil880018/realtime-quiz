const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { PORT } = require('./config/config');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const { initSocket } = require('./sockets/gameSockets');
const { connectDB } = require('./database/connections');
const { ingestQuestions } = require('./scripts/ingestQuestions');

const app = express();
const server = http.createServer(app);
// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

(async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    // Ingest questions on server start
    await ingestQuestions();
    // Initialize WebSocket after server starts
    initSocket(server);
  } catch (err) {
    console.error('Failed to connect to database', err);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.disconnect();
  process.exit(0);
});
