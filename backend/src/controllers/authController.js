import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { signToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

// ─── Validation Rules ────────────────────────────────────────────
export const validateRegister = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('role')
    .optional()
    .isIn(['FARMER', 'BUYER', 'AGRICULTURE_OFFICER'])
    .withMessage('Invalid role'),
  body('language').optional().isIn(['en', 'te', 'hi']).withMessage('Invalid language'),
];

export const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

// ─── Register ────────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, role = 'FARMER', language = 'en' } = req.body;

    // Check duplicate email
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await query(
      `INSERT INTO users (email, password_hash, role, language)
       VALUES ($1, $2, $3, $4) RETURNING id, email, role, language, created_at`,
      [email, password_hash, role, language]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    logger.info('New user registered', { userId: user.id, role: user.role });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { user, token },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Login ───────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const result = await query(
      'SELECT id, email, password_hash, role, language, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Please contact support.',
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    logger.info('User logged in', { userId: user.id, role: user.role });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          language: user.language,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get current user (me) ───────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.role, u.language, u.created_at,
              fp.id as farmer_profile_id, fp.full_name, fp.district, fp.state, fp.total_land_acres,
              bp.id as buyer_profile_id, bp.company_name
       FROM users u
       LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
       LEFT JOIN buyer_profiles bp ON bp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── Update language preference ──────────────────────────────────
export const updateLanguage = async (req, res, next) => {
  try {
    const { language } = req.body;
    if (!['en', 'te', 'hi'].includes(language)) {
      return res.status(400).json({ success: false, error: 'Invalid language code.' });
    }

    await query('UPDATE users SET language = $1 WHERE id = $2', [language, req.user.id]);
    res.json({ success: true, message: 'Language updated.', data: { language } });
  } catch (err) {
    next(err);
  }
};
