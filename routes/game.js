const express = require('express');
const router = express.Router();
const { addToQueue } = require('../sockets/gameSockets');
const { authenticateToken } = require('../middlewares/auth');

router.post('/start', authenticateToken, async (req, res) => {
  try {
    addToQueue(req.user.id, req.user.name || null);
    return res.status(200).json({ message: 'Added to matchmaking queue' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
