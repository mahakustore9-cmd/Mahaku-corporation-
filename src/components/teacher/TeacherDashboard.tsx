import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Camera,
  AlertTriangle,
  MessageCircle,
  Search,
  AlertCircle,
} from 'lucide-react';
import { Student, User } from '../../types';
import { dbStore, getTodayDateString } from '../../services/dbStore';
import { QRScannerModal } from '../common/QRScannerModal';
import { unlockAudio } from '../../services/soundService';
import { useLanguage } from '../../services/languageContext';

interface TeacherDashboardProps {
  currentUser: User;
  activeNavTab?: string;
  onNavTabChange?: (tab: string) => void;
  navAction?: string | null;
  onClearNavAction?: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentUser,
  navAction,
  onClearNavAction,
}) => {
  const { language, t } = useLanguage();
  const [activeClass, setActiveClass] = useState<string>(currentUser.assignedClass || 'Class 5-A');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentScanResult, setRecentScanResult] = useState<{
    student: Student;
    message: string;
    time: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync BottomNav action
  useEffect(() => {
    if (navAction === 'scan-action') {
      handleStartScan();
      if (onClearNavAction) onClearNavAction();
    }
  }, [navAction, onClearNavAction]);

  const today = getTodayDateString();
  const schoolStudents = dbStore.getStudents(currentUser.schoolId);
  const availableClasses = Array.from(new Set(schoolStudents.map((s) => s.className))).filter(Boolean);
  const classStudents = schoolStudents.filter((s) => s.className === activeClass);
  const todayScans = dbStore.getScansForDate(today, currentUser.schoolId);

  // Group students: Present in class (Step 3 done), At School but not in class (Step 2 done), Absent
  const presentStudents: Student[] = [];
  const atGateOnlyStudents: Student[] = [];
  const absentStudents: Student[] = [];

  classStudents.forEach((std) => {
    const hasStep3 = todayScans.some((s) => s.studentId === std.id && s.step === 3);
    const hasStep2 = todayScans.some((s) => s.studentId === std.id && s.step === 2);
    if (hasStep3) {
      presentStudents.push(std);
    } else if (hasStep2) {
      atGateOnlyStudents.push(std);
    } else {
      absentStudents.push(std);
    }
  });

  const handleStartScan = () => {
    unlockAudio();
    setErrorMsg(null);
    setScannerOpen(true);
  };

  const handleScanSuccess = async (student: Student) => {
    try {
      const result = await dbStore.recordScan(
        student.id,
        3, // Step 3: Classroom Entry
        currentUser,
        `${activeClass} Attendance Scan`
      );
      setRecentScanResult({
        student,
        message: result.messageHi,
        time: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }),
      });
      setErrorMsg(null);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message);
    }
  };

  const safeOpenUrl = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const sendWhatsAppAlert = (student: Student, status: 'missing_class' | 'not_arrived') => {
    const cleanPhone = student.parentPhone.replace(/[^0-9]/g, '');
    const reason =
      status === 'missing_class'
        ? (language === 'en'
            ? `Student ${student.name} reached school gate but is not yet present in classroom (${activeClass}).`
            : `सूचना: छात्र ${student.name} स्कूल गेट पर आ चुका है, लेकिन अभी तक कक्षा (${activeClass}) में उपस्थित नहीं हुआ है।`)
        : (language === 'en'
            ? `Student ${student.name} is absent from classroom (${activeClass}) today. Please confirm.`
            : `सूचना: छात्र ${student.name} आज कक्षा (${activeClass}) में अनुपस्थित है। कृपया कारण बताएं।`);

    const text = encodeURIComponent(
      `नमस्ते ${student.fatherName} जी!\nकक्षा शिक्षक ${currentUser.fullName} (${activeClass}):\nछात्र: ${student.name} (रोल: ${student.rollNo})\n${reason}`
    );
    safeOpenUrl(`https://wa.me/${cleanPhone}?text=${text}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold mb-2">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>
                {language === 'en' ? 'Class:' : 'कक्षा:'} {activeClass} • {t('role_teacher')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {language === 'en' ? 'Classroom Attendance & Voice Alerts' : 'कक्षा हाजिरी व वॉइस अलर्ट्स'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
              {currentUser.fullName} • {language === 'en' ? 'Scanning QR instantly triggers voice notification on parent device.' : 'QR स्कैन करते ही माता-पिता के फोन पर कक्षा में उपस्थिति की आवाज जाएगी।'}
            </p>

            {/* Class Switcher */}
            {availableClasses.length > 1 && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold">
                  {language === 'en' ? 'Switch Class:' : 'कक्षा बदलें:'}
                </span>
                {availableClasses.map((cls) => (
                  <button
                    key={cls}
                    onClick={() => setActiveClass(cls)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeClass === cls
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleStartScan}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition active:scale-95 shrink-0 touch-manipulation cursor-pointer"
          >
            <Camera className="w-5 h-5" />
            <span>{language === 'en' ? 'Step 3: Scan Attendance' : `चरण 3: ${activeClass} हाजिरी स्कैन`}</span>
          </button>
        </div>
      </div>

      {/* Class Statistics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-slate-500 font-bold block">{language === 'en' ? 'Total in Class' : 'कुल छात्र'}</span>
          <span className="text-2xl font-black text-slate-900 block mt-1">{classStudents.length}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-emerald-600 font-bold block">{language === 'en' ? 'Classroom In' : 'कक्षा में उपस्थित (Step 3)'}</span>
          <span className="text-2xl font-black text-emerald-600 block mt-1">{presentStudents.length}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-amber-600 font-bold block">{language === 'en' ? 'At Gate Only' : 'गेट पर, कक्षा में नहीं'}</span>
          <span className="text-2xl font-black text-amber-600 block mt-1">{atGateOnlyStudents.length}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center shadow-xs">
          <span className="text-xs text-rose-600 font-bold block">{language === 'en' ? 'Absent' : 'अनुपस्थित (Absent)'}</span>
          <span className="text-2xl font-black text-rose-600 block mt-1">{absentStudents.length}</span>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Recent Scan Feedback Box */}
      {recentScanResult && (
        <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              ✓
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">
                {recentScanResult.student.name} ({recentScanResult.student.rollNo})
              </p>
              <p className="text-xs text-emerald-800">{recentScanResult.message}</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">{recentScanResult.time}</span>
        </div>
      )}

      {/* Absent & Missing Warning Section */}
      {(atGateOnlyStudents.length > 0 || absentStudents.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {language === 'en' ? 'Immediate WhatsApp Alert for Absent / Missing Students' : 'अनुपस्थित / गेट पर अटके छात्रों हेतु तुरंत WhatsApp अलर्ट'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'en' ? 'Send instant 1-tap WhatsApp alert to parent mobile' : 'एक क्लिक में अभिभावक के फोन पर अलर्ट संदेश भेजें'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {atGateOnlyStudents.map((std) => (
              <div
                key={std.id}
                className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded">
                    Gate In, No Class In
                  </span>
                  <p className="font-bold text-slate-900 mt-1">{std.name} (Roll: {std.rollNo})</p>
                  <p className="text-[11px] text-slate-600">पिता: {std.fatherName} • {std.parentPhone}</p>
                </div>
                <button
                  onClick={() => sendWhatsAppAlert(std, 'missing_class')}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            ))}

            {absentStudents.map((std) => (
              <div
                key={std.id}
                className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-1.5 py-0.2 rounded">
                    {t('absent')}
                  </span>
                  <p className="font-bold text-slate-900 mt-1">{std.name} (Roll: {std.rollNo})</p>
                  <p className="text-[11px] text-slate-600">पिता: {std.fatherName} • {std.parentPhone}</p>
                </div>
                <button
                  onClick={() => sendWhatsAppAlert(std, 'not_arrived')}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Class Roster Card Grid */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <h3 className="font-bold text-base text-slate-900">
            {language === 'en' ? `Full Class Roster (${activeClass})` : `पूरी कक्षा सूची (${activeClass})`}
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {classStudents
            .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.rollNo.includes(searchQuery))
            .map((std) => {
              const hasStep3 = todayScans.some((sc) => sc.studentId === std.id && sc.step === 3);
              const hasStep2 = todayScans.some((sc) => sc.studentId === std.id && sc.step === 2);

              return (
                <div
                  key={std.id}
                  className={`p-3.5 rounded-2xl border transition flex flex-col justify-between ${
                    hasStep3
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : hasStep2
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-14 rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shrink-0">
                      {std.photoDataUrl ? (
                        <img src={std.photoDataUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-sm">
                          {std.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 truncate">{std.name}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">Roll: {std.rollNo}</p>
                      <span
                        className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                          hasStep3
                            ? 'bg-emerald-100 text-emerald-800'
                            : hasStep2
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {hasStep3
                          ? (language === 'en' ? 'Class In ✓' : 'कक्षा में उपस्थित ✓')
                          : hasStep2
                          ? (language === 'en' ? 'Gate In Only' : 'केवल गेट पर आया')
                          : (language === 'en' ? 'Absent' : 'अनुपस्थित')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500">{std.parentPhone}</span>
                    <button
                      onClick={() => sendWhatsAppAlert(std, hasStep2 ? 'missing_class' : 'not_arrived')}
                      className="text-emerald-700 hover:text-emerald-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* QR Scanner Modal for Teacher */}
      {scannerOpen && (
        <QRScannerModal
          isOpen={scannerOpen}
          step={3}
          onClose={() => setScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
          schoolId={currentUser.schoolId}
        />
      )}
    </div>
  );
};
