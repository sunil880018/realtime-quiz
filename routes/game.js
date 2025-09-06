const express = require('express');
const router = express.Router();
const { addToQueue } = require('../sockets/gameSockets');
const { authenticateToken } = require('../middlewares/auth');

router.post('/start', authenticateToken, async (req, res) => {
  try {
    // attach user name by fetching from DB if needed
    addToQueue(req.user.id, req.user.name || 'Anonymous');
    return res.status(200).json({ message: 'Added to matchmaking queue' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// Now your login → token → socket → game flow is consistent.
