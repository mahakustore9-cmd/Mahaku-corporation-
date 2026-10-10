import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useLanguage } from '../../services/languageContext';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { language } = useLanguage();

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer touch-manipulation"
        title="App ko phone me install karein"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{language === 'en' ? 'Install App' : 'ऐप इनस्टॉल करें'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-semibold transition cursor-pointer touch-manipulation"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-600" />
          <span>iOS Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 text-slate-900 shadow-2xl relative animate-in fade-in zoom-in-95">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {language === 'en' ? 'Install on iPhone / iPad' : 'iPhone / iPad में इंस्टॉल करें'}
                  </h3>
                  <p className="text-xs text-slate-500">PWA Add to Home Screen</p>
                </div>
              </div>
              <ol className="text-xs text-slate-700 space-y-2.5 my-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Safari browser में नीचे <strong>Share बटन (⎋)</strong> दबाएं।</span>
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
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
              >
                {language === 'en' ? 'Got it (Close)' : 'समझ गया (बंद करें)'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
