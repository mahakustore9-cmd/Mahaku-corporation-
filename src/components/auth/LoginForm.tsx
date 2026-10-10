import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  LogIn,
  Eye,
  EyeOff,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { User } from '../../types';
import { dbStore } from '../../services/dbStore';
import { useLanguage } from '../../services/languageContext';
import { LanguageToggle } from '../common/LanguageToggle';
import { speakAlertText, unlockAudio } from '../../services/soundService';
import {
  isSupabaseConfigured,
  signInSuperadminWithSupabase,
} from '../../services/supabaseClient';

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
  onOpenSupabaseConfig?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const { language, t } = useLanguage();

  // Single Unified Form States
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      unlockAudio();
      const cleanIdentifier = identifier.trim().toLowerCase();
      const cleanPassword = password.trim();

      const isMukeshSuperadmin =
        cleanIdentifier === 'mukeshchaudhary15796@gmail.com' ||
        cleanIdentifier === 'mukeshchaudhary15796';

      const isMasterAdmin = cleanIdentifier === 'admin';

      // 1. Check if user is attempting Superadmin Login
      if (isMukeshSuperadmin || isMasterAdmin) {
        // Attempt Supabase Auth first if configured
        if (isSupabaseConfigured() && isMukeshSuperadmin) {
          const authRes = await signInSuperadminWithSupabase(
            'mukeshchaudhary15796@gmail.com',
            cleanPassword
          );
          if (authRes.success && authRes.user) {
            dbStore.setCurrentUser(authRes.user);
            onLoginSuccess(authRes.user);
            setIsSubmitting(false);
            return;
          }
        }

        // Saved Superadmin credentials verification
        const validMukeshPass = cleanPassword === 'Mukesh123';
        const validAdminPass = cleanPassword === 'admin' || cleanPassword === 'Mukesh123';

        if ((isMukeshSuperadmin && validMukeshPass) || (isMasterAdmin && validAdminPass)) {
          const superadminUser: User = {
            id: isMukeshSuperadmin ? 'user_superadmin_mukesh' : 'user_master_admin',
            email: 'mukeshchaudhary15796@gmail.com',
            username: 'mukeshchaudhary15796@gmail.com',
            fullName: 'Mukesh Chaudhary (Superadmin)',
            role: 'SUPERADMIN',
            phone: '+91 99999 00000',
            isActive: true,
            createdAt: new Date().toISOString(),
          };
          dbStore.setCurrentUser(superadminUser);
          onLoginSuccess(superadminUser);
          setIsSubmitting(false);
          return;
        }

        setError(
          language === 'en'
            ? 'Invalid superadmin password. Please try again.'
            : 'सुपरएडमिन पासवर्ड गलत है। कृपया पुनः प्रयास करें।'
        );
        setIsSubmitting(false);
        return;
      }

      // 2. School Staff & Parents Authentication
      const allUsers = dbStore.getUsers();
      const cleanInputPhone = cleanIdentifier.replace(/[^0-9]/g, '');

      const foundUser = allUsers.find((u) => {
        const uUsername = u.username.toLowerCase();
        const uEmail = u.email ? u.email.toLowerCase() : '';
        const uPhone = u.phone ? u.phone.replace(/[^0-9]/g, '') : '';

        const isUserMatch =
          uUsername === cleanIdentifier ||
          uEmail === cleanIdentifier ||
          (cleanInputPhone.length >= 10 && uPhone.endsWith(cleanInputPhone));

        return isUserMatch && u.password === cleanPassword;
      });

      if (foundUser) {
        if (!foundUser.isActive) {
          setError(
            language === 'en'
              ? 'This account has been deactivated. Please contact school principal.'
              : 'यह खाता निष्क्रिय कर दिया गया है। कृपया स्कूल प्रिंसिपल से संपर्क करें।'
          );
          setIsSubmitting(false);
          return;
        }

        dbStore.setCurrentUser(foundUser);
        onLoginSuccess(foundUser);
      } else {
        setError(
          language === 'en'
            ? 'Invalid username, email, phone or password. Please verify and try again.'
            : 'गलत यूजरनेम, फोन या पासवर्ड। कृपया दोबारा जांचें।'
        );
      }
    } catch {
      setError(
        language === 'en'
          ? 'An error occurred during sign in. Please try again.'
          : 'लॉगिन के दौरान त्रुटि हुई। कृपया पुनः प्रयास करें।'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestAudio = () => {
    unlockAudio();
    if (language === 'en') {
      speakAlertText('Audio system check: Voice alerts are operational.', 'en');
    } else {
      speakAlertText('ऑडियो परीक्षण: सुरक्षाट्रैक वॉइस अलर्ट प्रणाली सक्रिय है।', 'hi');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-slate-50 min-h-[90vh]">
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Top bar with Language Switcher */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {language === 'en' ? 'Language / भाषा' : 'भाषा / Language'}
            </span>
          </div>
          <LanguageToggle variant="pill" />
        </div>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('app_name')}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            {t('app_subtitle')}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">{error}</span>
            </div>
          </div>
        )}

        {/* Unified Single Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('username_or_email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={language === 'en' ? 'Email, username or phone' : 'ईमेल, यूजरनेम या मोबाइल नंबर'}
                className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition active:scale-[0.98] flex items-center justify-center gap-2 mt-2 touch-manipulation cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSubmitting ? (language === 'en' ? 'Signing In...' : 'लॉगिन हो रहा है...') : t('sign_in')}</span>
          </button>
        </form>

        {/* Audio Test Trigger */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>ध्वनि प्रणाली जांच:</span>
          <button
            type="button"
            onClick={handleTestAudio}
            className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold active:scale-95 touch-manipulation cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Play Test Voice' : 'आवाज टेस्ट करें'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
