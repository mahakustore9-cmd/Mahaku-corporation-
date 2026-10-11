import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Heart,
  Home,
  CheckCircle2,
  Phone,
  MessageCircle,
  Volume2,
  Calendar,
  IdCard,
  ShieldAlert,
  AlertCircle,
  Camera,
  Bell,
  BellRing,
  Check,
  Sparkles,
} from 'lucide-react';
import { Student, User, StepType, JOURNEY_STEPS } from '../../types';
import { dbStore, getTodayDateString } from '../../services/dbStore';
import {
  speakAlertText,
  unlockAudio,
  NOTIFICATION_EVENT,
  enableVoiceAndNotifications,
  isNotificationGranted,
} from '../../services/soundService';
import { getStudentPhotoSrc, getSupabase } from '../../services/supabaseClient';
import { StudentIdCardModal } from '../schooladmin/StudentIdCardModal';
import { QRScannerModal } from '../common/QRScannerModal';
import { useLanguage } from '../../services/languageContext';

interface ParentDashboardProps {
  currentUser: User;
  activeNavTab?: string;
  onNavTabChange?: (tab: string) => void;
  navAction?: string | null;
  onClearNavAction?: () => void;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  currentUser,
  activeNavTab,
  navAction,
  onClearNavAction,
}) => {
  const { language, t } = useLanguage();
  const emergencyRef = useRef<HTMLDivElement>(null);

  // Find strictly linked students only (Privacy Isolation across schools/parents)
  const allStudents = dbStore.getStudents();
  const myLinkedStudents = allStudents.filter(
    (s) =>
      s.id === currentUser.studentId ||
      s.parentId === currentUser.id ||
      (currentUser.username && s.parentUsername?.toLowerCase() === currentUser.username.toLowerCase()) ||
      (currentUser.phone && s.parentPhone?.replace(/[^0-9]/g, '').slice(-10) === currentUser.phone.replace(/[^0-9]/g, '').slice(-10))
  );

  const fallbackStudent = myLinkedStudents[0] || null;
  const [student, setStudent] = useState<Student | null>(fallbackStudent);

  // Sync student if initially null when database sync finishes
  useEffect(() => {
    if ((!student || !student.id) && myLinkedStudents.length > 0) {
      setStudent(myLinkedStudents[0]);
    }
  }, [myLinkedStudents, student]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0); // 0 = Today, 1 = Yesterday, etc.
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [lastVoiceAlert, setLastVoiceAlert] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const today = getTodayDateString();

  // QR Scanner & Alert states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerTargetStep, setScannerTargetStep] = useState<StepType | undefined>(undefined);
  const [scanSuccessToast, setScanSuccessToast] = useState<string | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() => {
    try {
      return (
        isNotificationGranted() ||
        localStorage.getItem('suraksha_alerts_enabled_v1') === 'true'
      );
    } catch {
      return false;
    }
  });
  const [isEnablingAlerts, setIsEnablingAlerts] = useState(false);

  // Handle external BottomNav actions
  useEffect(() => {
    if (navAction === 'id-card-action') {
      setShowIdCardModal(true);
      if (onClearNavAction) onClearNavAction();
    } else if (navAction === 'scan-qr-action') {
      unlockAudio();
      setScannerTargetStep(undefined);
      setShowQRScanner(true);
      if (onClearNavAction) onClearNavAction();
    }
  }, [navAction, onClearNavAction]);

  useEffect(() => {
    if (activeNavTab === 'emergency' && emergencyRef.current) {
      emergencyRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeNavTab]);

  const [past5Days, setPast5Days] = useState(
    student ? dbStore.getStudentPast5Days(student.id) : []
  );

  const refreshHistory = () => {
    if (student) {
      setPast5Days(dbStore.getStudentPast5Days(student.id));
    }
  };

  useEffect(() => {
    if (student) {
      setPast5Days(dbStore.getStudentPast5Days(student.id));
    }
  }, [student]);

  // Real-time Event Listener for Voice Notification (within tab or local broadcast)
  useEffect(() => {
    const handleScanEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        studentName: string;
        step: number;
        messageHi: string;
        studentId: string;
      }>;
      const detail = customEvent.detail;
      if (detail && student && detail.studentId === student.id) {
        setLastVoiceAlert(detail.messageHi);
        refreshHistory();
        if (language === 'en') {
          const enMsg = `Safety Alert: Student ${student.name} reached Step ${detail.step}.`;
          speakAlertText(enMsg, 'en');
        } else {
          speakAlertText(detail.messageHi, 'hi');
        }
        if (detail.step === 5) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
      }
    };

    window.addEventListener(NOTIFICATION_EVENT, handleScanEvent);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT, handleScanEvent);
    };
  }, [student, language]);

  // Active Cross-Device Supabase Sync (Every 5 seconds)
  // Ensures voice alert sounds on parent's mobile when Guard/Teacher scans from school!
  useEffect(() => {
    if (!student) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) return;

        const { data, error } = await supabase
          .from('daily_scans')
          .select('*')
          .eq('student_id', student.id)
          .eq('scan_date', today);

        if (!error && Array.isArray(data) && isMounted) {
          const localScans = dbStore.getScans();
          let newScanDetected: any = null;

          for (const row of data) {
            const alreadyInLocal = localScans.some(
              (s) =>
                s.id === row.id ||
                (s.studentId === row.student_id && s.scanDate === row.scan_date && s.step === row.step)
            );
            if (!alreadyInLocal) {
              newScanDetected = row;
              localScans.push({
                id: row.id,
                studentId: row.student_id,
                schoolId: row.school_id,
                scanDate: row.scan_date,
                step: row.step,
                scannedAt: row.scanned_at,
                scannedBy: row.scanned_by || '',
                scannedByName: row.scanned_by_name || '',
                scannedByRole: row.scanned_by_role || 'GUARD',
                notes: row.notes || '',
              });
            }
          }

          if (newScanDetected) {
            localStorage.setItem('suraksha_scans_v4', JSON.stringify(localScans));
            refreshHistory();
            const stepInfo = JOURNEY_STEPS[newScanDetected.step as StepType];
            const msg = stepInfo
              ? stepInfo.voiceTemplateHi(student.name)
              : `सुरक्षा अलर्ट: चरण ${newScanDetected.step} दर्ज हुआ`;
            setLastVoiceAlert(msg);
            speakAlertText(msg, language === 'en' ? 'en' : 'hi');
            if (newScanDetected.step === 5) {
              confetti({ particleCount: 140, spread: 85, origin: { y: 0.6 } });
            }
          }
        }
      } catch {
        // silent polling catch
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [student, today, language]);

  if (!student) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl text-center text-slate-700 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="font-black text-xl text-slate-900">
          {language === 'en' ? 'No Student Linked' : 'कोई छात्र लिंक नहीं है'}
        </h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          {language === 'en'
            ? 'For security and privacy, you can only access data for your linked child. Please contact your school administrator.'
            : 'गोपनीयता व सुरक्षा हेतु अभिभावक केवल अपने पंजीकृत बच्चे का विवरण देख सकते हैं। कृपया स्कूल से संपर्क करें।'}
        </p>
      </div>
    );
  }

  const safeOpenUrl = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleOpenGeneralQRScanner = () => {
    unlockAudio();
    setActionError(null);
    setScannerTargetStep(undefined);
    setShowQRScanner(true);
  };

  const handleOpenStepQRScanner = (stepNum: StepType) => {
    unlockAudio();
    setActionError(null);
    if (stepNum === 5 && !todayJourney.steps[4]) {
      setActionError('चरण 5 (सकुशल घर वापसी) से पहले चरण 4 (स्कूल से प्रस्थान) पूरा होना अनिवार्य है!');
      setTimeout(() => setActionError(null), 4000);
      return;
    }
    setScannerTargetStep(stepNum);
    setShowQRScanner(true);
  };

  const handleQRScanSuccess = async (scannedStudent: Student, notes?: string, resolvedStep?: StepType) => {
    unlockAudio();
    setActionError(null);
    const finalStep = resolvedStep || scannerTargetStep || 1;
    try {
      const result = await dbStore.recordScan(
        scannedStudent.id,
        finalStep,
        currentUser,
        notes || (finalStep === 1 ? 'Parent Home Exit QR Scan' : 'Parent Home Arrival Safe QR Scan')
      );
      setScanSuccessToast(`चरण ${finalStep}: ${JOURNEY_STEPS[finalStep].titleHi} स्कैन सफल!`);
      setLastVoiceAlert(result.messageHi);
      refreshHistory();
      if (finalStep === 5) {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      }
      setTimeout(() => setScanSuccessToast(null), 4000);
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message);
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleEnableAlerts = async () => {
    setIsEnablingAlerts(true);
    try {
      const res = await enableVoiceAndNotifications();
      if (res.audioUnlocked || res.notificationGranted) {
        setAlertsEnabled(true);
      }
    } finally {
      setIsEnablingAlerts(false);
    }
  };

  const handleParentStepAction = async (step: StepType) => {
    unlockAudio();
    setActionError(null);
    try {
      const result = await dbStore.recordScan(
        student.id,
        step,
        currentUser,
        step === 1 ? 'Parent Home Exit Confirmation' : 'Parent Home Arrival Safe Confirmation'
      );
      setScanSuccessToast(`चरण ${step}: ${JOURNEY_STEPS[step].titleHi} सफलतापूर्वक दर्ज!`);
      setLastVoiceAlert(result.messageHi);
      refreshHistory();
      if (step === 5) {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      }
      setTimeout(() => setScanSuccessToast(null), 4000);
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message);
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const currentDayData = past5Days[selectedDayIndex] || past5Days[0];
  const todayJourney = dbStore.getStudentDailyJourney(student.id, today);

  // Verified School Contacts (Strictly isolated to this student's school)
  const schoolId = student.schoolId || currentUser.schoolId || '';
  const currentSchool = dbStore.getSchools().find((s) => s.id === schoolId);
  const schoolStaff = dbStore
    .getUsers()
    .filter((u) => u.schoolId === schoolId && u.isActive);

  // 1. Principal (School Admin)
  const principalUser = schoolStaff.find((u) => u.role === 'SCHOOL_ADMIN');
  const principalName =
    principalUser?.fullName ||
    currentSchool?.principalName ||
    (language === 'en' ? 'School Principal' : 'प्रधानाचार्य');
  const principalPhone = (principalUser?.phone || currentSchool?.phone || '').trim();

  // 2. Class Teacher (strictly matching student's class, or teacher in this school)
  const classTeacherUser =
    schoolStaff.find(
      (u) =>
        u.role === 'TEACHER' &&
        u.assignedClass &&
        student.className &&
        (u.assignedClass.trim().toLowerCase() === student.className.trim().toLowerCase() ||
          u.assignedClass.toLowerCase().includes(student.className.toLowerCase()) ||
          student.className.toLowerCase().includes(u.assignedClass.toLowerCase()))
    ) || schoolStaff.find((u) => u.role === 'TEACHER');
  const teacherName =
    classTeacherUser?.fullName || (language === 'en' ? 'Class Teacher' : 'कक्षा शिक्षक');
  const teacherPhone = (classTeacherUser?.phone || '').trim();

  // 3. Gate Guard (Guard of this school)
  const gateGuardUser = schoolStaff.find((u) => u.role === 'GUARD');
  const guardName =
    gateGuardUser?.fullName || (language === 'en' ? 'Gate Guard' : 'गेट सुरक्षा गार्ड');
  const guardPhone = (gateGuardUser?.phone || '').trim();

  const openWhatsAppTo = (
    targetPhone: string,
    roleTitle: string,
    contactName: string
  ) => {
    const cleanDigits = targetPhone.replace(/[^0-9]/g, '');
    if (!cleanDigits) return;
    const fullWaNumber = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const schoolName = student.schoolName || currentSchool?.name || 'स्कूल';
    const text = encodeURIComponent(
      language === 'en'
        ? `Hello ${contactName}! I am the parent of ${student.name} (Roll No: ${student.rollNo}, Class: ${student.className}) from ${schoolName}. I am contacting you regarding today's student safety journey.`
        : `नमस्ते ${contactName}! मैं ${schoolName} के छात्र ${student.name} (रोल नं: ${student.rollNo}, कक्षा: ${student.className}) का अभिभावक हूँ। मैं आज की छात्र सुरक्षा यात्रा के संबंध में आपसे संपर्क कर रहा हूँ।`
    );
    safeOpenUrl(`https://wa.me/${fullWaNumber}?text=${text}`);
  };

  const openWhatsAppToSchool = () => {
    if (principalPhone) {
      openWhatsAppTo(principalPhone, 'प्रधानाचार्य', principalName);
    } else if (teacherPhone) {
      openWhatsAppTo(teacherPhone, 'कक्षा शिक्षक', teacherName);
    } else if (guardPhone) {
      openWhatsAppTo(guardPhone, 'गेट गार्ड', guardName);
    }
  };

  const handleTestVoice = () => {
    unlockAudio();
    if (language === 'en') {
      speakAlertText(`Your child ${student.name} has arrived at school on time.`, 'en');
    } else {
      speakAlertText(`सूचना: आपका बच्चा ${student.name} सुरक्षित स्कूल गेट के अंदर पहुँच चुका है।`, 'hi');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
      {/* Multi-Child Selector */}
      {myLinkedStudents.length > 1 && (
        <div className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-xs overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-slate-500 pl-2 shrink-0">
            {language === 'en' ? 'Select Child:' : 'बच्चा चुनें:'}
          </span>
          {myLinkedStudents.map((child) => (
            <button
              key={child.id}
              onClick={() => setStudent(child)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap touch-manipulation cursor-pointer ${
                student.id === child.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{child.name}</span>
              <span className="text-[10px] font-mono opacity-80">({child.className})</span>
            </button>
          ))}
        </div>
      )}

      {/* Scan Success Toast */}
      {scanSuccessToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
          <span>{scanSuccessToast}</span>
        </div>
      )}

      {/* Voice Alert & Notification Status Banner (User Requirement) */}
      <div
        className={`rounded-3xl p-4 sm:p-5 border transition shadow-xs ${
          alertsEnabled
            ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 text-emerald-950'
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 text-amber-950 ring-2 ring-amber-400/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                alertsEnabled
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-amber-500 text-slate-950 animate-bounce'
              }`}
            >
              {alertsEnabled ? <Check className="w-5 h-5 stroke-[2.5]" /> : <BellRing className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base">
                  {alertsEnabled
                    ? (language === 'en' ? 'Live Voice Alerts Active' : 'लाइव वॉइस व नोटिफिकेशन अलर्ट चालू हैं')
                    : (language === 'en' ? 'Turn ON Mobile Voice & Push Alerts' : 'मोबाइल पर लाइव वॉइस अलर्ट और नोटिफिकेशन चालू करें')}
                </h3>
                {alertsEnabled && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    {language === 'en' ? 'ACTIVE' : 'सक्रिय'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {alertsEnabled
                  ? (language === 'en'
                      ? 'Your phone will automatically chime and speak aloud in Hindi on every scan update.'
                      : 'स्कूल गेट आगमन, कक्षा हाजिरी व छुट्टी पर आपका फोन बोलकर हिंदी में लाइव सूचना देगा।')
                  : (language === 'en'
                      ? 'Tap button below to permit audio and push notifications so your phone speaks alerts.'
                      : 'कृपया नीचे दबाकर आवाज़ व नोटिफिकेशन अनुमति चालू करें जिससे हर स्कैन पर मोबाइल में आवाज़ आए।')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {!alertsEnabled ? (
              <button
                onClick={handleEnableAlerts}
                disabled={isEnablingAlerts}
                className="w-full sm:w-auto py-2.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition touch-manipulation cursor-pointer"
              >
                <BellRing className="w-4 h-4 text-slate-950" />
                <span>
                  {isEnablingAlerts
                    ? 'चालू हो रहा है...'
                    : (language === 'en' ? 'Enable Voice Alerts' : '📢 अलर्ट चालू करें')}
                </span>
              </button>
            ) : (
              <button
                onClick={handleTestVoice}
                className="py-2 px-3.5 rounded-xl bg-white/90 hover:bg-white text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-xs transition touch-manipulation cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-emerald-600" />
                <span>{language === 'en' ? 'Test Alert' : '🔊 आवाज़ टेस्ट करें'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Student Profile & Badge Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-20 rounded-2xl overflow-hidden border-2 border-blue-400 shadow-xs bg-slate-100 shrink-0 relative">
              {getStudentPhotoSrc(student) ? (
                <img
                  src={getStudentPhotoSrc(student)}
                  alt={student.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-blue-600 text-xl">
                  {student.name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{student.name}</h2>
                <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold px-2 py-0.5 rounded-full">
                  {student.rollNo}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {student.className} • {student.schoolName || 'Delhi Public Model School'}
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1 text-rose-700 font-semibold">
                  <Heart className="w-3 h-3 fill-rose-500" />
                  {student.bloodGroup || 'B+'}
                </span>
                <span>•</span>
                <span>{language === 'en' ? 'Father:' : 'पिता:'} {student.fatherName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
            <button
              onClick={handleOpenGeneralQRScanner}
              className="flex-1 sm:flex-initial py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 touch-manipulation cursor-pointer"
              title="QR स्कैनर खोलें"
            >
              <Camera className="w-4 h-4" />
              <span>{language === 'en' ? 'QR Scanner' : 'QR स्कैनर'}</span>
            </button>
            <button
              onClick={() => setShowIdCardModal(true)}
              className="flex-1 sm:flex-initial py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 touch-manipulation cursor-pointer"
            >
              <IdCard className="w-4 h-4" />
              <span>{t('tab_id_card')}</span>
            </button>
            <button
              onClick={handleTestVoice}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition touch-manipulation cursor-pointer"
              title={t('test_voice')}
            >
              <Volume2 className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">{t('test_voice')}</span>
            </button>
          </div>
        </div>

        {lastVoiceAlert && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in">
            <Volume2 className="w-5 h-5 shrink-0 text-emerald-600 animate-bounce" />
            <div className="flex-1">
              <span className="font-bold text-emerald-950 block">
                {language === 'en' ? 'Recent Voice Alert:' : 'हालिया वॉइस अलर्ट:'}
              </span>
              <span>{lastVoiceAlert}</span>
            </div>
          </div>
        )}
      </div>

      {/* Parent Daily Departure & Return Controls (Step 1 & Step 5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Step 1: Left Home */}
        <div
          className={`p-4 rounded-3xl border transition flex flex-col justify-between ${
            todayJourney.steps[1]
              ? 'bg-emerald-50/70 border-emerald-200'
              : 'bg-white border-slate-200 hover:border-amber-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {language === 'en' ? 'Step 1 • Morning' : 'चरण 1 • सुबह'}
              </span>
              {todayJourney.steps[1] && (
                <span className="text-xs font-mono text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {new Date(todayJourney.steps[1].scannedAt).toLocaleTimeString('hi-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <h3 className="font-bold text-base text-slate-900">
              {language === 'en' ? 'Left Home' : 'घर से स्कूल रवाना'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {todayJourney.steps[1]
                ? (language === 'en' ? 'Student has departed for school on time.' : 'छात्र स्कूल के लिए समय पर रवाना हो चुका है।')
                : (language === 'en' ? 'Tap here when child leaves home for school.' : 'बच्चा जब घर से निकले तो यहाँ दबाएं या QR स्कैन करें।')}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            {todayJourney.steps[1] ? (
              <div className="w-full py-2.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{language === 'en' ? 'Departed (Confirmed)' : 'रवाना हो चुका (Done)'}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleOpenStepQRScanner(1)}
                  className="py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition touch-manipulation cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>QR स्कैन</span>
                </button>
                <button
                  onClick={() => handleParentStepAction(1)}
                  className="py-2.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition touch-manipulation cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>1-टैप प्रस्थान</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step 5: Reached Home */}
        <div
          className={`p-4 rounded-3xl border transition flex flex-col justify-between ${
            todayJourney.steps[5]
              ? 'bg-teal-50/70 border-teal-200'
              : 'bg-white border-slate-200 hover:border-teal-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                {language === 'en' ? 'Step 5 • Evening Return' : 'चरण 5 • शाम वापसी'}
              </span>
              {todayJourney.steps[5] && (
                <span className="text-xs font-mono text-teal-800 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  {new Date(todayJourney.steps[5].scannedAt).toLocaleTimeString('hi-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <h3 className="font-bold text-base text-slate-900">
              {language === 'en' ? 'Reached Home Safely' : 'सकुशल घर पहुँच गया'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {todayJourney.steps[5]
                ? (language === 'en' ? "Today's 5-step journey safely completed!" : 'आज की 5-स्टेप सुरक्षित यात्रा पूर्ण हो चुकी है!')
                : (language === 'en' ? 'Confirm arrival once child arrives back home.' : 'बच्चे के घर पहुँचने पर यहाँ पुष्टि करें।')}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            {todayJourney.steps[5] ? (
              <div className="w-full py-2.5 rounded-xl bg-teal-100 text-teal-800 font-bold text-xs text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>{language === 'en' ? 'Safely Arrived Home' : 'घर पहुँच गया (Completed)'}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleOpenStepQRScanner(5)}
                  disabled={!todayJourney.steps[4]}
                  className="py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition touch-manipulation cursor-pointer"
                  title={!todayJourney.steps[4] ? 'चरण 4 पूरा होने के बाद ही स्कैन होगा' : 'QR स्कैन करें'}
                >
                  <Camera className="w-4 h-4 text-teal-400" />
                  <span>QR स्कैन</span>
                </button>
                <button
                  onClick={() => handleParentStepAction(5)}
                  disabled={!todayJourney.steps[4]}
                  className="py-2.5 px-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition touch-manipulation cursor-pointer"
                  title={!todayJourney.steps[4] ? 'चरण 4 पूरा होने के बाद ही पुष्टि होगी' : '1-टैप वापसी'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>1-टैप वापसी</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's 5-Step Visual Timeline */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              {language === 'en' ? "Today's 5-Step Journey Tracking" : 'आज की 5-चरण लाइव सुरक्षा यात्रा'}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'en' ? 'Verified timestamps and scanner details for every stage' : 'हर चरण का सही समय और स्कैन करने वाले की जानकारी'}
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
            {today}
          </span>
        </div>

        <div className="relative mt-5 pl-4 sm:pl-6 space-y-5 before:absolute before:left-8 sm:before:left-10 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {([1, 2, 3, 4, 5] as StepType[]).map((stepNum) => {
            const stepDef = JOURNEY_STEPS[stepNum];
            const scan = todayJourney.steps[stepNum];
            const isDone = Boolean(scan);
            const scanTime = scan
              ? new Date(scan.scannedAt).toLocaleTimeString('hi-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null;

            return (
              <div key={stepNum} className="relative flex items-start gap-4">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold shrink-0 z-10 shadow-xs transition ${
                    isDone
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                      : 'bg-slate-100 text-slate-500 border border-slate-300 ring-4 ring-white'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5 text-white" /> : stepNum}
                </div>
                <div
                  className={`flex-1 p-3.5 rounded-2xl border transition ${
                    isDone
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">
                          {language === 'en' ? stepDef.titleEn : stepDef.titleHi}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-medium">
                          ({language === 'en' ? stepDef.titleHi : stepDef.titleEn})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {language === 'en' ? stepDef.titleEn : stepDef.descHi}
                      </p>
                    </div>
                    <div className="mt-1 sm:mt-0 text-left sm:text-right">
                      {isDone ? (
                        <div>
                          <span className="font-mono text-xs font-bold text-emerald-700">
                            {scanTime}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {language === 'en' ? 'By:' : 'द्वारा:'} {scan?.scannedByName || 'System'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          {language === 'en' ? 'Pending' : 'प्रतीक्षारत'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PAST 5 DAYS HISTORY */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">
              {language === 'en' ? 'Past 5 Days History' : 'पिछले 5 दिनों का उपस्थिति रिकॉर्ड'}
            </h3>
          </div>
          <span className="text-xs text-slate-500">{language === 'en' ? 'Daily Record' : 'दैनिक विवरण'}</span>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {past5Days.map((day, idx) => (
            <button
              key={day.date}
              onClick={() => setSelectedDayIndex(idx)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 touch-manipulation cursor-pointer ${
                selectedDayIndex === idx
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{day.dayLabel}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  day.isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {day.completedCount}/5
              </span>
            </button>
          ))}
        </div>

        {currentDayData && (
          <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-800">
                {language === 'en' ? 'Date:' : 'दिनांक:'} {currentDayData.date} ({currentDayData.dayLabel})
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  currentDayData.isComplete
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {currentDayData.isComplete
                  ? (language === 'en' ? '5/5 Steps Completed ✓' : '5/5 सभी चरण पूर्ण ✓')
                  : `${currentDayData.completedCount}/5 चरण`}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {([1, 2, 3, 4, 5] as StepType[]).map((stepNum) => {
                const s = currentDayData.steps[stepNum];
                const def = JOURNEY_STEPS[stepNum];
                const timeStr = s
                  ? new Date(s.scannedAt).toLocaleTimeString('hi-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null;

                return (
                  <div
                    key={stepNum}
                    className={`p-2.5 rounded-xl border text-center ${
                      s
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    <p className="text-[11px] font-bold truncate">
                      {language === 'en' ? def.titleEn : def.titleHi}
                    </p>
                    <p className="text-[10px] font-mono mt-1 font-bold">
                      {timeStr || '--:--'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Emergency Contact & School Helpline Buttons */}
      <div ref={emergencyRef} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <h3 className="font-bold text-base text-slate-900">
              {language === 'en' ? 'Emergency School Helpline & SOS' : 'आपातकालीन स्कूल हेल्पलाइन व सहायता'}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'en'
                ? `Direct verified contacts for ${student.schoolName || currentSchool?.name || 'School'} (Principal, Teacher & Guard only)`
                : `${student.schoolName || currentSchool?.name || 'स्कूल'} के अधिकृत प्रधानाचार्य, कक्षा शिक्षक व गेट गार्ड के सीधे मोबाइल नंबर`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Principal */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {language === 'en' ? 'Principal' : 'प्रधानाचार्य'}
                </span>
                {principalPhone && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="सक्रिय संपर्क" />
                )}
              </div>
              <p className="text-xs font-bold text-slate-900 mt-2 truncate">
                {principalName}
              </p>
              {principalPhone ? (
                <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">
                  {principalPhone}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 italic mt-0.5">
                  {language === 'en' ? 'No phone registered' : 'नंबर दर्ज नहीं'}
                </p>
              )}
            </div>

            {principalPhone ? (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                <button
                  onClick={() => openWhatsAppTo(principalPhone, 'प्रधानाचार्य', principalName)}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 touch-manipulation cursor-pointer"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <a
                  href={`tel:${principalPhone.replace(/[^0-9+]/g, '')}`}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  title="Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Call' : 'कॉल'}</span>
                </a>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-400 italic text-center">
                {language === 'en' ? 'Contact via school office' : 'स्कूल कार्यालय से संपर्क करें'}
              </div>
            )}
          </div>

          {/* Card 2: Class Teacher */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  {language === 'en' ? 'Class Teacher' : 'कक्षा शिक्षक'}
                  {student.className ? ` (${student.className})` : ''}
                </span>
                {teacherPhone && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="सक्रिय संपर्क" />
                )}
              </div>
              <p className="text-xs font-bold text-slate-900 mt-2 truncate">
                {classTeacherUser ? teacherName : (language === 'en' ? 'Class Teacher' : 'कक्षा शिक्षक')}
              </p>
              {teacherPhone ? (
                <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">
                  {teacherPhone}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 italic mt-0.5">
                  {language === 'en' ? 'Not assigned by school' : 'स्कूल द्वारा नंबर दर्ज नहीं'}
                </p>
              )}
            </div>

            {teacherPhone ? (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                <button
                  onClick={() => openWhatsAppTo(teacherPhone, 'कक्षा शिक्षक', teacherName)}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 touch-manipulation cursor-pointer"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <a
                  href={`tel:${teacherPhone.replace(/[^0-9+]/g, '')}`}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  title="Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Call' : 'कॉल'}</span>
                </a>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-400 italic text-center">
                {language === 'en' ? 'Teacher not registered yet' : 'शिक्षक अभी पंजीकृत नहीं'}
              </div>
            )}
          </div>

          {/* Card 3: Gate Guard */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {language === 'en' ? 'Gate Guard' : 'गेट सुरक्षा गार्ड'}
                </span>
                {guardPhone && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="सक्रिय संपर्क" />
                )}
              </div>
              <p className="text-xs font-bold text-slate-900 mt-2 truncate">
                {gateGuardUser ? guardName : (language === 'en' ? 'Gate Guard' : 'गेट सुरक्षा गार्ड')}
              </p>
              {guardPhone ? (
                <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">
                  {guardPhone}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 italic mt-0.5">
                  {language === 'en' ? 'Not assigned by school' : 'स्कूल द्वारा नंबर दर्ज नहीं'}
                </p>
              )}
            </div>

            {guardPhone ? (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                <button
                  onClick={() => openWhatsAppTo(guardPhone, 'गेट गार्ड', guardName)}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 touch-manipulation cursor-pointer"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <a
                  href={`tel:${guardPhone.replace(/[^0-9+]/g, '')}`}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  title="Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Call' : 'कॉल'}</span>
                </a>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-400 italic text-center">
                {language === 'en' ? 'Guard not registered yet' : 'गार्ड अभी पंजीकृत नहीं'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable ID Card Modal */}
      {showIdCardModal && (
        <StudentIdCardModal
          student={student}
          onClose={() => setShowIdCardModal(false)}
        />
      )}

      {/* QR Scanner Modal for Parent */}
      {showQRScanner && student && (
        <QRScannerModal
          isOpen={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          step={scannerTargetStep}
          targetStudentId={student.id}
          parentMode={true}
          onScanSuccess={handleQRScanSuccess}
        />
      )}
    </div>
  );
};
