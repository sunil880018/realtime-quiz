const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const prompt = require('prompt-sync')({ sigint: true }); // npm i prompt-sync

// Array of JWT tokens
const tokens = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJiYzcyNWM4ZWNiNDBiNTZjNWIxN2MiLCJlbWFpbCI6InN1bmlsQGdtYWlsLmNvbSIsIm5hbWUiOiJzdW5pbCIsImlhdCI6MTc1NzE1Nzg0NywiZXhwIjoxNzU3MjQ0MjQ3fQ.Uv3fNcX14bsTugqJ-ciFEO-6RFhIxPrEKIW1v-19jYk',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJiYzc3YmM4ZWNiNDBiNTZjNWIxN2YiLCJlbWFpbCI6ImFiaGlzaGVrQGdtYWlsLmNvbSIsIm5hbWUiOiJhYmhpc2hlayIsImlhdCI6MTc1NzE1Nzg1MSwiZXhwIjoxNzU3MjQ0MjUxfQ.siatOCSwNlYY1exG-Z7e4_VgYvTbkw_De66--atqPvs',
];

tokens.forEach(async (token) => {
  const decoded = jwt.decode(token);
  const name = decoded?.name || 'Anonymous';

  const socket = io('http://localhost:3000', { auth: { token } });

  socket.on('connect', async () => {
    console.log(`[${name}] Connected: ${socket.id}`);

    // Join game queue
    try {
      const res = await axios.post(
        'http://localhost:3000/api/game/start',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`[${name}] Queue response:`, res.data);
    } catch (err) {
      console.error(`[${name}] Failed to join queue:`, err.message);
    }
  });

  socket.on('question:send', (data) => {
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
    console.log(`[${name}] Game finished:`, data);
    if (!data.winner) console.log('Result: Tie');
    else {
      console.log(`Winner ID: ${data.winner}`);
      const winnerName =
        data.players.find((p) => p.userId === data.winner)?.name || 'No Name';
      console.log(`Winner Name: ${winnerName}`);
    }
  });

  socket.on('error', (err) => console.error(`[${name}] Socket error:`, err));
});

// .on() = LISTEN for an event.
// .emit() = FIRE/SEND an event.
