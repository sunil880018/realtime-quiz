const mongoose = require('mongoose');
const Question = require('../models/Questions');
const { connectDB } = require('../database/connections');

const questions = [
  {
    questionText: 'What is the capital of France?',
    options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
    correctAnswer: 'Paris',
    category: 'Geography',
    difficulty: 'Easy',
    points: 10,
  },
  {
    questionText: 'Who wrote "To Kill a Mockingbird"?',
    options: [
      'Harper Lee',
      'Mark Twain',
      'F. Scott Fitzgerald',
      'Ernest Hemingway',
    ],
    correctAnswer: 'Harper Lee',
    category: 'Literature',
    difficulty: 'Medium',
    points: 20,
  },
  {
    questionText: 'What is the powerhouse of the cell?',
    options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Endoplasmic Reticulum'],
    correctAnswer: 'Mitochondria',
    category: 'Science',
    difficulty: 'Easy',
    points: 10,
  },
  {
    questionText: 'What is the largest planet in our solar system?',
    options: ['Earth', 'Mars', 'Jupiter', 'Saturn'],
    correctAnswer: 'Jupiter',
    category: 'Science',
    difficulty: 'Easy',
    points: 10,
  },
  {
    questionText: 'Who painted the Mona Lisa?',
    options: [
      'Vincent van Gogh',
      'Pablo Picasso',
      'Leonardo da Vinci',
      'Claude Monet',
    ],
    correctAnswer: 'Leonardo da Vinci',
    category: 'Art',
    difficulty: 'Medium',
    points: 20,
  },
];

async function ingestQuestions() {
  try {
    await connectDB();
    console.log('DB connected');
    await Question.deleteMany({});
    await Question.insertMany(questions);

    console.log('Questions ingested successfully');
  } catch (error) {
    console.error('Error ingesting questions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('DB connection closed');
  }
}

// Run the script
ingestQuestions();
