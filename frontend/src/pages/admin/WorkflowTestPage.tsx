import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Bot, AlertTriangle, CheckCircle, XCircle, HelpCircle, Loader2, Info } from 'lucide-react';

interface TestResult {
  status: string;
  response: string;
  intent: string;
  safetyDecision: string;
  safetyReason?: string;
  processingTime: number;
  debug?: {
    normalizedText: string;
    detectedIntent: string;
    knowledgeCategories: string[];
    contextLength: number;
    faqEntries?: string[];
  };
  aiContext?: {
    systemPrompt: string;
    knowledgeContext: string;
    userMessage: string;
  };
}

interface IntentInfo {
  description: string;
  keywords: string[];
  examples: string[];
}

export default function WorkflowTestPage() {
  useTranslation('admin');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIntents, setShowIntents] = useState(false);
  const [intents, setIntents] = useState<Record<string, IntentInfo> | null>(null);
  const [useFullSimulation, setUseFullSimulation] = useState(false);

  const apiKey = (import.meta.env.VITE_N8N_API_KEY as string) || 'test-key';

  const testMessages = [
    { label: 'FAQ: Kadınlar günü', message: 'kadınlar günü var mı' },
    { label: 'FAQ: Kese köpük', message: 'kese köpük kim yapıyor' },
    { label: 'FAQ: PT var mı', message: 'PT var mı' },
    { label: 'FAQ: Ne getirmeliyim', message: 'yanımda ne getirmeliyim' },
    { label: 'Fiyat sorgusu', message: 'masaj fiyatları ne kadar' },
    { label: 'Üyelik', message: 'spor salonu üyelik fiyatları' },
    { label: 'Çalışma saatleri', message: 'saat kaça kadar açıksınız' },
    { label: 'Adres', message: 'adres nerede' },
    { label: 'Merhaba', message: 'merhaba bilgi almak istiyorum' },
    { label: '⚠️ Block test', message: 'mutlu son var mı' },
  ];

  const handleTest = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const endpoint = useFullSimulation ? '/api/workflow-test/simulate-full' : '/api/workflow-test/simulate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ message: message.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Test failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadIntents = async () => {
    try {
      const response = await fetch('/api/workflow-test/intents');
      const data = await response.json();
      setIntents(data.intents);
      setShowIntents(true);
    } catch (err) {
      console.error('Failed to load intents:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'allowed':
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'blocked':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'unsure':
        return <HelpCircle className="w-5 h-5 text-yellow-500" />;
      case 'ignored':
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'allowed':
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'blocked':
        return 'bg-red-50 border-red-200';
      case 'unsure':
        return 'bg-yellow-50 border-yellow-200';
      case 'ignored':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-7 h-7" />
          Workflow Test / Demo
        </h1>
        <p className="text-gray-600 mt-1">
          Test Instagram DM workflow without needing Instagram. Simulates the full n8n workflow locally.
        </p>
      </div>

      {/* Quick Test Buttons */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-3">Quick Tests:</h3>
        <div className="flex flex-wrap gap-2">
          {testMessages.map((test, idx) => (
            <button
              key={idx}
              onClick={() => setMessage(test.message)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                test.label.includes('⚠️') 
                  ? 'bg-red-50 border-red-200 hover:bg-red-100' 
                  : 'bg-white border-gray-200 hover:bg-gray-100'
              }`}
            >
              {test.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleTest()}
            placeholder="Type a message to test (e.g., 'kadınlar günü var mı')"
            className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleTest}
            disabled={loading || !message.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Test
          </button>
        </div>
        
        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useFullSimulation}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseFullSimulation(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Full simulation (calls OpenRouter AI)</span>
          </label>
          <button
            onClick={loadIntents}
            className="text-sm text-blue-600 hover:underline"
          >
            View all intents →
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className={`mb-6 p-4 border rounded-lg ${getStatusColor(result.status)}`}>
          <div className="flex items-center gap-2 mb-3">
            {getStatusIcon(result.status)}
            <span className="font-medium capitalize">{result.status}</span>
            <span className="text-sm text-gray-500">• {result.processingTime}ms</span>
            <span className="ml-auto px-2 py-0.5 bg-white rounded text-sm">
              Intent: <strong>{result.intent}</strong>
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg mb-4">
            <h4 className="font-medium mb-2">Response:</h4>
            <p className="whitespace-pre-wrap">{result.response}</p>
          </div>

          {result.safetyReason && (
            <div className="text-sm text-gray-600 mb-2">
              <strong>Safety:</strong> {result.safetyDecision} - {result.safetyReason}
            </div>
          )}

          {result.debug && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                Debug Info
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded text-sm font-mono">
                <div><strong>Normalized:</strong> {result.debug.normalizedText}</div>
                <div><strong>Detected Intent:</strong> {result.debug.detectedIntent}</div>
                <div><strong>Knowledge Categories:</strong> {result.debug.knowledgeCategories?.join(', ')}</div>
                <div><strong>Context Length:</strong> {result.debug.contextLength} chars</div>
                {result.debug.faqEntries && result.debug.faqEntries.length > 0 && (
                  <div><strong>FAQ Entries:</strong> {result.debug.faqEntries.join(', ')}</div>
                )}
              </div>
            </details>
          )}

          {result.aiContext && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                AI Context (what would be sent to AI)
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded text-sm">
                <div className="mb-2">
                  <strong>System Prompt:</strong>
                  <pre className="mt-1 whitespace-pre-wrap text-xs bg-white p-2 rounded">{result.aiContext.systemPrompt}</pre>
                </div>
                <div>
                  <strong>Knowledge Context:</strong>
                  <pre className="mt-1 whitespace-pre-wrap text-xs bg-white p-2 rounded max-h-96 overflow-auto">{result.aiContext.knowledgeContext}</pre>
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Intents Modal */}
      {showIntents && intents && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowIntents(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Supported Intents</h2>
            <div className="space-y-4">
              {Object.entries(intents).map(([key, info]: [string, IntentInfo]) => (
                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium">{key}</h3>
                  <p className="text-sm text-gray-600">{info.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {info.keywords.map((kw: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{kw}</span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Examples: {info.examples.join(' | ')}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowIntents(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
