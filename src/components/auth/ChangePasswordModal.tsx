import React, { useState } from 'react';
import { X, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { User } from '../../types';
import { dbStore } from '../../services/dbStore';
import { useLanguage } from '../../services/languageContext';

interface ChangePasswordModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ user, isOpen, onClose }) => {
  const { language, t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError(
        language === 'en'
          ? 'Password must be at least 6 characters.'
          : 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(language === 'en' ? 'Passwords do not match.' : 'दोनों पासवर्ड मेल नहीं खाते।');
      return;
    }

    const updated = dbStore.updateUserPassword(user.id, newPassword);
    if (updated) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } else {
      setError(language === 'en' ? 'Failed to update password.' : 'पासवर्ड बदलने में त्रुटि हुई।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 text-slate-900 shadow-2xl relative animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">{t('change_password')}</h3>
              <p className="text-[11px] text-slate-500 font-mono">@{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="text-sm font-bold text-emerald-700">
              {language === 'en' ? 'Password updated successfully!' : 'पासवर्ड सफलतापूर्वक बदल दिया गया!'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                {language === 'en' ? 'New Password' : 'नया पासवर्ड'}
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={language === 'en' ? 'At least 6 characters' : 'कम से कम 6 अक्षर'}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                {language === 'en' ? 'Confirm Password' : 'पासवर्ड की पुष्टि करें'}
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={language === 'en' ? 'Re-enter new password' : 'दोबारा नया पासवर्ड दर्ज करें'}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xs cursor-pointer"
              >
                {t('save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
