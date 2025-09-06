require('dotenv').config();
module.exports = {
  MONGO_URI: process.env.MONGO_URI || 'mongodb://mongo:27017/quiz',
  JWT_SECRET: process.env.JWT_SECRET || 'replace-this-secret',
  PORT: process.env.PORT || 3000,
  NUM_QUESTIONS: Number(process.env.NUM_QUESTIONS || 1),
};
