const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/config');
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = { authenticateToken };
