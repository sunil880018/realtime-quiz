const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const prompt = require('prompt-sync')({ sigint: true }); // npm i prompt-sync

// Array of JWT tokens
const tokens = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJjMTE3YjBlNGYwZGFlZjcyOTRjNTYiLCJlbWFpbCI6InN1bmlsQGdtYWlsLmNvbSIsIm5hbWUiOiJzdW5pbCIsImlhdCI6MTc1NzE1NTcyMCwiZXhwIjoxNzU3MjQyMTIwfQ.LrvEGroxblQNNxSh0Jp6I7DzGPQxpSqWUpESKzlWGU8',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGJjMTE4MTBlNGYwZGFlZjcyOTRjNTkiLCJlbWFpbCI6ImFiaGlzaGVrQGdtYWlsLmNvbSIsIm5hbWUiOiJhYmhpc2hlayIsImlhdCI6MTc1NzE1NTcyMywiZXhwIjoxNzU3MjQyMTIzfQ.GGI8zmdHSx_kh9jUG8EXzHRuoqGDe1Di4mG3C-hYS34',
];

tokens.forEach(async (token) => {
  const decoded = jwt.decode(token);
  const name = decoded?.name || 'Anonymous';

  const socket = io('http://localhost:3000', { auth: { token } });

  socket.on('connect', async () => {
    console.log(`[${name}] Connected: ${socket.id}`);

    // Join matchmaking queue
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
