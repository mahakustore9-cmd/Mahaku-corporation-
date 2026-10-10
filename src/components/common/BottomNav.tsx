import React from 'react';
import {
  Compass,
  Users,
  UserCheck,
  IdCard,
  Camera,
  AlertTriangle,
  History,
  ShieldCheck,
  Building2,
  PlusCircle,
  Database,
  PhoneCall,
} from 'lucide-react';
import { UserRole } from '../../types';
import { useLanguage } from '../../services/languageContext';

export interface BottomNavProps {
  role: UserRole;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onActionClick?: (actionId: string) => void;
}

interface NavItem {
  id: string;
  labelHi: string;
  labelEn: string;
  icon: React.ReactNode;
  badge?: string;
  isAction?: boolean; // opens modal or special action
}

export const BottomNav: React.FC<BottomNavProps> = ({
  role,
  activeTab,
  onTabChange,
  onActionClick,
}) => {
  const { language } = useLanguage();

  const getNavItems = (): NavItem[] => {
    switch (role) {
      case 'SCHOOL_ADMIN':
        return [
          {
            id: 'journey',
            labelHi: 'लाइव ट्रैकिंग',
            labelEn: 'Tracking',
            icon: <Compass className="w-5 h-5" />,
          },
          {
            id: 'students',
            labelHi: 'छात्र सूची',
            labelEn: 'Students',
            icon: <Users className="w-5 h-5" />,
          },
          {
            id: 'staff',
            labelHi: 'स्टाफ',
            labelEn: 'Staff',
            icon: <UserCheck className="w-5 h-5" />,
          },
          {
            id: 'add-student-action',
            labelHi: '+ नया छात्र',
            labelEn: '+ Student',
            icon: <PlusCircle className="w-5 h-5 text-blue-600" />,
            isAction: true,
          },
        ];
      case 'TEACHER':
        return [
          {
            id: 'roster',
            labelHi: 'कक्षा हाजिरी',
            labelEn: 'Attendance',
            icon: <UserCheck className="w-5 h-5" />,
          },
          {
            id: 'scan-action',
            labelHi: 'QR स्कैन',
            labelEn: 'Scan QR',
            icon: <Camera className="w-5 h-5 text-indigo-600" />,
            isAction: true,
          },
          {
            id: 'absent-alerts',
            labelHi: 'अलर्ट्स',
            labelEn: 'Alerts',
            icon: <AlertTriangle className="w-5 h-5" />,
          },
        ];
      case 'GUARD':
        return [
          {
            id: 'gate-in',
            labelHi: 'प्रवेश (In)',
            labelEn: 'Gate Entry',
            icon: <ShieldCheck className="w-5 h-5" />,
          },
          {
            id: 'scan-action',
            labelHi: 'स्कैनर',
            labelEn: 'Scan QR',
            icon: <Camera className="w-5 h-5 text-emerald-600" />,
            isAction: true,
          },
          {
            id: 'gate-out',
            labelHi: 'निकास (Out)',
            labelEn: 'Gate Exit',
            icon: <History className="w-5 h-5" />,
          },
        ];
      case 'PARENT':
        return [
          {
            id: 'status',
            labelHi: 'लाइव स्थिति',
            labelEn: 'Live Status',
            icon: <Compass className="w-5 h-5" />,
          },
          {
            id: 'scan-qr-action',
            labelHi: 'QR स्कैनर',
            labelEn: 'Scan QR',
            icon: <Camera className="w-5 h-5 text-emerald-600" />,
            isAction: true,
          },
          {
            id: 'id-card-action',
            labelHi: 'आईडी कार्ड',
            labelEn: 'Digital ID',
            icon: <IdCard className="w-5 h-5 text-teal-600" />,
            isAction: true,
          },
          {
            id: 'emergency',
            labelHi: 'मदद SOS',
            labelEn: 'Emergency',
            icon: <PhoneCall className="w-5 h-5" />,
          },
        ];
      case 'SUPERADMIN':
        return [
          {
            id: 'schools',
            labelHi: 'स्कूल सूची',
            labelEn: 'Schools',
            icon: <Building2 className="w-5 h-5" />,
          },
          {
            id: 'add-school-action',
            labelHi: '+ नया स्कूल',
            labelEn: '+ School',
            icon: <PlusCircle className="w-5 h-5 text-amber-600" />,
            isAction: true,
          },
          {
            id: 'database-action',
            labelHi: 'डेटाबेस',
            labelEn: 'Database',
            icon: <Database className="w-5 h-5" />,
            isAction: true,
          },
        ];
      default:
        return [];
    }
  };

  const items = getNavItems();
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="no-print fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.07)] transition-all"
    >
      <div className="max-w-md mx-auto px-2 py-1.5 flex items-center justify-around gap-1">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const label = language === 'en' ? item.labelEn : item.labelHi;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isAction && onActionClick) {
                  onActionClick(item.id);
                } else {
                  onTabChange(item.id);
                }
              }}
              className={`flex-1 min-h-[48px] py-1 px-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 touch-manipulation relative cursor-pointer ${
                isActive
                  ? 'text-blue-600 font-bold bg-blue-50/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                {item.icon}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                )}
              </div>
              <span className="text-[11px] leading-tight truncate max-w-[80px]">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
