import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Camera,
  DoorOpen,
  Clock,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { Student, User, StepType } from '../../types';
import { dbStore, getTodayDateString } from '../../services/dbStore';
import { QRScannerModal } from '../common/QRScannerModal';
import { unlockAudio } from '../../services/soundService';
import { useLanguage } from '../../services/languageContext';

interface GuardDashboardProps {
  currentUser: User;
  activeNavTab?: string;
  onNavTabChange?: (tab: string) => void;
  navAction?: string | null;
  onClearNavAction?: () => void;
}

export const GuardDashboard: React.FC<GuardDashboardProps> = ({
  currentUser,
  activeNavTab,
  navAction,
  onClearNavAction,
}) => {
  const { language } = useLanguage();
  const [activeStep, setActiveStep] = useState<StepType>(2); // Step 2 (Gate In) or Step 4 (Gate Out)
  const [scannerOpen, setScannerOpen] = useState(false);
  const [recentScanResult, setRecentScanResult] = useState<{
    student: Student;
    step: StepType;
    message: string;
    time: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync with BottomNav
  useEffect(() => {
    if (activeNavTab === 'gate-in') setActiveStep(2);
    if (activeNavTab === 'gate-out') setActiveStep(4);
  }, [activeNavTab]);

  useEffect(() => {
    if (navAction === 'scan-action') {
      handleStartScan(activeStep);
      if (onClearNavAction) onClearNavAction();
    }
  }, [navAction, activeStep, onClearNavAction]);

  const today = getTodayDateString();
  const allTodayScans = dbStore
    .getScansForDate(today, currentUser.schoolId)
    .filter((s) => s.step === 2 || s.step === 4)
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

  const handleStartScan = (step: StepType) => {
    unlockAudio();
    setActiveStep(step);
    setErrorMsg(null);
    setScannerOpen(true);
  };

  const handleScanSuccess = async (student: Student) => {
    try {
      const result = await dbStore.recordScan(
        student.id,
        activeStep,
        currentUser,
        activeStep === 2 ? 'Main Gate In Entry' : 'School Dismissal Exit'
      );
      setRecentScanResult({
        student,
        step: activeStep,
        message: result.messageHi,
        time: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }),
      });
      setErrorMsg(null);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
      {/* Top Welcome Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {language === 'en' ? 'Security Gate QR Scanner' : 'सुरक्षा गार्ड मुख्य द्वार स्कैनर'}
            </h2>
            <p className="text-xs text-slate-500">
              {currentUser.fullName} • Gate 1 • {currentUser.schoolName}
            </p>
          </div>
        </div>
        <p className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-2xl border border-emerald-200 flex items-center gap-2 mt-2">
          <Volume2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>
            {language === 'en'
              ? 'Scanning student QR code triggers immediate voice notification on parent mobile device.'
              : 'छात्र का QR स्कैन करते ही माता-पिता के फोन पर स्वचालित आवाज अलर्ट जाएगी।'}
          </span>
        </p>
      </div>

      {/* Main Scan Trigger Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Button 1: Gate In Entry (Step 2) */}
        <button
          onClick={() => handleStartScan(2)}
          className="relative group p-6 rounded-3xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/25 transition transform active:scale-98 flex flex-col items-center text-center touch-manipulation cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-0.5 rounded-full mb-1">
            {language === 'en' ? 'Step 2 • Morning In' : 'चरण 2 • स्कूल प्रवेश'}
          </span>
          <h3 className="text-2xl font-black tracking-tight">
            {language === 'en' ? 'Gate Entry Scan' : 'गेट इन (प्रवेश) स्कैन'}
          </h3>
          <p className="text-xs text-emerald-100 mt-1 max-w-xs">
            {language === 'en' ? 'Triggers: "Your child has entered school on time."' : 'ध्वनि: "आपका बच्चा सुरक्षित स्कूल गेट के अंदर पहुँच चुका है"'}
          </p>
        </button>

        {/* Button 2: Gate Out Exit (Step 4) */}
        <button
          onClick={() => handleStartScan(4)}
          className="relative group p-6 rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/25 transition transform active:scale-98 flex flex-col items-center text-center touch-manipulation cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
            <DoorOpen className="w-8 h-8 text-white" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-0.5 rounded-full mb-1">
            {language === 'en' ? 'Step 4 • Dismissal Out' : 'चरण 4 • स्कूल छुट्टी'}
          </span>
          <h3 className="text-2xl font-black tracking-tight">
            {language === 'en' ? 'Gate Exit Scan' : 'गेट आउट (निकास) स्कैन'}
          </h3>
          <p className="text-xs text-indigo-100 mt-1 max-w-xs">
            {language === 'en' ? 'Triggers: "Your child has left school."' : 'ध्वनि: "छात्र स्कूल की छुट्टी के बाद गेट से बाहर निकल चुका है"'}
          </p>
        </button>
      </div>

      {/* Error Message Notice */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Banner of Most Recent Scan */}
      {recentScanResult && (
        <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
              ✓
            </div>
            <div>
              <p className="font-bold text-slate-900 text-base">
                {recentScanResult.student.name} ({recentScanResult.student.rollNo})
              </p>
              <p className="text-xs text-emerald-800 font-medium">{recentScanResult.message}</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">{recentScanResult.time}</span>
        </div>
      )}

      {/* Recent Gate Scan Logs */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">
              {language === 'en' ? "Today's Gate Scan Logs" : 'आज के गेट स्कैन रिकॉर्ड्स'}
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            {allTodayScans.length} {language === 'en' ? 'Scans' : 'स्कैन'}
          </span>
        </div>

        {allTodayScans.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            {language === 'en' ? 'No scans recorded today. Tap a button above to scan student ID cards.' : 'आज अभी तक कोई स्कैन नहीं हुआ। ऊपर दिए गए बटन से स्कैन शुरू करें।'}
          </div>
        ) : (
          <div className="space-y-2">
            {allTodayScans.map((scan) => {
              const std = dbStore.getStudents(currentUser.schoolId).find((s) => s.id === scan.studentId);
              return (
                <div
                  key={scan.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        scan.step === 2
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {scan.step === 2 ? 'प्रवेश (Entry)' : 'निकास (Exit)'}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{std?.name || 'छात्र'}</p>
                      <p className="text-[10px] text-slate-500">
                        Roll: {std?.rollNo} • {std?.className}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-slate-600 font-bold">
                    {new Date(scan.scannedAt).toLocaleTimeString('hi-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Scanner Modal for Guard */}
      {scannerOpen && (
        <QRScannerModal
          isOpen={scannerOpen}
          step={activeStep}
          onClose={() => setScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
          schoolId={currentUser.schoolId}
        />
      )}
    </div>
  );
};
