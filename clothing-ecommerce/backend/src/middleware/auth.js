const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

async function userFromRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.isBlocked) return null;
    return user;
  } catch {
    return null;
  }
}

// Attaches req.user if a valid token is sent, but never blocks the request
async function optionalAuth(req, _res, next) {
  req.user = await userFromRequest(req);
  next();
}

async function protect(req, res, next) {
  req.user = await userFromRequest(req);
  if (!req.user) return res.status(401).json({ message: 'Please log in to continue' });
  next();
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  next();
}

function isApprovedWholesale(user) {
  return !!user && user.role === 'wholesale' && user.wholesaleStatus === 'approved';
}

module.exports = { signToken, optionalAuth, protect, adminOnly, isApprovedWholesale };
