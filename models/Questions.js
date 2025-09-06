const mongoose = require('mongoose');
const QuestionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    options: { type: [String], required: true },
    correctAnswer: { type: String, required: true },
    category: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      required: true,
    },
    points: { type: Number, default: 10 },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Question', QuestionSchema);
