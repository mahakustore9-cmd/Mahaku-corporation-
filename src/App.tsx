/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { User } from './types';
import { dbStore } from './services/dbStore';
import { unlockAudio } from './services/soundService';
import { signOutSupabase } from './services/supabaseClient';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { LoginForm } from './components/auth/LoginForm';
import { ChangePasswordModal } from './components/auth/ChangePasswordModal';
import { SupabaseConfigModal } from './components/settings/SupabaseConfigModal';
import { SuperadminDashboard } from './components/superadmin/SuperadminDashboard';
import { SchoolAdminDashboard } from './components/schooladmin/SchoolAdminDashboard';
import { GuardDashboard } from './components/guard/GuardDashboard';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { ParentDashboard } from './components/parent/ParentDashboard';
import { useLanguage } from './services/languageContext';

export default function App() {
  const { language } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(() => dbStore.getCurrentUser());
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

  // Active BottomNav tab & action state
  const [activeNavTab, setActiveNavTab] = useState<string>('journey');
  const [navAction, setNavAction] = useState<string | null>(null);

  // Default active tab when role changes
  useEffect(() => {
    if (currentUser) {
      switch (currentUser.role) {
        case 'SCHOOL_ADMIN':
          setActiveNavTab('journey');
          break;
        case 'TEACHER':
          setActiveNavTab('roster');
          break;
        case 'GUARD':
          setActiveNavTab('gate-in');
          break;
        case 'PARENT':
          setActiveNavTab('status');
          break;
        case 'SUPERADMIN':
          setActiveNavTab('schools');
          break;
      }
    }
  }, [currentUser?.role]);

  // Initialize Supabase sync and realtime scans listener on application mount
  useEffect(() => {
    dbStore.initSupabaseSync();
  }, []);

  // Initialize sound unlock on any user tap/click
  useEffect(() => {
    const handleFirstInteraction = () => {
      unlockAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    if (currentUser?.role === 'SUPERADMIN') {
      await signOutSupabase();
    }
    dbStore.setCurrentUser(null);
    setCurrentUser(null);
  };

  // Render appropriate role dashboard
  const renderDashboard = () => {
    if (!currentUser) return null;

    switch (currentUser.role) {
      case 'SUPERADMIN':
        return (
          <SuperadminDashboard
            currentUser={currentUser}
            onOpenSupabase={() => setShowSupabaseModal(true)}
            activeNavTab={activeNavTab}
            onNavTabChange={(tab) => setActiveNavTab(tab)}
            navAction={navAction}
            onClearNavAction={() => setNavAction(null)}
          />
        );
      case 'SCHOOL_ADMIN':
        return (
          <SchoolAdminDashboard
            currentUser={currentUser}
            activeNavTab={activeNavTab}
            onNavTabChange={(tab) => setActiveNavTab(tab)}
            navAction={navAction}
            onClearNavAction={() => setNavAction(null)}
          />
        );
      case 'GUARD':
        return (
          <GuardDashboard
            currentUser={currentUser}
            activeNavTab={activeNavTab}
            onNavTabChange={(tab) => setActiveNavTab(tab)}
            navAction={navAction}
            onClearNavAction={() => setNavAction(null)}
          />
        );
      case 'TEACHER':
        return (
          <TeacherDashboard
            currentUser={currentUser}
            activeNavTab={activeNavTab}
            onNavTabChange={(tab) => setActiveNavTab(tab)}
            navAction={navAction}
            onClearNavAction={() => setNavAction(null)}
          />
        );
      case 'PARENT':
        return (
          <ParentDashboard
            currentUser={currentUser}
            activeNavTab={activeNavTab}
            onNavTabChange={(tab) => setActiveNavTab(tab)}
            navAction={navAction}
            onClearNavAction={() => setNavAction(null)}
          />
        );
      default:
        return (
          <div className="p-8 text-center text-slate-500">
            {language === 'en'
              ? 'Unknown role. Please sign in again.'
              : 'अमान्य भूमिका। कृपया पुनः लॉगिन करें।'}
          </div>
        );
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
        <LoginForm
          onLoginSuccess={handleLoginSuccess}
          onOpenSupabaseConfig={() => setShowSupabaseModal(true)}
        />
        <OfflineIndicator />
        {showSupabaseModal && (
          <SupabaseConfigModal
            isOpen={showSupabaseModal}
            onClose={() => setShowSupabaseModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white pb-24 md:pb-20">
      {/* Global Header with Modern UI & Language Switcher */}
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onChangePassword={() => setShowPasswordModal(true)}
        onOpenSupabase={() => setShowSupabaseModal(true)}
      />

      {/* Main Dashboard Screen for Logged In User */}
      <main className="flex-1">{renderDashboard()}</main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        role={currentUser.role}
        activeTab={activeNavTab}
        onTabChange={(tab) => setActiveNavTab(tab)}
        onActionClick={(action) => setNavAction(action)}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal
          user={currentUser}
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
        />
      )}

      {/* Supabase Schema & Settings Modal */}
      {showSupabaseModal && (
        <SupabaseConfigModal
          isOpen={showSupabaseModal}
          onClose={() => setShowSupabaseModal(false)}
        />
      )}
    </div>
  );
}
