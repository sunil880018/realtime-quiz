const Question = require('../models/Questions');
const questions = require('./questions.json');

async function ingestQuestions() {
  try {
    await Question.deleteMany({});
    await Question.insertMany(questions);

    console.log('Questions ingested successfully');
  } catch (error) {
    console.error('Error ingesting questions:', error);
  }
}
module.exports = { ingestQuestions };
