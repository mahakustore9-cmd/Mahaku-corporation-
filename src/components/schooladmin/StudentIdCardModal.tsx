import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Printer,
  Download,
  Phone,
  ShieldCheck,
  School as SchoolIcon,
  Heart,
  User,
  MapPin,
  Layers,
  KeyRound,
} from 'lucide-react';
import { Student, School } from '../../types';
import { dbStore } from '../../services/dbStore';
import { useLanguage } from '../../services/languageContext';
import { getStudentPhotoSrc } from '../../services/supabaseClient';

interface StudentIdCardModalProps {
  student: Student | null;
  onClose: () => void;
}

export const StudentIdCardModal: React.FC<StudentIdCardModalProps> = ({ student, onClose }) => {
  const { language, t } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [school, setSchool] = useState<School | null>(null);
  const [cardSide, setCardSide] = useState<'front' | 'back' | 'both'>('front');
  const [copiedLogin, setCopiedLogin] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (student) {
      const sch = dbStore.getSchools().find((s) => s.id === student.schoolId);
      setSchool(sch || null);

      // Generate High-Resolution QR Code (380x380)
      QRCode.toDataURL(student.qrToken, {
        width: 380,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error:', err));
    }
  }, [student]);

  if (!student) return null;

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.print();
  };

  const handleDownloadQR = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${student.name.replace(/\s+/g, '_')}_QR_Code.png`;
    a.click();
  };

  const handleCopyCredentials = () => {
    const uName = student.parentUsername || `parent_${student.rollNo.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const pWord = student.parentPassword || 'parent123';
    navigator.clipboard.writeText(`यूजरनेम: ${uName}\nपासवर्ड: ${pWord}`);
    setCopiedLogin(true);
    setTimeout(() => setCopiedLogin(false), 2500);
  };

  const parentUName = student.parentUsername || `parent_${student.rollNo.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const parentPWord = student.parentPassword || 'parent123';

  // Front Side Component
  const renderFrontCard = () => (
    <div
      key="front-card"
      className="id-card-printable-item bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-900 mx-auto select-none w-full max-w-[340px]"
    >
      {/* Lanyard Hole Slot simulation */}
      <div className="bg-slate-900 pt-2 pb-1.5 flex justify-center items-center">
        <div className="w-14 h-2.5 bg-slate-800 rounded-full border border-slate-700 shadow-inner" />
      </div>

      {/* School Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-blue-900 text-white p-3 text-center relative">
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <div className="p-1 rounded-lg bg-white/10 text-amber-300 shrink-0">
            <SchoolIcon className="w-4 h-4" />
          </div>
          <h2 className="font-black text-xs sm:text-sm tracking-wide leading-tight uppercase text-white truncate max-w-[240px]">
            {school?.name || student.schoolName || 'DELHI PUBLIC MODEL SCHOOL'}
          </h2>
        </div>
        <p className="text-[9px] text-blue-200 tracking-wider">
          {school?.code ? `REG: ${school.code}` : 'GOVT. RECOGNIZED'} • IDENTITY CARD
        </p>
        {/* Gold security ribbon */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 absolute bottom-0 left-0 right-0 shadow-sm" />
      </div>

      {/* Card Body */}
      <div className="p-3.5 bg-gradient-to-b from-blue-50/70 via-white to-slate-50">
        {/* Student Photo & Top Badge */}
        <div className="flex gap-3 items-start">
          <div className="relative shrink-0">
            <div className="w-24 h-28 rounded-2xl overflow-hidden border-2 border-blue-900 bg-slate-100 shadow-md">
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
                <div className="w-full h-full flex flex-col items-center justify-center bg-blue-100 text-blue-900 text-sm font-black">
                  <User className="w-8 h-8 text-blue-600 mb-1" />
                  <span>{student.name.charAt(0)}</span>
                </div>
              )}
            </div>
            {/* Status Pill */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-0.5 whitespace-nowrap">
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>VERIFIED</span>
            </div>
          </div>

          {/* Student Essential Details */}
          <div className="flex-1 min-w-0">
            <div className="border-b border-slate-200 pb-1.5 mb-1.5">
              <h3 className="font-black text-slate-900 text-base leading-tight uppercase truncate">
                {student.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-block px-2 py-0.5 bg-blue-900 text-white font-bold text-[10px] rounded-md tracking-wider uppercase">
                  {student.className}
                </span>
                <span className="inline-block px-1.5 py-0.5 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-md border border-rose-300">
                  {student.bloodGroup || 'B+'}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-[11px] text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Roll No:</span>
                <span className="font-bold text-slate-900 font-mono">{student.rollNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Father:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[110px]">
                  {student.fatherName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Contact:</span>
                <span className="font-bold text-blue-900 font-mono text-[10px]">
                  {student.parentPhone}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact & Address Bar */}
        <div className="mt-3 pt-2 border-t border-slate-200 grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 flex items-center gap-1 font-medium text-[9px]">
              <Phone className="w-2.5 h-2.5 text-blue-600" />
              School Helpline:
            </span>
            <span className="font-bold text-slate-900 block mt-0.5 truncate font-mono text-[10px]">
              {school?.phone || student.emergencyPhone || student.parentPhone}
            </span>
          </div>
          <div className="bg-rose-50 p-1.5 rounded-xl border border-rose-200 text-rose-950">
            <span className="text-rose-600 flex items-center gap-1 font-medium text-[9px]">
              <Heart className="w-2.5 h-2.5 text-rose-600 fill-rose-600" />
              Emergency:
            </span>
            <span className="font-bold block mt-0.5 truncate font-mono text-[10px]">
              {student.emergencyPhone || student.parentPhone}
            </span>
          </div>
        </div>

        {/* Address */}
        {student.address && (
          <div className="mt-2 text-[9px] text-slate-600 flex items-start gap-1 bg-white p-1.5 rounded-xl border border-slate-200">
            <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="truncate">{student.address}</span>
          </div>
        )}

        {/* QR Code & Authority Stamp */}
        <div className="mt-3 pt-2.5 border-t-2 border-slate-200 flex items-center justify-between">
          {/* Clean Crisp QR */}
          <div className="text-center">
            <div className="w-20 h-20 p-1 bg-white rounded-xl border-2 border-blue-900 shadow-sm mx-auto">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Student QR Code"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-slate-100 animate-pulse" />
              )}
            </div>
            <span className="text-[7.5px] font-mono font-bold text-slate-600 mt-1 block">
              JOURNEY SCAN QR
            </span>
          </div>

          {/* Principal Stamp */}
          <div className="text-right flex flex-col justify-end items-end h-20 pb-1">
            <div className="w-20 h-7 border-b border-blue-900 flex items-center justify-center italic text-blue-950 font-serif text-[11px] select-none">
              Principal
            </div>
            <span className="text-[9px] font-black text-slate-800 mt-1 uppercase">
              Authorized Signatory
            </span>
            <span className="text-[8px] text-slate-500">Session: 2026-2027</span>
          </div>
        </div>
      </div>

      {/* Bottom Security Band */}
      <div className="bg-blue-950 text-white py-1 px-3 text-center text-[8px] tracking-widest uppercase flex justify-between items-center font-mono">
        <span>SURAKSHA TRACK PWA</span>
        <span>ROLL: {student.rollNo}</span>
      </div>
    </div>
  );

  // Back Side Component
  const renderBackCard = () => (
    <div
      key="back-card"
      className="id-card-printable-item bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-900 mx-auto select-none w-full max-w-[340px] flex flex-col justify-between"
    >
      {/* Lanyard Hole Slot */}
      <div className="bg-slate-900 pt-2 pb-1.5 flex justify-center items-center">
        <div className="w-14 h-2.5 bg-slate-800 rounded-full border border-slate-700 shadow-inner" />
      </div>

      <div className="p-4 bg-gradient-to-b from-slate-50 via-white to-blue-50 text-slate-800 flex-1 flex flex-col justify-between text-xs">
        <div>
          <div className="text-center border-b border-slate-200 pb-2 mb-2.5">
            <h4 className="font-black text-xs text-blue-900 uppercase">
              सुरक्षा व दिशा-निर्देश (Rules & Guidelines)
            </h4>
            <p className="text-[9px] text-slate-500">SURAKSHA TRACK 5-STEP JOURNEY</p>
          </div>

          <ul className="text-[9.5px] space-y-1.5 text-slate-700 list-disc pl-4 leading-relaxed">
            <li>यह कार्ड छात्र को स्कूल समय में हमेशा गले में पहनना अनिवार्य है।</li>
            <li>गेट पर सुरक्षा गार्ड द्वारा QR स्कैन होते ही माता-पिता को वॉइस मैसेज प्राप्त होगा।</li>
            <li>खो जाने पर तत्काल स्कूल कार्यालय में सूचना दें।</li>
            <li>आपातकाल में दिए गए हेल्पलाइन नंबर पर तुरंत संपर्क करें।</li>
          </ul>

          {/* PARENT APP LOGIN BOX ON ID CARD BACK */}
          <div className="mt-3 p-2.5 bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl shadow-inner border border-blue-800">
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-blue-800/80">
              <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-amber-400" />
                <span>अभिभावक लॉगिन:</span>
              </span>
              <span className="text-[8px] bg-blue-800 text-blue-200 px-1 py-0.2 rounded font-mono">
                App Login
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mt-1">
              <div>
                <span className="text-[8px] text-blue-300 block font-sans">यूजरनेम:</span>
                <strong className="text-amber-200 truncate block">{parentUName}</strong>
              </div>
              <div>
                <span className="text-[8px] text-blue-300 block font-sans">पासवर्ड:</span>
                <strong className="text-emerald-300 truncate block">{parentPWord}</strong>
              </div>
            </div>
          </div>

          {/* School Contact Box */}
          <div className="mt-3 p-2 bg-blue-50 rounded-xl border border-blue-200 text-[9.5px]">
            <p className="font-bold text-blue-900">स्कूल पता:</p>
            <p className="text-slate-600 mt-0.5 truncate">
              {school?.address || student.address || ''}
            </p>
            <p className="mt-0.5 font-bold text-blue-900">फोन: {school?.phone || student.emergencyPhone || student.parentPhone}</p>
          </div>
        </div>

        <div className="text-center pt-2 border-t border-slate-200 mt-2">
          <span className="text-[8px] text-slate-500 font-mono">
            TOKEN: {student.qrToken}
          </span>
        </div>
      </div>

      {/* Bottom Security Band */}
      <div className="bg-blue-950 text-white py-1 px-3 text-center text-[8px] tracking-widest uppercase flex justify-between items-center font-mono">
        <span>SURAKSHA TRACK PWA</span>
        <span>BACK SIDE</span>
      </div>
    </div>
  );

  return (
    <div
      className="id-card-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="id-card-modal-box w-full max-w-2xl rounded-3xl bg-white border border-slate-200 p-3 sm:p-6 text-slate-900 shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar with Cut / Close Button */}
        <div className="no-print flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900">
                {language === 'en' ? 'Student ID Card (Digital & Print)' : 'छात्र डिजिटल पहचान पत्र (Student ID Card)'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {student.name} • {student.rollNo} • {student.className}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 font-bold text-xs border border-slate-200 touch-manipulation cursor-pointer"
            title={t('cut_close')}
          >
            <X className="w-4 h-4 text-slate-500" />
            <span>{t('cut_close')}</span>
          </button>
        </div>

        {/* View & Print Mode Switcher */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 my-3 p-2 bg-slate-100 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-bold px-1">
              {language === 'en' ? 'View:' : 'दृश्य:'}
            </span>
            <button
              type="button"
              onClick={() => setCardSide('front')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                cardSide === 'front'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {language === 'en' ? 'Front' : 'सामने (Front)'}
            </button>
            <button
              type="button"
              onClick={() => setCardSide('back')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                cardSide === 'back'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {language === 'en' ? 'Back' : 'पीछे (Back)'}
            </button>
            <button
              type="button"
              onClick={() => setCardSide('both')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                cardSide === 'both'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'Both Sides' : 'दोनों (Both)'}</span>
            </button>
          </div>

          {/* Action Buttons: Print & QR Download */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-1.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 touch-manipulation cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('print_id_card')}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadQR}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition shadow-2xs touch-manipulation cursor-pointer"
              title={t('download_image')}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Parent Login Summary Badge */}
        <div className="no-print mb-3 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <KeyRound className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="text-amber-950 text-[11px]">
              {language === 'en' ? 'Parent Login:' : 'अभिभावक लॉगिन:'} <strong className="font-mono">{parentUName}</strong> | {language === 'en' ? 'Pass:' : 'पासवर्ड:'} <strong className="font-mono">{parentPWord}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCredentials}
            className="text-[10px] font-bold px-2 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg transition shrink-0 cursor-pointer"
          >
            {copiedLogin ? t('copied') : t('copy')}
          </button>
        </div>

        {/* PRINTABLE ID CARD CONTAINER */}
        <div ref={cardRef} className="id-card-print-area">
          {cardSide === 'front' && renderFrontCard()}
          {cardSide === 'back' && renderBackCard()}
          {cardSide === 'both' && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
              {renderFrontCard()}
              {renderBackCard()}
            </div>
          )}
        </div>

        {/* Modal Bottom Actions with Cut Button */}
        <div className="no-print mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            {language === 'en'
              ? "Select 'A4' or 'ID Card' in print dialog. No clipped borders."
              : "प्रिंट में 'A4' या 'ID Card' चुनें। कोई बॉर्डर कटेगा नहीं।"}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 touch-manipulation cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('print')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition touch-manipulation cursor-pointer"
            >
              {t('cut_close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
