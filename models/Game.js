const mongoose = require('mongoose');
const GameSchema = new mongoose.Schema(
  {
    players: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: String,
        score: { type: Number, default: 0 },
        answers: [
          {
            questionIndex: Number,
            selectedOption: String, // store actual option
            correct: Boolean,
          },
        ],
      },
    ],
    questions: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        questionText: String,
        options: [String],
        correctAnswer: String,
        points: Number,
      },
    ],
    currentIndex: { type: Number, default: 0 },
    status: {
      type: String, 
      enum: ['pending', 'active', 'finished'],
      default: 'pending',
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Game', GameSchema);
