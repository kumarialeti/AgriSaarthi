import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { chatApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Send, Mic, MicOff, Plus, Volume2, Sprout, Info } from 'lucide-react';

export default function ChatPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);

  const { data: sessionList } = useQuery({
    queryKey: ['chatSessions'],
    queryFn: () => chatApi.getSessions().then(r => r.data.data),
    retry: false,
  });

  useEffect(() => {
    if (sessionList?.length) {
      setSessions(sessionList);
      if (!currentSessionId) loadOrCreateSession(sessionList[0]?.id);
    } else {
      startNewSession();
    }
  }, [sessionList]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      const langMap = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };
      rec.lang = langMap[user?.language || i18n.language] || 'en-IN';
      rec.onresult = (e) => {
        const t = Array.from(e.results).map(r => r[0].transcript).join('');
        setInput(t);
      };
      rec.onend = () => setIsRecording(false);
      rec.onerror = () => setIsRecording(false);
      setRecognition(rec);
    }
  }, [user?.language, i18n.language]);

  const startNewSession = async () => {
    try {
      const res = await chatApi.startSession({ language: user?.language || i18n.language || 'en' });
      const session = res.data.data;
      setCurrentSessionId(session.id);
      setSessions(prev => [session, ...prev]);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: getWelcome(user?.language || i18n.language),
      }]);
    } catch (err) { console.error(err); }
  };

  const loadOrCreateSession = async (sessionId) => {
    if (!sessionId) return startNewSession();
    try {
      setCurrentSessionId(sessionId);
      const res = await chatApi.getMessages(sessionId);
      const msgs = res.data.data;
      if (msgs.length === 0) {
        setMessages([{ id: 'welcome', role: 'assistant', content: getWelcome(user?.language || i18n.language) }]);
      } else {
        setMessages(msgs.map(m => ({ id: m.id, role: m.role.toLowerCase(), content: m.content })));
      }
    } catch (err) { console.error(err); }
  };

  const getWelcome = (lang) => {
    const w = {
      en: "Hello! I'm AgriSaarthi AI 🌱 Ask me about crops, soil health, pest management, market prices, or government schemes. I'm here to help in Telugu, Hindi, or English!",
      te: "నమస్కారం! నేను అగ్రిసారథి AI 🌱 పంటలు, నేల ఆరోగ్యం, తెగుళ్ళ నిర్వహణ, మార్కెట్ ధరలు లేదా ప్రభుత్వ పథకాల గురించి అడగండి!",
      hi: "नमस्ते! मैं AgriSaarthi AI हूँ 🌱 फसलों, मिट्टी, कीट, बाज़ार, या सरकारी योजनाओं के बारे में पूछें!",
    };
    return w[lang] || w.en;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !currentSessionId || isSending) return;

    const userMsg = { id: Date.now(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const res = await chatApi.sendMessage(currentSessionId, {
        message: text,
        language: user?.language || i18n.language || 'en',
      });
      const aiMsg = res.data.data.message;
      setMessages(prev => [...prev, {
        id: aiMsg.id, role: 'assistant', content: aiMsg.content,
        agent_trace: res.data.data.agent_trace,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now(), role: 'assistant',
        content: { en: "Connection issue. Please try again.", te: "కనెక్షన్ సమస్య. మళ్ళీ ప్రయత్నించండి.", hi: "कनेक्शन समस्या। पुनः प्रयास करें।" }[user?.language] || "Connection issue. Please try again.",
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    const m = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };
    utt.lang = m[user?.language] || 'en-IN';
    window.speechSynthesis.speak(utt);
  };

  const toggleVoice = () => {
    if (!recognition) return;
    if (isRecording) { recognition.stop(); setIsRecording(false); }
    else { recognition.start(); setIsRecording(true); }
  };

  const QUICK_ASKS = [
    { en: "What crops can I grow in December?", te: "డిసెంబర్‌లో ఏ పంటలు వేయవచ్చు?", hi: "दिसंबर में कौन सी फसल लगाएं?" },
    { en: "My cotton has leaf curl. What should I do?", te: "నా పత్తిలో ఆకు మడత ఉంది. ఏం చేయాలి?", hi: "मेरे कपास में पत्ती मुड़ रही है। क्या करूं?" },
    { en: "What is PM-KISAN and am I eligible?", te: "PM-KISAN అంటే ఏమిటి మరియు నేను అర్హుడినా?", hi: "PM-KISAN क्या है और क्या मैं पात्र हूं?" },
    { en: "What is today's chilli price in Guntur?", te: "గుంటూరులో నేడు మిర్చి ధర ఎంత?", hi: "गुंटूर में आज मिर्च का भाव क्या है?" },
  ];

  const lang = user?.language || i18n.language || 'en';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--header-height) - 4rem)', gap: '1.25rem' }}>
      {/* Session List (sidebar) */}
      <div className="card" style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '1rem' }}>
        <button className="btn btn-primary btn-sm" style={{ marginBottom: '1rem' }} onClick={startNewSession}>
          <Plus size={16} /> {t('chat.newChat')}
        </button>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('chat.history')}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => loadOrCreateSession(s.id)}
              className="btn btn-ghost"
              style={{
                justifyContent: 'flex-start', textAlign: 'left', fontSize: '0.8rem', padding: '0.5rem 0.625rem',
                background: s.id === currentSessionId ? 'var(--color-green-50)' : 'transparent',
                color: s.id === currentSessionId ? 'var(--color-green-700)' : 'var(--text-secondary)',
                border: s.id === currentSessionId ? '1px solid var(--color-green-200)' : '1px solid transparent',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}
            >
              💬 {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Previous Chat'}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {/* Chat header */}
        <div style={{ padding: '1rem 1.5rem', background: 'var(--color-green-700)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, background: 'var(--color-harvest-400)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sprout size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{t('chat.title')}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{t('chat.subtitle')}</div>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Quick questions */}
          {messages.length <= 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {QUICK_ASKS.map((q, i) => (
                <button key={i} className="hero-example-chip" style={{ background: 'var(--color-green-50)', border: '1px solid var(--color-green-200)', color: 'var(--color-green-700)', padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', cursor: 'pointer' }}
                  onClick={() => { setInput(q[lang] || q.en); inputRef.current?.focus(); }}>
                  {q[lang] || q.en}
                </button>
              ))}
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{msg.content}</div>
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.375rem', gap: '0.5rem' }}>
                    <button onClick={() => speakText(msg.content)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title={t('chat.playResponse')}>
                      <Volume2 size={13} />
                    </button>
                  </div>
                )}
                {msg.agent_trace?.agents_used?.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {msg.agent_trace.agents_used.filter(a => a !== 'manager').map(a => (
                      <span key={a} className="badge badge-gray" style={{ fontSize: '0.6rem' }}>{a.replace('_agent', '')}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div className="chat-bubble chat-bubble-assistant">
                <div className="typing-dots">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t('chat.typing')}</div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={t('chat.placeholder')}
            rows={1}
            disabled={isSending}
            style={{ flex: 1, resize: 'none' }}
          />
          <button
            className={`mic-btn ${isRecording ? 'mic-btn-active' : 'mic-btn-idle'}`}
            onClick={toggleVoice}
            disabled={!recognition}
            title={isRecording ? t('chat.voiceStop') : t('chat.voiceStart')}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button className="btn btn-primary btn-icon" onClick={sendMessage} disabled={!input.trim() || isSending}>
            <Send size={18} />
          </button>
        </div>

        <div style={{ padding: '0.375rem 1.5rem 0.625rem', fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {t('chat.disclaimer')}
        </div>
      </div>
    </div>
  );
}
