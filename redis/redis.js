const Redis = require('ioredis');
const { REDIS_URL } = require('../config/config');

const redis = new Redis(REDIS_URL); // general purpose / shared data
const pub = new Redis(REDIS_URL); // publisher
const sub = new Redis(REDIS_URL); // subscriber

// Redis keys
const MATCH_QUEUE_KEY = 'game:queue';
const GAME_STATE_PREFIX = 'game:state:';

module.exports = {
  redis,
  pub,
  sub,
  MATCH_QUEUE_KEY,
  GAME_STATE_PREFIX,
};
