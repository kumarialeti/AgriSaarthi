import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { chatApi } from '../services/api';
import { Send, Mic, MicOff, X, ImagePlus, Volume2, ChevronDown, Sprout } from 'lucide-react';

export default function ChatModal({ onClose, initialMessage = '' }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(initialMessage);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [error, setError] = useState('');

  // Initialize chat session
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await chatApi.startSession({ language: user?.language || i18n.language || 'en' });
        setSessionId(res.data.data.id);

        // Welcome message
        const greetings = {
          en: "Hello! I'm AgriSaarthi AI, your agricultural assistant. Ask me anything about your crops, soil, weather, market prices, or government schemes. I'm here to help! 🌱",
          te: "నమస్కారం! నేను అగ్రిసారథి AI, మీ వ్యవసాయ సహాయకుడు. మీ పంటలు, నేల, వాతావరణం, మార్కెట్ ధరలు, లేదా ప్రభుత్వ పథకాల గురించి ఏదైనా అడగండి! 🌱",
          hi: "नमस्ते! मैं AgriSaarthi AI हूँ, आपका कृषि सहायक। अपनी फसलों, मिट्टी, मौसम, बाज़ार मूल्यों, या सरकारी योजनाओं के बारे में कुछ भी पूछें! 🌱",
        };
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: greetings[user?.language || i18n.language] || greetings.en,
        }]);
      } catch (err) {
        setError('Failed to start chat session. Please try again.');
      }
    };
    initSession();
  }, []);

  // Send initial message if provided
  useEffect(() => {
    if (sessionId && initialMessage?.trim()) {
      sendMessage(initialMessage);
      setInput('');
    }
  }, [sessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Voice input setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;

      const langMap = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };
      rec.lang = langMap[user?.language || i18n.language] || 'en-IN';

      rec.onresult = (e) => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
        setInput(transcript);
      };

      rec.onend = () => setIsRecording(false);
      rec.onerror = () => setIsRecording(false);
      setRecognition(rec);
    }
    return () => recognition?.abort();
  }, [user?.language, i18n.language]);

  const toggleVoice = () => {
    if (!recognition) return;
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      recognition.start();
      setIsRecording(true);
    }
  };

  const sendMessage = async (text) => {
    const message = (text || input).trim();
    if (!message || !sessionId) return;

    const userMsg = { id: Date.now(), role: 'user', content: message };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      const res = await chatApi.sendMessage(sessionId, {
        message,
        language: user?.language || i18n.language || 'en',
      });
      const aiMsg = res.data.data.message;
      setMessages(prev => [...prev, {
        id: aiMsg.id,
        role: 'assistant',
        content: aiMsg.content,
        agent_trace: res.data.data.agent_trace,
      }]);
    } catch (err) {
      const fallback = {
        en: "I'm having trouble connecting. Please try again.",
        te: "కనెక్ట్ చేయడంలో సమస్య. దయచేసి మళ్ళీ ప్రయత్నించండి.",
        hi: "कनेक्ट करने में समस्या। कृपया पुनः प्रयास करें।",
      };
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: fallback[user?.language] || fallback.en,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    const utt = new SpeechSynthesisUtterance(text);
    const langMap = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };
    utt.lang = langMap[user?.language] || 'en-IN';
    window.speechSynthesis.speak(utt);
  };

  return (
    <div className="chat-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="chat-modal">
        {/* Header */}
        <div className="chat-modal-header">
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, background: 'var(--color-harvest-400)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sprout size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>{t('chat.title')}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{t('chat.subtitle')}</div>
            </div>
          </div>
          <button className="btn btn-icon" onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {error && <div className="alert alert-error" style={{ fontSize: '0.8rem' }}>{error}</div>}

          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => speakText(msg.content)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                      title={t('chat.playResponse')}
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                )}

                {msg.agent_trace && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {msg.agent_trace.agents_used?.map(a => (
                      <span key={a} className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{a.replace('_agent', '')}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
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

        {/* Input area */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={t('chat.placeholder')}
            rows={1}
            disabled={isLoading || !sessionId}
          />

          <button
            className={`mic-btn ${isRecording ? 'mic-btn-active' : 'mic-btn-idle'}`}
            onClick={toggleVoice}
            disabled={!recognition}
            title={recognition ? (isRecording ? t('chat.voiceStop') : t('chat.voiceStart')) : t('chat.voiceUnavailable')}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            className="btn btn-primary btn-icon"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading || !sessionId}
          >
            <Send size={18} />
          </button>
        </div>

        {/* Disclaimer */}
        <div style={{ padding: '0.5rem 1rem 0.75rem', fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {t('chat.disclaimer')}
        </div>
      </div>

      <style>{`
        .chat-modal-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: flex-end; justify-content: flex-end;
          padding: 1rem;
        }
        .chat-modal {
          width: 420px; max-width: 100%;
          height: 600px; max-height: calc(100vh - 2rem);
          background: white;
          border-radius: var(--radius-xl);
          display: flex; flex-direction: column;
          box-shadow: var(--shadow-xl);
          animation: fadeInUp 0.3s ease;
          overflow: hidden;
        }
        .chat-modal-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 1rem 1.25rem;
          background: var(--color-green-700);
        }
        @media (max-width: 480px) {
          .chat-modal-overlay { padding: 0; align-items: flex-end; }
          .chat-modal { width: 100%; border-radius: var(--radius-xl) var(--radius-xl) 0 0; height: 80vh; }
        }
      `}</style>
    </div>
  );
}
