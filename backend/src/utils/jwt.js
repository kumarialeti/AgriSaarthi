import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_change_in_prod';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Sign a JWT token for a user.
 * @param {Object} payload - { id, email, role }
 */
export const signToken = (payload) => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
};

/**
 * Verify and decode a JWT token.
 * @param {string} token
 */
export const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
};

export default { signToken, verifyToken };
