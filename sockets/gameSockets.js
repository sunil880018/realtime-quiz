const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Game = require('../models/Game');
const Question = require('../models/Questions');
const { JWT_SECRET, NUM_QUESTIONS } = require('../config/config');
const {
  redis,
  pub,
  sub,
  MATCH_QUEUE_KEY,
  GAME_STATE_PREFIX,
} = require('../redis/redis');
const dummyQuestions = require('../scripts/questions.json');

let io;
const socketsByUser = new Map(); // userId -> socket

function initSocket(server) {
  io = new Server(server, { cors: { origin: '*' } });

  // Redis Pub/Sub for game events
  sub.subscribe('game:events');
  sub.on('message', (channel, message) => {
    const { event, payload } = JSON.parse(message);
    handleGameEvent(event, payload);
  });

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

        const stateRaw = await redis.get(GAME_STATE_PREFIX + payload.gameId);
        if (!stateRaw)
          return socket.emit('error', {
            message: 'Game not found or finished',
          });

        const state = JSON.parse(stateRaw);
        const player = state.players.find(
          (p) => p.userId.toString() === id.toString()
        );
        if (!player)
          return socket.emit('error', { message: 'Player not in game' });

        const question = state.questions[payload.questionIndex];
        if (!question)
          return socket.emit('error', { message: 'Invalid question index' });

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
        // Save state back to Redis
        await redis.set(
          GAME_STATE_PREFIX + payload.gameId,
          JSON.stringify(state)
        );

        // Check if all players answered
        const allAnswered = state.players.every((p) =>
          p.answers.some((a) => a.questionIndex === payload.questionIndex)
        );

        if (allAnswered) {
          // Publish event for handling next question or finishing game
          pub.publish(
            'game:events',
            JSON.stringify({
              event: 'nextOrFinish',
              payload: { gameId: payload.gameId },
            })
          );
        }
      } catch (err) {
        console.error('[Socket.IO] answer:submit error', err);
        socket.emit('error', { message: 'Server error' });
      }
    });
  });
}

// Add player to matchmaking queue
async function addToQueue(userId, name) {
  const queue = await redis.lrange(MATCH_QUEUE_KEY, 0, -1);
  if (queue.includes(userId.toString())) return;
  await redis.rpush(MATCH_QUEUE_KEY, JSON.stringify({ userId, name }));
  tryMatch();
}

// Try matching players
async function tryMatch() {
  const queueLength = await redis.llen(MATCH_QUEUE_KEY);
  if (queueLength < 2) return;

  let popped = await redis.lpop(MATCH_QUEUE_KEY, 2);

  if (!popped) return;
  if (!Array.isArray(popped)) popped = [popped];

  if (popped.length < 2) {
    await redis.rpush(MATCH_QUEUE_KEY, popped[0]);
    return;
  }

  const [aRaw, bRaw] = popped;
  const a = JSON.parse(aRaw);
  const b = JSON.parse(bRaw);

  let questions =
    (await Question.aggregate([{ $sample: { size: NUM_QUESTIONS } }])) ||
    dummyQuestions;

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

  await redis.set(
    GAME_STATE_PREFIX + gameDoc._id.toString(),
    JSON.stringify(state)
  );

  // Notify players
  [a, b].forEach((p) => {
    const s = socketsByUser.get(p.userId.toString());
    if (s) {
      s.emit('game:init', {
        gameId: gameDoc._id.toString(),
        opponent: p.userId.toString() === a.userId.toString() ? b : a,
      });
      s.emit('question:send', {
        gameId: state.gameId,
        questionIndex: 0,
        question: sanitizeQuestion(state.questions[0]),
      });
    }
  });
}

// Handle next question or finish
async function handleGameEvent(event, payload) {
  if (event !== 'nextOrFinish') return;

  const stateRaw = await redis.get(GAME_STATE_PREFIX + payload.gameId);
  if (!stateRaw) return;

  const state = JSON.parse(stateRaw);
  state.currentIndex += 1;

  if (state.currentIndex >= state.questions.length) {
    state.status = 'finished';
    const [p1, p2] = state.players;
    let winnerId = null;
    if (p1.score > p2.score) winnerId = p1.userId;
    else if (p2.score > p1.score) winnerId = p2.userId;

    // Persist game
    await Game.findByIdAndUpdate(state.gameId, {
      players: state.players.map((p) => ({
        userId: p.userId,
        name: p.name,
        score: p.score,
        answers: p.answers.map((a) => ({
          questionIndex: a.questionIndex,
          selectedOption: a.selectedAnswer,
          correct: a.correct,
        })),
      })),
      currentIndex: state.currentIndex,
      status: 'finished',
      winner: winnerId,
    });

    state.players.forEach((p) => {
      const s = socketsByUser.get(p.userId.toString());
      if (s) {
        s.emit('game:end', { players: state.players, winner: winnerId });
        setTimeout(() => s.disconnect(true), 2000);
      }
    });

    await redis.del(GAME_STATE_PREFIX + payload.gameId);
  } else {
    state.players.forEach((p) => {
      const s = socketsByUser.get(p.userId.toString());
      if (s)
        s.emit('question:send', {
          gameId: state.gameId,
          questionIndex: state.currentIndex,
          question: sanitizeQuestion(state.questions[state.currentIndex]),
        });
    });
    await redis.set(GAME_STATE_PREFIX + payload.gameId, JSON.stringify(state));
  }
}

function sanitizeQuestion(q) {
  if (!q) return { text: 'No question', options: [] };
  return { text: q.text, options: q.options };
}

module.exports = { initSocket, addToQueue };
