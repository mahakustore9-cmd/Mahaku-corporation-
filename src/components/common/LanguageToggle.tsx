import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../services/languageContext';

interface LanguageToggleProps {
  className?: string;
  variant?: 'pill' | 'compact' | 'light';
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  className = '',
  variant = 'pill',
}) => {
  const { language, setLanguage, toggleLanguage } = useLanguage();

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleLanguage}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition active:scale-95 cursor-pointer ${className}`}
        title="Change Language / भाषा बदलें"
      >
        <Languages className="w-3.5 h-3.5 text-blue-600" />
        <span>{language === 'hi' ? 'EN' : 'हिन्दी'}</span>
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-xl border border-slate-200 bg-slate-100/90 ${className}`}
      role="group"
      aria-label="Language Selector"
    >
      <button
        type="button"
        onClick={() => setLanguage('hi')}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
          language === 'hi'
            ? 'bg-white text-blue-700 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <span>🇮🇳</span>
        <span>हिन्दी</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
          language === 'en'
            ? 'bg-white text-blue-700 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <span>🌐</span>
        <span>English</span>
      </button>
    </div>
  );
};
