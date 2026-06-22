const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'patavo-dev-secret-change-me';

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

// Middleware: exige un JWT válido (inicio de sesión en toda la app).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, requireAuth, SECRET };
