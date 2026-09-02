import { query } from '../db/pool.js';
import axios from 'axios';
import { logger } from '../utils/logger.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

// ─── Chat session management ────────────────────────────────────
export const startSession = async (req, res, next) => {
  try {
    const { language } = req.body;
    const lang = language || req.user.language || 'en';

    const result = await query(
      'INSERT INTO chat_sessions (user_id, language) VALUES ($1, $2) RETURNING *',
      [req.user.id, lang]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

export const getSessions = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cs.*, COUNT(cm.id) as message_count
       FROM chat_sessions cs LEFT JOIN chat_messages cm ON cm.session_id = cs.id
       WHERE cs.user_id=$1 GROUP BY cs.id ORDER BY cs.started_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

export const getSessionMessages = async (req, res, next) => {
  try {
    const { session_id } = req.params;

    // Verify session belongs to user
    const sessionCheck = await query(
      'SELECT id FROM chat_sessions WHERE id=$1 AND user_id=$2',
      [session_id, req.user.id]
    );
    if (!sessionCheck.rows.length) {
      return res.status(404).json({ success: false, error: 'Session not found.' });
    }

    const result = await query(
      'SELECT * FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC',
      [session_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─── Send message (routes to AI service) ───────────────────────
export const sendMessage = async (req, res, next) => {
  try {
    const { session_id, message, language, image_url } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }

    // Verify session
    const sessionRes = await query(
      'SELECT * FROM chat_sessions WHERE id=$1 AND user_id=$2',
      [session_id, req.user.id]
    );
    if (!sessionRes.rows.length) {
      return res.status(404).json({ success: false, error: 'Chat session not found.' });
    }

    const session = sessionRes.rows[0];
    const lang = language || session.language || 'en';

    // Store user message
    await query(
      'INSERT INTO chat_messages (session_id, role, content, image_url) VALUES ($1, $2, $3, $4)',
      [session_id, 'user', message, image_url || null]
    );

    // Get farmer context for AI
    const farmerCtx = await query(
      `SELECT fp.full_name, fp.district, fp.state, fp.location_lat, fp.location_lng, fp.farming_experience_years, fp.farming_preference,
              json_agg(json_build_object('crop', c.name_en, 'status', fc.status, 'acreage', fc.acreage, 'variety', fc.variety, 'growth_stage', fc.growth_stage)) as crops,
              (SELECT row_to_json(sr) FROM soil_reports sr WHERE sr.farmer_id = fp.id ORDER BY sr.created_at DESC LIMIT 1) as latest_soil
       FROM farmer_profiles fp
       LEFT JOIN farmer_crops fc ON fc.farmer_id = fp.id
       LEFT JOIN crops c ON c.id = fc.crop_id
       WHERE fp.user_id = $1
       GROUP BY fp.id`,
      [req.user.id]
    );

    // Ensure we handle missing_context gracefully in the AI prompt if data is incomplete
    const farmerContext = farmerCtx.rows[0] || { missing_context: true };

    // Get conversation history (last 10 messages)
    const historyRes = await query(
      `SELECT role, content FROM chat_messages WHERE session_id=$1
       ORDER BY created_at DESC LIMIT 10`,
      [session_id]
    );
    const history = historyRes.rows.reverse();

    // Call AI service
    let aiResponse;
    let agentTrace = null;
    const startTime = Date.now();

    try {
      const aiRes = await axios.post(
        `${AI_SERVICE_URL}/ai/chat`,
        {
          message,
          language: lang,
          session_id,
          farmer_context: farmerContext,
          history,
          image_url,
        },
        { timeout: 90000 }
      );

      aiResponse = aiRes.data.response;
      agentTrace = aiRes.data.agent_trace || null;
    } catch (aiErr) {
      logger.warn('AI service unavailable', { error: aiErr.message });
      // Graceful fallback response
      const fallbacks = {
        en: "I'm sorry, the AI assistant is temporarily unavailable. Please try again in a moment. For urgent crop issues, please contact your local Krishi Vigyan Kendra (KVK).",
        te: "క్షమించండి, AI సహాయకుడు తాత్కాలికంగా అందుబాటులో లేరు. దయచేసి మళ్ళీ ప్రయత్నించండి.",
        hi: "क्षमा करें, AI सहायक अस्थायी रूप से उपलब्ध नहीं है। कृपया थोड़ी देर बाद पुनः प्रयास करें।",
      };
      aiResponse = fallbacks[lang] || fallbacks.en;
    }

    const duration_ms = Date.now() - startTime;

    // Store AI response
    const msgResult = await query(
      'INSERT INTO chat_messages (session_id, role, content, agent_trace) VALUES ($1, $2, $3, $4) RETURNING *',
      [session_id, 'assistant', aiResponse, agentTrace ? JSON.stringify(agentTrace) : null]
    );

    // Log agent activity
    if (agentTrace) {
      await query(
        `INSERT INTO agent_logs (chat_session_id, user_id, agent_name, intent, input_summary, output_summary, agents_used, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [session_id, req.user.id, 'manager', agentTrace.intent, message.substring(0, 200),
         aiResponse.substring(0, 200), agentTrace.agents_used || [], duration_ms]
      ).catch((e) => logger.warn('Agent log insert failed', { error: e.message }));
    }

    res.json({
      success: true,
      data: {
        message: msgResult.rows[0],
        agent_trace: agentTrace,
      },
    });
  } catch (err) { next(err); }
};
