import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../../services/languageContext';

export const OfflineIndicator: React.FC = () => {
  const { language } = useLanguage();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-50 flex items-center justify-between gap-3 rounded-2xl bg-amber-600/95 border border-amber-400 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-md animate-bounce">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-white" />
        <span>
          {language === 'en'
            ? 'Offline Mode: Local database active'
            : 'ऑफ़लाइन मोड: लोकल डेटा सुरक्षित रखा जा रहा है'}
        </span>
      </div>
      <span className="w-2 h-2 rounded-full bg-amber-200 animate-ping" />
    </div>
  );
};
