import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, RotateCcw, ChevronDown, Zap, Clock, Brain, MessageSquare } from 'lucide-react';
import AdminLayout from '../../layouts/AdminLayout';

interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  text: string;
  timestamp: string;
  analysis?: {
    intentCategories: string[];
    modelTier: string;
    modelId: string;
    isNewCustomer: boolean;
    conversationLength: number;
  };
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  responseTime?: number;
  loading?: boolean;
}

const QUICK_MESSAGES = [
  { label: ' Masaj fiyatları', text: 'masaj fiyatları ne kadar' },
  { label: ' Çalışma saatleri', text: 'saat kaça kadar açıksınız' },
  { label: ' Adres', text: 'adresiniz nerede' },
  { label: ' Üyelik', text: 'spor salonu üyelik fiyatları' },
  { label: ' Çocuk kursları', text: 'çocuk kursları var mı' },
  { label: ' Merhaba', text: 'merhaba bilgi almak istiyorum' },
  { label: ' Kese köpük', text: 'kese köpük kim yapıyor' },
  { label: ' Block test', text: 'mutlu son var mı' },
  { label: ' Çoklu soru', text: 'masaj fiyatları ve çalışma saatleri nedir' },
  { label: ' Pilates', text: 'reformer pilates var mı fiyatı ne kadar' },
];

function tierColor(tier: string) {
  if (tier === 'light') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (tier === 'advanced') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
}

export default function WorkflowTestPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [senderId] = useState(() => `sim_${Date.now()}`);
  const [showQuick, setShowQuick] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setShowQuick(false);

    const userMsg: ChatMessage = {
      id: `in_${Date.now()}`,
      direction: 'inbound',
      text: msg,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };
    const loadingMsg: ChatMessage = {
      id: `out_${Date.now()}`,
      direction: 'outbound',
      text: '',
      timestamp: '',
      loading: true,
    };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/workflow-test/simulate-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg, senderId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => prev.map(m => m.loading ? {
          ...m, loading: false, text: ` ${data.error || 'Hata oluştu'}`, timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        } : m));
        return;
      }

      setMessages(prev => prev.map(m => m.loading ? {
        ...m,
        loading: false,
        text: data.response,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        analysis: data.analysis,
        usage: data.usage,
        responseTime: data.responseTime,
      } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.loading ? {
        ...m, loading: false, text: ` Bağlantı hatası`, timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      } : m));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = async () => {
    try {
      await fetch(`/api/workflow-test/conversation/${senderId}`, { method: 'DELETE', credentials: 'include' });
    } catch { /* ignore */ }
    setMessages([]);
    setShowQuick(true);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Instagram DM Simülatörü</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ajan: Eform Instagram Asistanı  Sender: <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 rounded">{senderId}</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowQuick(q => !q)} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="Hızlı mesajlar">
              <ChevronDown className={`w-4 h-4 transition-transform ${showQuick ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={clearChat} className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="Sohbeti temizle">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Quick Messages */}
        {showQuick && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MESSAGES.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q.text)} disabled={loading}
                  className="px-2.5 py-1 text-xs rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-colors">
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50 dark:bg-gray-950">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500">
              <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">Instagram DM ajanını test etmek için bir mesaj gönderin</p>
              <p className="text-xs mt-1">Gerçek pipeline: Intent Detection  Model Routing  Knowledge Fetch  AI Response</p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${msg.direction === 'inbound' ? 'order-1' : 'order-2'}`}>
                {/* Avatar + Bubble */}
                <div className={`flex items-end gap-2 ${msg.direction === 'inbound' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.direction === 'inbound'
                      ? 'bg-blue-500'
                      : 'bg-gradient-to-br from-purple-500 to-pink-500'
                  }`}>
                    {msg.direction === 'inbound'
                      ? <User className="w-3.5 h-3.5 text-white" />
                      : <Bot className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className={`rounded-2xl px-4 py-2.5 ${
                    msg.direction === 'inbound'
                      ? 'bg-blue-500 text-white rounded-br-md'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md'
                  }`}>
                    {msg.loading ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    )}
                  </div>
                </div>

                {/* Metadata (only for outbound AI responses) */}
                {msg.direction === 'outbound' && !msg.loading && msg.analysis && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-9 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded ${tierColor(msg.analysis.modelTier)}`}>
                      <Zap className="w-2.5 h-2.5 inline mr-0.5" />
                      {msg.analysis.modelTier}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      {msg.analysis.modelId?.split('/').pop()}
                    </span>
                    {msg.analysis.intentCategories?.map(cat => (
                      <span key={cat} className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        <Brain className="w-2.5 h-2.5 inline mr-0.5" />{cat}
                      </span>
                    ))}
                    {msg.responseTime && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        <Clock className="w-2.5 h-2.5 inline mr-0.5" />{msg.responseTime}ms
                      </span>
                    )}
                    {msg.usage?.total_tokens && (
                      <span className="text-gray-400 dark:text-gray-500">{msg.usage.total_tokens} tok</span>
                    )}
                    {msg.analysis.isNewCustomer && (
                      <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">yeni müşteri</span>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                {!msg.loading && msg.timestamp && (
                  <p className={`text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ${msg.direction === 'inbound' ? 'text-right mr-9' : 'ml-9'}`}>
                    {msg.timestamp}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Mesaj yaz..."
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 placeholder-gray-400"
              autoFocus
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 text-center">
            Pipeline: InstagramContextService  Knowledge Fetch  OpenRouter ({messages.filter(m => m.direction === 'outbound' && !m.loading).length} yanıt)
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}