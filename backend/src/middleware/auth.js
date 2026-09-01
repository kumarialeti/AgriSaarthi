import { verifyToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware: authenticate JWT from Authorization header.
 * Sets req.user = { id, email, role } on success.
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid token.',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid authorization attempt', { error: err.message, ip: req.ip });
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token. Please login again.',
    });
  }
};

/**
 * Middleware factory: authorize by role(s).
 * Usage: authorize('ADMIN') or authorize('ADMIN', 'AGRICULTURE_OFFICER')
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed', { userId: req.user.id, role: req.user.role, required: roles });
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this resource.',
      });
    }
    next();
  };
};
