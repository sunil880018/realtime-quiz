const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { getUserChoice } = require('./utils/userInput');
// Array of JWT tokens
const tokens = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJkNWU2ZDJhZDhlMThkY2FhNTE4MGYiLCJlbWFpbCI6InN1bmlsQGdtYWlsLmNvbSIsIm5hbWUiOiJzdW5pbCIsImlhdCI6MTc1NzI0MDk1NiwiZXhwIjoxNzU3MzI3MzU2fQ.IK2XVUkRcHFQAlTwec4QAf04PyGbj7z1FX3mVq5EqsY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJkNWU3MzJhZDhlMThkY2FhNTE4MTIiLCJlbWFpbCI6ImFiaGlzaGVrQGdtYWlsLmNvbSIsIm5hbWUiOiJhYmhpc2hlayIsImlhdCI6MTc1NzI0MTAxMSwiZXhwIjoxNzU3MzI3NDExfQ.sXv7Tl7tQtwMZiy_Tzc9SH99ebiuZhCEZOOnSmL5YTk',
];

function createGameClient(token) {
  const decoded = jwt.decode(token);
  const name = decoded?.name || null;

  const socket = io('http://localhost:3000', {
    // when client connects with token to the server,server middleware will verify the token
    auth: { token },
    reconnectionAttempts: 5, // Retry connection if server down
    timeout: 5000,
  });

  socket.on('connect', async () => {
    console.log(`[${name}] Connected with socket ID: ${socket.id}`);

    // Join the game queue,sending user into the queue
    try {
      const res = await axios.post(
        'http://localhost:3000/api/game/start',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`[${name}] Queue response:`, res.data);
    } catch (err) {
      console.error(
        `[${name}] Failed to join queue:`,
        err.response?.data || err.message
      );
    }
  });

  socket.on('question:send', async (data) => {
    console.log(
      `\n[${name}] Question #${data.questionIndex + 1}: ${data.question.text}`
    );
    data.question.options.forEach((opt, idx) =>
      console.log(`  ${idx}: ${opt}`)
    );

    // Ask user for input
    let choice = await getUserChoice(data);

    socket.emit('answer:submit', {
      gameId: data.gameId,
      questionIndex: data.questionIndex,
      selectedChoice: choice,
    });
  });

  socket.on('game:end', (data) => {
    console.log(`[${name}] Game finished`);
    if (!data.winner) console.log('Result: Tie');
    else {
      const winnerName =
        data.players.find((p) => p.userId === data.winner)?.name || 'No Name';
      console.log(`Winner ID: ${data.winner}, Name: ${winnerName}`);
    }
    console.log(`[${name}] Disconnecting...`);
    socket.disconnect();
  });

  socket.on('disconnect', (reason) => {
    console.log(`[${name}] Disconnected: ${reason}`);
  });

  socket.on('error', (err) => console.error(`[${name}] Socket error:`, err));
}

tokens.forEach(createGameClient);

// .on() = LISTEN for an event.
// .emit() = FIRE/SEND an event.
