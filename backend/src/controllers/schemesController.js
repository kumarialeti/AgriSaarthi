import { query } from '../db/pool.js';

// ─── Government Schemes ─────────────────────────────────────────
export const getSchemes = async (req, res, next) => {
  try {
    const { state, search } = req.query;
    let sql = 'SELECT * FROM government_schemes WHERE is_active = true';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name_en ILIKE $${params.length} OR benefits_en ILIKE $${params.length} OR eligibility_en ILIKE $${params.length})`;
    }

    sql += ' ORDER BY name_en';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

export const getSchemeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM government_schemes WHERE id=$1 OR scheme_code=$1', [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Scheme not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─── Notifications ─────────────────────────────────────────────
export const getNotifications = async (req, res, next) => {
  try {
    const { unread_only } = req.query;
    let sql = 'SELECT * FROM notifications WHERE user_id=$1';
    if (unread_only === 'true') sql += ' AND is_read = false';
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const result = await query(sql, [req.user.id]);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2', [id, req.user.id]);
    res.json({ success: true, message: 'Marked as read.' });
  } catch (err) { next(err); }
};

export const markAllRead = async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read=true WHERE user_id=$1', [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { next(err); }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id=$1 AND is_read=false',
      [req.user.id]
    );
    res.json({ success: true, data: { count: parseInt(result.rows[0].count) } });
  } catch (err) { next(err); }
};

// ─── Recommendations ──────────────────────────────────────────
export const getRecommendations = async (req, res, next) => {
  try {
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.json({ success: true, data: [] });

    const result = await query(
      'SELECT * FROM recommendations WHERE farmer_id=$1 ORDER BY created_at DESC LIMIT 20',
      [farmerRes.rows[0].id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};
