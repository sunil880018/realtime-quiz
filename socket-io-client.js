const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const prompt = require('prompt-sync')({ sigint: true });

// Array of JWT tokens
const tokens = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJiYzcyNWM4ZWNiNDBiNTZjNWIxN2MiLCJlbWFpbCI6InN1bmlsQGdtYWlsLmNvbSIsIm5hbWUiOiJzdW5pbCIsImlhdCI6MTc1NzE1Nzg0NywiZXhwIjoxNzU3MjQ0MjQ3fQ.Uv3fNcX14bsTugqJ-ciFEO-6RFhIxPrEKIW1v-19jYk',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJiYzc3YmM4ZWNiNDBiNTZjNWIxN2YiLCJlbWFpbCI6ImFiaGlzaGVrQGdtYWlsLmNvbSIsIm5hbWUiOiJhYmhpc2hlayIsImlhdCI6MTc1NzE1Nzg1MSwiZXhwIjoxNzU3MjQ0MjUxfQ.siatOCSwNlYY1exG-Z7e4_VgYvTbkw_De66--atqPvs',
];

function createGameClient(token) {
  const decoded = jwt.decode(token);
  const name = decoded?.name || 'Anonymous';

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
    let choice;
    while (true) {
      choice = parseInt(prompt('Enter your choice index: '));
      if (
        !isNaN(choice) &&
        choice >= 0 &&
        choice < data.question.options.length
      )
        break;
      console.log('Invalid input, try again.');
    }

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

// Create a client for each token
tokens.forEach(createGameClient);

// .on() = LISTEN for an event.
// .emit() = FIRE/SEND an event.
