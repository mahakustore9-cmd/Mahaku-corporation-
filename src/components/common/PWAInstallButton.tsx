import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useLanguage } from '../../services/languageContext';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const { language } = useLanguage();

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer touch-manipulation"
        title="App ko phone me install karein"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{language === 'en' ? 'Install App' : 'ऐप इनस्टॉल करें'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 text-slate-900 shadow-2xl relative">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/pwa-192x192.png"
                alt="SurakshaTrack Logo"
                className="w-12 h-12 rounded-2xl shadow-md border border-slate-100 object-cover"
              />
              <div>
                <h3 className="font-bold text-base text-slate-900">SurakshaTrack App</h3>
                <p className="text-xs text-blue-600 font-medium">होम स्क्रीन पर इंस्टॉल करें</p>
              </div>
            </div>

            {isIOS ? (
              <ol className="text-xs text-slate-700 space-y-2.5 my-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Safari ब्राउज़र में नीचे <strong>Share बटन (⎋)</strong> दबाएं।</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>सूची में <strong>&apos;Add to Home Screen&apos; (+)</strong> चुनें।</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>ऊपर दाईं ओर <strong>Add</strong> पर क्लिक करें।</span>
                </li>
              </ol>
            ) : (
              <ol className="text-xs text-slate-700 space-y-2.5 my-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Chrome ब्राउज़र में ऊपर दाईं ओर <strong>3 डॉट्स (⋮)</strong> दबाएं।</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">2.</span>
                  <span><strong>&apos;Install App&apos;</strong> या <strong>&apos;Add to Home screen&apos;</strong> चुनें।</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>सुंदर लोगो के साथ ऐप आपके फोन पर आ जाएगा।</span>
                </li>
              </ol>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
            >
              {language === 'en' ? 'Got it (Close)' : 'समझ गया (बंद करें)'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
