require('dotenv').config();
module.exports = {
  MONGO_URI: process.env.MONGO_URI || 'mongodb://mongo:27017/quiz',
  JWT_SECRET: process.env.JWT_SECRET || 'replace-this-secret',
  PORT: process.env.PORT || 3000,
  NUM_QUESTIONS: Number(process.env.NUM_QUESTIONS || 4),
  REDIS_HOST: process.env.REDIS_HOST || 'redis',
  REDIS_PORT: Number(process.env.REDIS_PORT || 6379),
  REDIS_URL: `redis://${process.env.REDIS_HOST || 'redis'}:${
    process.env.REDIS_PORT || 6379
  }`,
};
