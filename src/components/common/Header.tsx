import React from 'react';
import {
  ShieldCheck,
  LogOut,
  KeyRound,
  Database,
  Volume2,
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { PWAInstallButton } from './PWAInstallButton';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../../services/languageContext';
import { speakAlertText, unlockAudio } from '../../services/soundService';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onChangePassword: () => void;
  onOpenSupabase: () => void;
  onSwitchRole?: (role: UserRole) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onChangePassword,
  onOpenSupabase,
}) => {
  const { language, t } = useLanguage();

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPERADMIN':
        return {
          label: t('role_superadmin'),
          color: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: '👑',
        };
      case 'SCHOOL_ADMIN':
        return {
          label: t('role_school_admin'),
          color: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: '🏫',
        };
      case 'GUARD':
        return {
          label: t('role_guard'),
          color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: '🛡️',
        };
      case 'TEACHER':
        return {
          label: `${t('role_teacher')} (${user.assignedClass || 'Class 5-A'})`,
          color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          icon: '🎓',
        };
      case 'PARENT':
        return {
          label: t('role_parent'),
          color: 'bg-teal-50 text-teal-800 border-teal-200',
          icon: '👨‍👩‍👧',
        };
    }
  };

  const badge = getRoleBadge(user.role);

  const handleTestVoice = () => {
    unlockAudio();
    if (language === 'en') {
      speakAlertText(`SurakshaTrack voice alert: ${user.fullName}, audio notifications are active.`, 'en');
    } else {
      speakAlertText(`सुरक्षा सूचना: ${user.fullName}, ऑडियो अलर्ट सक्रिय है।`, 'hi');
    }
  };

  return (
    <header className="bg-white/95 border-b border-slate-200 sticky top-0 z-40 backdrop-blur-md shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        {/* Brand & School Logo */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-sm sm:text-base text-slate-900 tracking-tight leading-none">
                {t('app_name')}
              </h1>
              <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                {t('pwa_badge')}
              </span>
            </div>
            {user.schoolName && user.role !== 'SUPERADMIN' && (
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[130px] sm:max-w-xs mt-0.5">
                {user.schoolName}
              </p>
            )}
          </div>
        </div>

        {/* Center / Role Indicator */}
        <div className="hidden md:flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.color}`}
          >
            <span>{badge.icon}</span>
            <span>{badge.label}</span>
          </span>
          <span className="text-xs text-slate-700 font-semibold">{user.fullName}</span>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Language Switcher */}
          <LanguageToggle variant="compact" />

          {/* Audio Test Icon */}
          <button
            onClick={handleTestVoice}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-emerald-600 border border-slate-200 transition active:scale-95 touch-manipulation cursor-pointer"
            title={t('test_voice')}
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* Supabase Schema / Config Modal (SUPERADMIN ONLY) */}
          {user.role === 'SUPERADMIN' && (
            <button
              onClick={onOpenSupabase}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-blue-600 border border-slate-200 transition touch-manipulation cursor-pointer"
              title={t('tab_database')}
            >
              <Database className="w-4 h-4" />
            </button>
          )}

          {/* Change Password */}
          <button
            onClick={onChangePassword}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition touch-manipulation cursor-pointer"
            title={t('change_password')}
          >
            <KeyRound className="w-4 h-4" />
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Logout */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition active:scale-95 touch-manipulation cursor-pointer"
            title={t('logout')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Sub-Header Role Bar */}
      <div className="md:hidden px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{badge.icon}</span>
          <span className="font-bold text-slate-800 text-[11px] truncate max-w-[180px]">
            {user.fullName}
          </span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${badge.color}`}>
          {badge.label}
        </span>
      </div>
    </header>
  );
};
