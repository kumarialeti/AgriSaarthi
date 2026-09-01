import { query } from '../db/pool.js';

export const getAdminStats = async (req, res, next) => {
  try {
    const [
      usersRes, farmersRes, buyersRes, cropsRes, cropDistRes,
      schemesRes, messagesRes, agentLogsRes
    ] = await Promise.all([
      query('SELECT COUNT(*) as total, role FROM users GROUP BY role'),
      query('SELECT COUNT(*) as total FROM farmer_profiles'),
      query('SELECT COUNT(*) as total FROM buyer_profiles'),
      query(`SELECT COUNT(*) as total, status FROM farmer_crops GROUP BY status`),
      query(`SELECT c.name_en as crop, COUNT(fc.id) as count
             FROM farmer_crops fc JOIN crops c ON c.id = fc.crop_id
             GROUP BY c.name_en ORDER BY count DESC LIMIT 10`),
      query('SELECT COUNT(*) as total FROM government_schemes WHERE is_active=true'),
      query(`SELECT COUNT(*) as total FROM chat_messages WHERE created_at > NOW() - INTERVAL '30 days'`),
      query(`SELECT agent_name, COUNT(*) as count, AVG(duration_ms) as avg_ms
             FROM agent_logs WHERE created_at > NOW() - INTERVAL '7 days'
             GROUP BY agent_name ORDER BY count DESC`),
    ]);

    const usersByRole = {};
    for (const row of usersRes.rows) {
      usersByRole[row.role] = parseInt(row.total);
    }

    const cropsByStatus = {};
    for (const row of cropsRes.rows) {
      cropsByStatus[row.status] = parseInt(row.total);
    }

    res.json({
      success: true,
      data: {
        users: {
          by_role: usersByRole,
          total: Object.values(usersByRole).reduce((a, b) => a + b, 0),
        },
        farmers: parseInt(farmersRes.rows[0].total),
        buyers: parseInt(buyersRes.rows[0].total),
        crops: {
          by_status: cropsByStatus,
          total: Object.values(cropsByStatus).reduce((a, b) => a + b, 0),
          distribution: cropDistRes.rows,
        },
        schemes: parseInt(schemesRes.rows[0].total),
        chat_messages_30d: parseInt(messagesRes.rows[0].total),
        agent_activity_7d: agentLogsRes.rows,
      },
    });
  } catch (err) { next(err); }
};

export const getAllFarmers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT fp.*, u.email, u.language, u.created_at as user_created_at,
              COUNT(fc.id) as crop_count
       FROM farmer_profiles fp
       JOIN users u ON u.id = fp.user_id
       LEFT JOIN farmer_crops fc ON fc.farmer_id = fp.id
       GROUP BY fp.id, u.email, u.language, u.created_at
       ORDER BY fp.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countRes = await query('SELECT COUNT(*) as total FROM farmer_profiles');
    res.json({
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countRes.rows[0].total) },
    });
  } catch (err) { next(err); }
};

export const getMarketTrends = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.name_en as crop, m.name as market, mp.modal_price_quintal, mp.price_date
       FROM market_prices mp JOIN crops c ON c.id=mp.crop_id JOIN markets m ON m.id=mp.market_id
       WHERE mp.price_date >= NOW() - INTERVAL '30 days'
       ORDER BY mp.price_date DESC, mp.modal_price_quintal DESC LIMIT 100`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};
