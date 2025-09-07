const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { getUserChoice } = require('./utils/userInput');
// Array of JWT tokens
const tokens = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJjMTE3YjBlNGYwZGFlZjcyOTRjNTYiLCJlbWFpbCI6InN1bmlsQGdtYWlsLmNvbSIsIm5hbWUiOiJzdW5pbCIsImlhdCI6MTc1NzI0NTYxMCwiZXhwIjoxNzU3MzMyMDEwfQ.Fl19kgIbBhVgZWakHFx97cKcn7NGhMDjDVhuMPahjZ4',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJjMTE4MTBlNGYwZGFlZjcyOTRjNTkiLCJlbWFpbCI6ImFiaGlzaGVrQGdtYWlsLmNvbSIsIm5hbWUiOiJhYmhpc2hlayIsImlhdCI6MTc1NzI0NTYxNCwiZXhwIjoxNzU3MzMyMDE0fQ.2EYwMCoCiY4E-DaILB2KLZp7IbZ8w-LYa253KO8JhNo',
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
