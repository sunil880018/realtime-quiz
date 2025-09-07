const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const Question = require('../models/Questions');
const { JWT_SECRET, NUM_QUESTIONS } = require('../config/config');

let io;
const socketsByUser = new Map(); // userId -> socket
const waitingQueue = []; // matchmaking queue
const inMemoryGameState = new Map(); // gameId -> runtime state

function initSocket(server) {
  io = new Server(server, { cors: { origin: '*' } });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = { id: payload.userId, name: payload.name || 'Anonymous' };
      return next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const { id, name } = socket.user;
    socketsByUser.set(id.toString(), socket);
    console.log(`[Socket.IO] User connected: ${id} (${name})`);

    socket.on('disconnect', () => {
      socketsByUser.delete(id.toString());
      console.log(`[Socket.IO] User disconnected: ${id}`);
    });

    socket.on('answer:submit', async (payload) => {
      try {
        if (!payload?.gameId)
          return socket.emit('error', { message: 'Invalid payload' });

        const state = inMemoryGameState.get(payload.gameId);
        if (!state)
          return socket.emit('error', {
            message: 'Game not found or finished',
          });

        const player = state.players.find(
          (p) => p.userId.toString() === id.toString()
        );
        if (!player)
          return socket.emit('error', { message: 'Player not in game' });

        const question = state.questions[payload.questionIndex];
        if (!question)
          return socket.emit('error', { message: 'Invalid question index' });

        // Prevent double answers
        if (
          player.answers.some((a) => a.questionIndex === payload.questionIndex)
        )
          return socket.emit('error', { message: 'Already answered' });

        // Map index to option text
        const selectedAnswerText = question.options[payload.selectedChoice];
        const correct = selectedAnswerText === question.correctAnswer;

        player.answers.push({
          questionIndex: payload.questionIndex,
          selectedIndex: payload.selectedChoice,
          selectedAnswer: selectedAnswerText,
          correct,
        });

        if (correct) player.score += question.points || 10;

        // Check if all players answered this question
        const bothAnswered = state.players.every((p) =>
          p.answers.some((a) => a.questionIndex === payload.questionIndex)
        );

        if (bothAnswered) await handleNextQuestionOrFinish(state);
      } catch (err) {
        console.error('[Socket.IO] answer:submit error', err);
        socket.emit('error', { message: 'Server error' });
      }
    });
  });
}

// Send next question or finish game
async function handleNextQuestionOrFinish(state) {
  state.currentIndex += 1;

  if (state.currentIndex >= state.questions.length) {
    state.status = 'finished';
    const [p1, p2] = state.players;

    // Determine winner
    let winnerId = null;
    if (p1.score > p2.score) winnerId = new mongoose.Types.ObjectId(p1.userId);
    else if (p2.score > p1.score)
      winnerId = new mongoose.Types.ObjectId(p2.userId);

    // Persist game
    const gameDoc = await Game.findById(state.gameId);
    if (gameDoc) {
      gameDoc.players = state.players.map((p) => ({
        userId: p.userId,
        name: p.name,
        score: p.score,
        answers: p.answers.map((a) => ({
          questionIndex: a.questionIndex,
          selectedOption: a.selectedAnswer,
          correct: a.correct,
        })),
      }));
      gameDoc.currentIndex = state.currentIndex;
      gameDoc.status = 'finished';
      gameDoc.winner = winnerId;
      await gameDoc.save();
    }

    // Notify players
    state.players.forEach((p) => {
      const s = socketsByUser.get(p.userId.toString());
      if (s)
        s.emit('game:end', {
          players: state.players.map((x) => ({
            userId: x.userId,
            score: x.score,
            name: x.name,
          })),
          winner: winnerId,
        });

      // Gracefully disconnect player after sending results
      setTimeout(() => {
        s.disconnect(true);
        socketsByUser.delete(p.userId.toString());
        console.log(`[Socket.IO] Disconnected player: ${p.userId}`);
      }, 2000);
    });

    inMemoryGameState.delete(state.gameId);
  } else {
    // Send next question
    state.players.forEach((p) => {
      const s = socketsByUser.get(p.userId.toString());
      if (s)
        s.emit('question:send', {
          gameId: state.gameId,
          questionIndex: state.currentIndex,
          question: sanitizeQuestion(state.questions[state.currentIndex]),
        });
    });
  }
}

// Hide correctAnswer before sending to client
function sanitizeQuestion(q) {
  if (!q) return { text: 'No question', options: [] };
  return { text: q.text, options: q.options };
}

// Add player to matchmaking queue
async function addToQueue(userId, name) {
  if (waitingQueue.some((x) => x.userId.toString() === userId.toString()))
    return;
  if (
    [...inMemoryGameState.values()].some((g) =>
      g.players.some((p) => p.userId.toString() === userId.toString())
    )
  )
    return;

  waitingQueue.push({ userId, name });
  tryMatch();
}

// Match two players
async function tryMatch() {
  if (waitingQueue.length < 2) return;

  const a = waitingQueue.shift();
  const b = waitingQueue.shift();

  let questions = await Question.aggregate([
    { $sample: { size: NUM_QUESTIONS } },
  ]);
  if (!questions || questions.length === 0) {
    questions = [
      {
        _id: new mongoose.Types.ObjectId(),
        questionText: 'Sample Question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        points: 10,
      },
    ];
  }

  const qSnapshots = questions.map((q) => ({
    questionId: q._id,
    text: q.questionText,
    options: q.options,
    correctAnswer: q.correctAnswer,
    points: q.points || 10,
  }));

  const gameDoc = await Game.create({
    players: [a, b],
    questions: qSnapshots,
    status: 'active',
  });

  const state = {
    gameId: gameDoc._id.toString(),
    players: [
      { userId: a.userId, name: a.name, score: 0, answers: [] },
      { userId: b.userId, name: b.name, score: 0, answers: [] },
    ],
    questions: qSnapshots,
    currentIndex: 0,
    status: 'active',
  };
  inMemoryGameState.set(gameDoc._id.toString(), state);

  // Notify players
  [a, b].forEach((p) => {
    const s = socketsByUser.get(p.userId.toString());
    if (s)
      s.emit('game:init', {
        gameId: gameDoc._id.toString(),
        opponent: p.userId.toString() === a.userId.toString() ? b : a,
      });
  });

  // Send first question
  state.players.forEach((p) => {
    const s = socketsByUser.get(p.userId.toString());
    if (s)
      s.emit('question:send', {
        gameId: state.gameId,
        questionIndex: 0,
        question: sanitizeQuestion(state.questions[0]),
      });
  });
}

module.exports = { initSocket, addToQueue };
