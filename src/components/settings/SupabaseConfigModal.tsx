import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Database,
  Sparkles,
  HardDrive,
  ShieldCheck,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  DownloadCloud,
} from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  resetSupabaseClient,
  testSupabaseConnection,
  normalizeSupabaseUrl,
  SUPABASE_SQL_SCHEMA,
} from '../../services/supabaseClient';
import { dbStore } from '../../services/dbStore';
import { useLanguage } from '../../services/languageContext';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const [config, setConfig] = useState(getStoredSupabaseConfig());
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    hasTables: boolean;
    hasBucket: boolean;
  } | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'schema' | 'freetier'>('config');

  if (!isOpen) return null;

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = normalizeSupabaseUrl(config.url);
    const cleanKey = config.anonKey.trim();
    const updated = {
      ...config,
      url: cleanUrl,
      anonKey: cleanKey,
      isConnected: Boolean(cleanUrl && cleanKey),
    };
    saveStoredSupabaseConfig(updated);
    resetSupabaseClient(updated);
    setConfig(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    handleTestConnection();
  };

  const handlePushData = async () => {
    setIsPushing(true);
    setPushStatus(null);
    try {
      const res = await dbStore.pushToSupabase();
      setPushStatus(res.message);
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullData = async () => {
    setIsPulling(true);
    setPullStatus(null);
    try {
      const res = await dbStore.pullFromSupabase();
      setPullStatus(res.message);
    } finally {
      setIsPulling(false);
    }
  };

  const handlePurgeNow = () => {
    const count = dbStore.purgeMonthlyScans();
    alert(
      language === 'en'
        ? `Monthly auto-purge completed: ${count} scans older than 30 days removed.`
        : `ऑटो-पर्ज पूर्ण: 30 दिन से पुराने ${count} स्कैन रिकॉर्ड हटा दिए गए।`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 text-slate-900 shadow-2xl relative my-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>Supabase Live Cloud Database</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    config.isConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {config.isConnected ? '✓ Configured' : '● Local Storage Mode'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'en'
                  ? 'Realtime multi-device cloud synchronization & persistent storage'
                  : 'रियल-टाइम मल्टी-डिवाइस डेटा सिंक व सुरक्षित क्लाउड बैकअप'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 my-3 border-b border-slate-100 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeTab === 'config'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            1. {language === 'en' ? 'API Credentials (Connect)' : 'API विवरण (कनेक्ट करें)'}
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeTab === 'schema'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            2. {language === 'en' ? 'SQL Schema (Script)' : 'SQL स्कीमा स्क्रिप्ट'}
          </button>
          <button
            onClick={() => setActiveTab('freetier')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              activeTab === 'freetier'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            3. {language === 'en' ? 'Free Tier & Optimization' : 'फ्री टियर ऑप्टिमाइजेशन'}
          </button>
        </div>

        {/* Tab 1: Config & Connect */}
        {activeTab === 'config' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 leading-relaxed">
              <p className="font-bold mb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>
                  {language === 'en'
                    ? 'How to connect your Supabase database:'
                    : 'Supabase से कनेक्ट करने के निर्देश:'}
                </span>
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-blue-800">
                <li>
                  {language === 'en'
                    ? 'Create a free project on supabase.com'
                    : 'supabase.com पर जाकर निःशुल्क प्रोजेक्ट बनाएं।'}
                </li>
                <li>
                  {language === 'en'
                    ? 'Open SQL Editor, paste the script from Tab 2 (SQL Schema), and click "Run"'
                    : 'SQL Editor खोलें, टैब 2 (SQL स्कीमा) की स्क्रिप्ट पेस्ट करके "Run" दबाएं।'}
                </li>
                <li>
                  {language === 'en'
                    ? 'Go to Project Settings > API, copy your Project URL and anon public key, then paste below'
                    : 'Project Settings > API से Project URL और anon public key कॉपी करके यहाँ पेस्ट करें।'}
                </li>
              </ol>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              {saveSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {language === 'en'
                      ? 'Supabase credentials saved successfully!'
                      : 'विवरण सुरक्षित हो गया और कनेक्शन जांच लिया गया!'}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {language === 'en' ? 'Supabase Project URL' : 'प्रोजेक्ट URL (Project URL)'}
                </label>
                <input
                  type="text"
                  required
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://your-project-id.supabase.co"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 {language === 'en'
                    ? 'Format: https://[project-ref].supabase.co (From Project Settings > API)'
                    : 'फॉर्मेट: https://[project-ref].supabase.co (Project Settings > API से)'}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {language === 'en' ? 'Supabase Anon Public Key' : 'पब्लिक की (Anon Public Key)'}
                </label>
                <input
                  type="text"
                  required
                  value={config.anonKey}
                  onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !config.url}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>
                    {testingConnection
                      ? language === 'en'
                        ? 'Testing...'
                        : 'जांच जारी...'
                      : language === 'en'
                      ? 'Test Connection'
                      : 'कनेक्शन जांचें'}
                  </span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition cursor-pointer"
                >
                  {language === 'en' ? 'Save & Connect' : 'सेव व कनेक्ट करें'}
                </button>
              </div>
            </form>

            {/* Test Connection Result Box */}
            {testResult && (
              <div
                className={`p-3 rounded-2xl border text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{testResult.message}</p>
                </div>
              </div>
            )}

            {/* Cloud Sync Actions */}
            <div className="pt-3 border-t border-slate-100">
              <p className="font-bold text-slate-700 mb-2">
                {language === 'en' ? 'Data Synchronization Tools:' : 'डेटा सिंक्रोनाइज़ेशन विकल्प:'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePushData}
                  disabled={isPushing || !config.isConnected}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 text-[11px]">
                      {language === 'en' ? 'Push Local Data to Cloud' : 'लोकल डेटा क्लाउड पर अपलोड करें'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {language === 'en' ? 'Upload current schools & students' : 'मौजूदा स्कूल व छात्र डेटा सिंक'}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handlePullData}
                  disabled={isPulling || !config.isConnected}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <DownloadCloud className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 text-[11px]">
                      {language === 'en' ? 'Pull Cloud Data to Local' : 'क्लाउड से डेटा यहाँ डाउनलोड करें'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {language === 'en' ? 'Refresh from Supabase' : 'Supabase से ताजा डेटा लाएं'}
                    </p>
                  </div>
                </button>
              </div>
              {pushStatus && (
                <p className="mt-2 text-emerald-700 font-semibold text-[11px]">{pushStatus}</p>
              )}
              {pullStatus && (
                <p className="mt-2 text-emerald-700 font-semibold text-[11px]">{pullStatus}</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: SQL Schema */}
        {activeTab === 'schema' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Supabase SQL Editor Ready Script:</span>
              </span>
              <button
                onClick={handleCopySQL}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="w-full h-72 bg-slate-900 p-3.5 rounded-2xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-y-auto no-scrollbar selection:bg-emerald-800">
              {SUPABASE_SQL_SCHEMA}
            </pre>
            <div className="mt-2.5 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs">
              <span>
                💡 Paste this script directly into Supabase Dashboard &gt; SQL Editor to create tables, indexes, and realtime replication.
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Free Tier Details */}
        {activeTab === 'freetier' && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 text-emerald-700 font-bold mb-1">
                  <HardDrive className="w-4 h-4" />
                  <span>500MB DB Limit</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  10,000 students × 200 bytes = only <strong>2 MB</strong>. Ultra-lean table footprint.
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 text-blue-700 font-bold mb-1">
                  <Zap className="w-4 h-4" />
                  <span>1GB Storage Bucket</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Client-side compression under 50KB guarantees 10,000 photos stay under 500MB.
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 text-purple-700 font-bold mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>30-Day Auto Purge</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Daily logs older than 30 days are automatically pruned, keeping database light indefinitely.
                </p>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Run 30-Day Scan Purge Now</p>
                <p className="text-slate-500 text-[11px]">Delete scans older than 30 days locally</p>
              </div>
              <button
                type="button"
                onClick={handlePurgeNow}
                className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer"
              >
                Purge Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
