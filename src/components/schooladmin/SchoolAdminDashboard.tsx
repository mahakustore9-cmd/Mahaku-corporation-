import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Users,
  IdCard,
  Phone,
  MessageCircle,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Upload,
  Camera,
  School as SchoolIcon,
  Filter,
  Sparkles,
  Heart,
  Calendar,
  Edit,
  Trash2,
  X,
  AlertCircle,
  Copy,
  Check,
  Share2,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import { Student, User, UserRole, StepType, JOURNEY_STEPS } from '../../types';
import { dbStore, getTodayDateString } from '../../services/dbStore';
import { compressStudentPhoto } from '../../services/imageCompression';
import {
  getStudentPhotoBucketUrl,
  getStudentPhotoSrc,
  uploadStudentPhotoToSupabase,
} from '../../services/supabaseClient';
import { StudentIdCardModal } from './StudentIdCardModal';
import { useLanguage } from '../../services/languageContext';

interface SchoolAdminDashboardProps {
  currentUser: User;
  activeNavTab?: string;
  onNavTabChange?: (tab: string) => void;
  navAction?: string | null;
  onClearNavAction?: () => void;
}

export const SchoolAdminDashboard: React.FC<SchoolAdminDashboardProps> = ({
  currentUser,
  activeNavTab,
  onNavTabChange,
  navAction,
  onClearNavAction,
}) => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTabState] = useState<'journey' | 'students' | 'staff'>('journey');

  const setActiveTab = (tab: 'journey' | 'students' | 'staff') => {
    setActiveTabState(tab);
    if (onNavTabChange) onNavTabChange(tab);
  };

  useEffect(() => {
    if (activeNavTab && (activeNavTab === 'journey' || activeNavTab === 'students' || activeNavTab === 'staff')) {
      setActiveTabState(activeNavTab);
    }
  }, [activeNavTab]);

  const [students, setStudents] = useState<Student[]>(
    dbStore.getStudents(currentUser.schoolId)
  );
  const [users, setUsers] = useState<User[]>(
    dbStore.getUsers().filter((u) => u.schoolId === currentUser.schoolId)
  );

  // Modal States
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<User | null>(null);
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Class & Roster Filters
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [rosterFilter, setRosterFilter] = useState<'ALL' | 'PRESENT' | 'DEPARTED' | 'ABSENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit Student Form Fields
  const [stdName, setStdName] = useState('');
  const [stdRoll, setStdRoll] = useState('');
  const [stdClass, setStdClass] = useState('Class 5-A');
  const [stdBlood, setStdBlood] = useState('B+');
  const [stdFather, setStdFather] = useState('');
  const [stdParentPhone, setStdParentPhone] = useState('');
  const [stdEmergencyPhone, setStdEmergencyPhone] = useState('');
  const [stdAddress, setStdAddress] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [compressedPhotoBlob, setCompressedPhotoBlob] = useState<Blob | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Dedicated Parent Login Credentials inside Add Student
  const [parentUsername, setParentUsername] = useState('');
  const [parentPassword, setParentPassword] = useState('parent123');
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Staff Form Fields
  const [staffRole, setStaffRole] = useState<UserRole>('GUARD');
  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('staff123');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffClass, setStaffClass] = useState('Class 5-A');

  // Live Simulated Scan Banner
  const [recentLiveScan, setRecentLiveScan] = useState<{
    student: Student;
    step: StepType;
    time: string;
    status: string;
  } | null>(null);

  // Copy Feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Handle external BottomNav actions
  useEffect(() => {
    if (navAction === 'add-student-action') {
      handleOpenAddStudent();
      if (onClearNavAction) onClearNavAction();
    }
  }, [navAction]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const refreshAll = () => {
    setStudents(dbStore.getStudents(currentUser.schoolId));
    setUsers(dbStore.getUsers().filter((u) => u.schoolId === currentUser.schoolId));
  };

  const handleOpenAddStudent = () => {
    setStdName('');
    setStdRoll(`R-${Math.floor(100 + Math.random() * 900)}`);
    setStdClass('Class 5-A');
    setStdBlood('B+');
    setStdFather('');
    setStdParentPhone('');
    setStdEmergencyPhone('');
    setStdAddress('');
    setPhotoPreview('');
    setCompressedPhotoBlob(null);
    setParentUsername('');
    setParentPassword('parent123');
    setShowPasswordText(false);
    setShowAddStudentModal(true);
  };

  useEffect(() => {
    if (showAddStudentModal && stdRoll) {
      const clean = stdRoll.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean && !parentUsername) {
        setParentUsername(`parent_${clean}`);
      }
    }
  }, [stdRoll, showAddStudentModal]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const cleanRoll =
        (stdRoll || 'std').trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'std';
      const compressed = await compressStudentPhoto(file, cleanRoll);
      setPhotoPreview(compressed.dataUrl); // local preview for UI
      setCompressedPhotoBlob(compressed.blob);
      showToast(
        language === 'en'
          ? `Photo compressed successfully (${compressed.sizeKb} KB, <50KB safe)`
          : `फोटो सफलतापूर्वक कंप्रेस हुई (${compressed.sizeKb} KB, <50KB सुरक्षित)`
      );
    } catch {
      showToast(
        language === 'en' ? 'Failed to process photo.' : 'फोटो प्रोसेसिंग में समस्या आई।',
        'error'
      );
    } finally {
      setIsCompressing(false);
    }
  };

  const safeOpenUrl = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleCopyCredentials = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    showToast(language === 'en' ? 'Credentials copied!' : 'विवरण कॉपी हो गया!');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoll = stdRoll.trim().replace(/\s+/g, '_');
    const cleanRollLower = cleanRoll.toLowerCase().replace(/[^a-z0-9]/g, '') || 'std';
    const photoKey = `std_${cleanRollLower}.jpg`;
    const qrToken = `SURAKSHA_STD_${cleanRoll.toUpperCase()}_${Date.now().toString().slice(-4)}`;
    const finalParentUsername =
      parentUsername.trim().toLowerCase() ||
      `parent_${cleanRollLower}`;
    const finalParentPassword = parentPassword.trim() || 'parent123';

    let finalPhotoUrl = getStudentPhotoBucketUrl(photoKey);

    if (compressedPhotoBlob) {
      setIsUploadingPhoto(true);
      try {
        const uploadRes = await uploadStudentPhotoToSupabase(compressedPhotoBlob, photoKey);
        if (uploadRes?.publicUrl) {
          finalPhotoUrl = uploadRes.publicUrl;
        }
      } catch (err) {
        console.warn('Storage upload error:', err);
      } finally {
        setIsUploadingPhoto(false);
      }
    }

    const newStudent = dbStore.addStudent({
      schoolId: currentUser.schoolId || 'sch_default',
      schoolName: currentUser.schoolName,
      name: stdName.trim(),
      rollNo: stdRoll.trim(),
      className: stdClass.trim(),
      bloodGroup: stdBlood,
      fatherName: stdFather.trim(),
      parentPhone: stdParentPhone.trim(),
      emergencyPhone: stdEmergencyPhone.trim() || stdParentPhone.trim(),
      address: stdAddress.trim(),
      photoKey,
      photoUrl: finalPhotoUrl,
      qrToken,
      parentUsername: finalParentUsername,
      parentPassword: finalParentPassword,
      isActive: true,
    });

    const parentUser = dbStore.addUser({
      fullName: `${stdFather.trim()} (${language === 'en' ? 'Parent' : 'अभिभावक'})`,
      username: finalParentUsername,
      email: `${finalParentUsername}@suraksha.in`,
      password: finalParentPassword,
      role: 'PARENT',
      schoolId: currentUser.schoolId,
      schoolName: currentUser.schoolName,
      phone: stdParentPhone.trim(),
      studentId: newStudent.id,
      isActive: true,
    });

    dbStore.updateStudent(newStudent.id, { parentId: parentUser.id });
    refreshAll();
    setShowAddStudentModal(false);
    showToast(
      language === 'en'
        ? `Student ${newStudent.name} and Parent account (${finalParentUsername}) created successfully!`
        : `छात्र ${newStudent.name} व अभिभावक खाता (${finalParentUsername}) बन गया!`
    );
    setSelectedStudentForCard(newStudent);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    const cleanRoll = stdRoll.trim().replace(/\s+/g, '_');
    const cleanRollLower = cleanRoll.toLowerCase().replace(/[^a-z0-9]/g, '') || 'std';
    const photoKey = editingStudent.photoKey || `std_${cleanRollLower}.jpg`;
    let finalPhotoUrl = editingStudent.photoUrl || getStudentPhotoBucketUrl(photoKey);

    if (compressedPhotoBlob) {
      setIsUploadingPhoto(true);
      try {
        const uploadRes = await uploadStudentPhotoToSupabase(compressedPhotoBlob, photoKey);
        if (uploadRes?.publicUrl) {
          finalPhotoUrl = uploadRes.publicUrl;
        }
      } catch (err) {
        console.warn('Storage upload error:', err);
      } finally {
        setIsUploadingPhoto(false);
      }
    }

    const finalParentUsername =
      parentUsername.trim().toLowerCase() || editingStudent.parentUsername || 'parent';
    const finalParentPassword = parentPassword.trim() || editingStudent.parentPassword || 'parent123';

    dbStore.updateStudent(editingStudent.id, {
      name: stdName.trim(),
      rollNo: stdRoll.trim(),
      className: stdClass.trim(),
      bloodGroup: stdBlood,
      fatherName: stdFather.trim(),
      parentPhone: stdParentPhone.trim(),
      emergencyPhone: stdEmergencyPhone.trim() || stdParentPhone.trim(),
      address: stdAddress.trim(),
      photoKey,
      photoUrl: finalPhotoUrl,
      parentUsername: finalParentUsername,
      parentPassword: finalParentPassword,
    });

    const usersList = dbStore.getUsers();
    const parentUser = usersList.find(
      (u) =>
        u.id === editingStudent.parentId ||
        u.studentId === editingStudent.id ||
        (editingStudent.parentUsername && u.username === editingStudent.parentUsername)
    );
    if (parentUser) {
      dbStore.updateUser(parentUser.id, {
        username: finalParentUsername,
        password: finalParentPassword,
        phone: stdParentPhone.trim(),
        fullName: `${stdFather.trim()} (${language === 'en' ? 'Parent' : 'अभिभावक'})`,
      });
    }

    refreshAll();
    setEditingStudent(null);
    showToast(
      language === 'en'
        ? `Student ${stdName} updated successfully!`
        : `छात्र ${stdName} का रिकॉर्ड अपडेट हो गया!`
    );
  };

  const handleOpenEditStudent = (std: Student) => {
    setEditingStudent(std);
    setStdName(std.name);
    setStdRoll(std.rollNo);
    setStdClass(std.className);
    setStdBlood(std.bloodGroup || 'B+');
    setStdFather(std.fatherName);
    setStdParentPhone(std.parentPhone);
    setStdEmergencyPhone(std.emergencyPhone || std.parentPhone);
    setStdAddress(std.address || '');
    setPhotoPreview(getStudentPhotoSrc(std));
    setCompressedPhotoBlob(null);
    setParentUsername(std.parentUsername || `parent_${std.rollNo.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
    setParentPassword(std.parentPassword || 'parent123');
    setShowPasswordText(false);
  };

  const handleConfirmDeleteStudent = () => {
    if (!studentToDelete) return;
    const deletedName = studentToDelete.name;
    const parentId = studentToDelete.parentId;
    dbStore.deleteStudent(studentToDelete.id);
    if (parentId) {
      dbStore.deleteUser(parentId);
    } else if (studentToDelete.parentUsername) {
      const parentUser = dbStore.getUsers().find((u) => u.username === studentToDelete.parentUsername);
      if (parentUser) dbStore.deleteUser(parentUser.id);
    }
    refreshAll();
    setStudentToDelete(null);
    showToast(
      language === 'en'
        ? `Student ${deletedName} deleted successfully.`
        : `छात्र ${deletedName} को हटा दिया गया।`
    );
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = staffUsername.trim().toLowerCase();
    dbStore.addUser({
      fullName: staffName.trim(),
      username: cleanUser,
      email: `${cleanUser}@suraksha.in`,
      password: staffPassword.trim() || 'staff123',
      role: staffRole,
      schoolId: currentUser.schoolId,
      schoolName: currentUser.schoolName,
      phone: staffPhone.trim(),
      assignedClass: staffRole === 'TEACHER' ? staffClass : undefined,
      isActive: true,
    });
    refreshAll();
    setShowAddStaffModal(false);
    showToast(
      language === 'en'
        ? `Staff member ${staffName} added successfully!`
        : `स्टाफ सदस्य ${staffName} जोड़ दिए गए!`
    );
  };

  const handleUpdateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    dbStore.updateUser(editingStaff.id, {
      fullName: staffName.trim(),
      username: staffUsername.trim().toLowerCase(),
      password: staffPassword.trim() || editingStaff.password,
      role: staffRole,
      phone: staffPhone.trim(),
      assignedClass: staffRole === 'TEACHER' ? staffClass : undefined,
    });
    refreshAll();
    setEditingStaff(null);
    showToast(
      language === 'en'
        ? `Staff ${staffName} updated successfully!`
        : `स्टाफ ${staffName} अपडेट हो गए!`
    );
  };

  const handleOpenEditStaff = (stf: User) => {
    setEditingStaff(stf);
    setStaffName(stf.fullName);
    setStaffUsername(stf.username);
    setStaffPassword(stf.password || 'staff123');
    setStaffRole(stf.role);
    setStaffPhone(stf.phone || '');
    setStaffClass(stf.assignedClass || 'Class 5-A');
  };

  const handleConfirmDeleteStaff = () => {
    if (!staffToDelete) return;
    const name = staffToDelete.fullName;
    dbStore.deleteUser(staffToDelete.id);
    refreshAll();
    setStaffToDelete(null);
    showToast(
      language === 'en'
        ? `Staff ${name} deleted successfully.`
        : `स्टाफ सदस्य ${name} हटा दिए गए।`
    );
  };

  const handleSimulateScan = async (std: Student) => {
    const todayStr = getTodayDateString();
    const journey = dbStore.getStudentDailyJourney(std.id, todayStr);
    let nextStep: StepType = 1;
    if (!journey.steps[1]) nextStep = 1;
    else if (!journey.steps[2]) nextStep = 2;
    else if (!journey.steps[3]) nextStep = 3;
    else if (!journey.steps[4]) nextStep = 4;
    else if (!journey.steps[5]) nextStep = 5;
    else nextStep = 2;

    const scannerUser: User = {
      ...currentUser,
      fullName:
        nextStep === 1 || nextStep === 5
          ? `${std.fatherName} (अभिभावक)`
          : nextStep === 3
          ? 'अध्यापक'
          : 'सुरक्षा गार्ड',
      role:
        nextStep === 1 || nextStep === 5
          ? 'PARENT'
          : nextStep === 3
          ? 'TEACHER'
          : 'GUARD',
    };

    const res = await dbStore.recordScan(
      std.id,
      nextStep,
      scannerUser,
      `Simulated Admin Scan - Step ${nextStep}`
    );

    setRecentLiveScan({
      student: std,
      step: nextStep,
      time: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: JOURNEY_STEPS[nextStep].titleHi,
    });
    refreshAll();
    showToast(res.messageHi);
  };

  const allClasses = Array.from(new Set(students.map((s) => s.className))).filter(Boolean);
  if (!allClasses.includes('Class 5-A')) allClasses.unshift('Class 5-A');
  if (!allClasses.includes('Class 6-B')) allClasses.push('Class 6-B');
  if (!allClasses.includes('Class 7-A')) allClasses.push('Class 7-A');
  if (!allClasses.includes('Class 8-C')) allClasses.push('Class 8-C');

  const today = getTodayDateString();
  const allTodayScans = dbStore.getScansForDate(today, currentUser.schoolId);

  const totalRoster = students.length;
  let presentCount = 0;
  let departedCount = 0;
  let absentCount = 0;

  students.forEach((s) => {
    const scans = allTodayScans.filter((sc) => sc.studentId === s.id);
    const hasGateOut = scans.some((sc) => sc.step === 4);
    const hasCheckedIn = scans.some((sc) => sc.step === 2 || sc.step === 3);
    if (hasGateOut) {
      departedCount++;
    } else if (hasCheckedIn) {
      presentCount++;
    } else {
      absentCount++;
    }
  });

  const filteredStudents = students.filter((s) => {
    const matchClass = selectedClass === 'ALL' || s.className === selectedClass;
    const matchQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.fatherName.toLowerCase().includes(searchQuery.toLowerCase());
    const scans = allTodayScans.filter((sc) => sc.studentId === s.id);
    const hasGateOut = scans.some((sc) => sc.step === 4);
    const hasCheckedIn = scans.some((sc) => sc.step === 2 || sc.step === 3);

    let matchRoster = true;
    if (rosterFilter === 'PRESENT') matchRoster = hasCheckedIn && !hasGateOut;
    else if (rosterFilter === 'DEPARTED') matchRoster = hasGateOut;
    else if (rosterFilter === 'ABSENT') matchRoster = !hasCheckedIn && !hasGateOut;

    return matchClass && matchQuery && matchRoster;
  });

  const getCardAccent = (idx: number) => {
    const styles = [
      {
        gradient: 'from-blue-600 via-indigo-600 to-indigo-700',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        border: 'hover:border-blue-400',
      },
      {
        gradient: 'from-emerald-600 via-teal-600 to-teal-700',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        border: 'hover:border-emerald-400',
      },
      {
        gradient: 'from-purple-600 via-violet-600 to-indigo-700',
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        border: 'hover:border-purple-400',
      },
      {
        gradient: 'from-amber-600 via-orange-600 to-rose-700',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        border: 'hover:border-amber-400',
      },
    ];
    return styles[idx % styles.length];
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5 pb-24">
      {/* Toast Feedback Banner */}
      {feedbackToast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border transition transform animate-in fade-in slide-in-from-top-4 ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {feedbackToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
          )}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <SchoolIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {currentUser.schoolName || (language === 'en' ? 'School Admin Portal' : 'स्कूल एडमिन पोर्टल')}
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                {t('role_school_admin')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentUser.fullName} • {language === 'en' ? '5-Step Student Journey Control' : '5-चरण छात्र यात्रा नियंत्रण केंद्र'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddStudent}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition active:scale-95 touch-manipulation cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('add_student')}</span>
          </button>
          <button
            onClick={() => {
              setStaffName('');
              setStaffUsername('');
              setStaffPassword('staff123');
              setStaffPhone('');
              setShowAddStaffModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition active:scale-95 touch-manipulation cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span>{t('add_staff')}</span>
          </button>
        </div>
      </div>

      {/* STATS SUMMARY BAR */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
        <div className="grid grid-cols-4 divide-x divide-slate-100 text-center">
          <div className="px-2">
            <span className="text-[11px] text-slate-500 font-bold block">
              {language === 'en' ? 'Total Roster' : 'कुल छात्र'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 block mt-0.5">{totalRoster}</span>
          </div>
          <div className="px-2">
            <span className="text-[11px] text-emerald-600 font-bold block">
              {language === 'en' ? 'Present' : 'उपस्थित'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 block mt-0.5">{presentCount}</span>
          </div>
          <div className="px-2">
            <span className="text-[11px] text-blue-600 font-bold block">
              {language === 'en' ? 'Departed' : 'घर रवाना (Out)'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-blue-600 block mt-0.5">{departedCount}</span>
          </div>
          <div className="px-2">
            <span className="text-[11px] text-rose-600 font-bold block">
              {language === 'en' ? 'Absent' : 'अनुपस्थित'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-600 block mt-0.5">{absentCount}</span>
          </div>
        </div>
      </div>

      {/* LIVE SCANNER RECOGNITION BOX */}
      {recentLiveScan && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-4 shadow-sm relative animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-emerald-800">
                {language === 'en' ? 'Live Scanner Recognition' : 'लाइव स्कैनर रिकॉर्डिंग व वॉइस अलर्ट'}
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-700">{recentLiveScan.time}</span>
          </div>
          <div className="flex items-center justify-between gap-4 mt-2.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-base flex items-center justify-center shadow shrink-0 overflow-hidden">
                {recentLiveScan.student.photoDataUrl ? (
                  <img src={recentLiveScan.student.photoDataUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{recentLiveScan.student.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm">{recentLiveScan.student.name}</p>
                <p className="text-xs text-slate-600">
                  {recentLiveScan.student.className} • Roll {recentLiveScan.student.rollNo}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-600 text-white">
                {recentLiveScan.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('journey')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap touch-manipulation cursor-pointer ${
            activeTab === 'journey'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>
            {language === 'en' ? '1. Live 5-Step Tracking' : '1. लाइव 5-स्टेप ट्रैकिंग'} ({filteredStudents.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap touch-manipulation cursor-pointer ${
            activeTab === 'students'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <IdCard className="w-4 h-4 text-blue-600" />
          <span>
            {language === 'en' ? '2. Students Directory' : '2. छात्र सूची व आईडी'} ({students.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap touch-manipulation cursor-pointer ${
            activeTab === 'staff'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Users className="w-4 h-4 text-amber-600" />
          <span>
            {language === 'en' ? '3. Staff Team' : '3. स्कूल स्टाफ टीम'} ({users.length})
          </span>
        </button>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setRosterFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                rosterFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('all')}
            </button>
            <button
              onClick={() => setRosterFilter('PRESENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                rosterFilter === 'PRESENT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('present')} ({presentCount})
            </button>
            <button
              onClick={() => setRosterFilter('DEPARTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                rosterFilter === 'DEPARTED'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('departed')} ({departedCount})
            </button>
            <button
              onClick={() => setRosterFilter('ABSENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                rosterFilter === 'ABSENT'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('absent')} ({absentCount})
            </button>
          </div>

          <div className="relative w-full sm:w-72 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0 pr-1">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('filter_class')}:</span>
          </span>
          <button
            onClick={() => setSelectedClass('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap touch-manipulation cursor-pointer ${
              selectedClass === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t('all_classes')} ({students.length})
          </button>
          {allClasses.map((cls) => {
            const countInClass = students.filter((s) => s.className === cls).length;
            const isSelected = selectedClass === cls;
            return (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 touch-manipulation cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{cls}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {countInClass}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: 5-STEP LIVE JOURNEY TRACKING BOARD */}
      {activeTab === 'journey' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-600 font-bold flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>
                {language === 'en' ? 'Date:' : 'दिनांक:'} <strong>{today}</strong>
              </span>
              <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {filteredStudents.length} {language === 'en' ? 'Students' : 'छात्र'}
              </span>
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold hidden sm:inline">
              ✓ {language === 'en' ? 'Real-time voice notifications enabled on scan' : 'हर स्कैन पर तुरंत वॉइस सूचना चालू है'}
            </span>
          </div>

          <div className="space-y-3">
            {filteredStudents.map((std, idx) => {
              const journey = dbStore.getStudentDailyJourney(std.id, today);
              const accent = getCardAccent(idx);

              return (
                <div
                  key={std.id}
                  className={`bg-white border border-slate-200 ${accent.border} rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-16 rounded-2xl overflow-hidden border-2 border-blue-500 bg-slate-100 shrink-0 shadow-xs">
                        {getStudentPhotoSrc(std) ? (
                          <img
                            src={getStudentPhotoSrc(std)}
                            alt={std.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-black text-blue-600 text-base">
                            {std.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 text-base">{std.name}</h4>
                          <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold px-2 py-0.5 rounded-md">
                            {std.rollNo}
                          </span>
                          <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-2 py-0.5 rounded-md">
                            {std.className}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {language === 'en' ? 'Father:' : 'पिता:'} <strong className="text-slate-800">{std.fatherName}</strong> • {t('parent_phone')}: {std.parentPhone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-center">
                      <button
                        onClick={() => handleSimulateScan(std)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 touch-manipulation cursor-pointer"
                        title={t('simulate_scan')}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>{t('simulate_scan')}</span>
                      </button>
                      <button
                        onClick={() => setSelectedStudentForCard(std)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 transition touch-manipulation cursor-pointer"
                        title={t('print_id_card')}
                      >
                        <IdCard className="w-3.5 h-3.5 text-blue-600" />
                        <span>{language === 'en' ? 'ID Card' : 'पहचान पत्र'}</span>
                      </button>
                      <button
                        onClick={() => safeOpenUrl(`https://wa.me/${std.parentPhone.replace(/[^0-9]/g, '')}`)}
                        className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition touch-manipulation cursor-pointer"
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-3">
                    <div className="grid grid-cols-5 gap-2 text-center">
                      {([1, 2, 3, 4, 5] as StepType[]).map((stepNum) => {
                        const stepScan = journey.steps[stepNum];
                        const stepDef = JOURNEY_STEPS[stepNum];
                        const isDone = Boolean(stepScan);
                        const isCurrent = journey.lastCompletedStep + 1 === stepNum && !journey.isComplete;

                        return (
                          <div
                            key={stepNum}
                            className={`p-2.5 rounded-2xl border transition ${
                              isDone
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-2xs'
                                : isCurrent
                                ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-2xs ring-2 ring-blue-400/30'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-center mb-1">
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              ) : isCurrent ? (
                                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                                  {stepNum}
                                </span>
                              ) : (
                                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center">
                                  {stepNum}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-bold truncate">
                              {language === 'en' ? stepDef.titleEn : stepDef.titleHi}
                            </p>
                            <span className="text-[10px] font-mono mt-0.5 block truncate text-slate-500">
                              {stepScan
                                ? new Date(stepScan.scannedAt).toLocaleTimeString('hi-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '--:--'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredStudents.length === 0 && (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-3xl text-slate-500">
                <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-700">{t('no_students_found')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STUDENTS DIRECTORY & PARENT LOGIN CREDENTIALS */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-600 font-bold">
              {language === 'en' ? 'Showing' : 'दिखाए गए'}: {filteredStudents.length} / {students.length}
            </span>
            <button
              onClick={handleOpenAddStudent}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 touch-manipulation cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('add_student')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((std, idx) => {
              const uName = std.parentUsername || `parent_${std.rollNo.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
              const pWord = std.parentPassword || 'parent123';
              const accent = getCardAccent(idx);
              const journey = dbStore.getStudentDailyJourney(std.id, today);

              return (
                <div
                  key={std.id}
                  className="bg-white border border-slate-200 hover:border-blue-400 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between group"
                >
                  <div className={`bg-gradient-to-r ${accent.gradient} p-3.5 text-white relative`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black tracking-wider bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full">
                        {std.className}
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-black/20 backdrop-blur-xs px-2 py-0.5 rounded-md text-amber-200">
                        {std.rollNo}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div className="flex items-start gap-3.5">
                      <div className="w-16 h-20 rounded-2xl overflow-hidden border-2 border-blue-400 bg-slate-100 shrink-0 shadow-xs relative">
                        {getStudentPhotoSrc(std) ? (
                          <img
                            src={getStudentPhotoSrc(std)}
                            alt={std.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center font-black text-blue-600 text-lg bg-blue-50">
                            <span>{std.name.charAt(0)}</span>
                            <span className="text-[9px] text-blue-500 font-sans mt-0.5">PHOTO</span>
                          </div>
                        )}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[7px] font-black px-1.5 py-0.2 rounded-full">
                          OK
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-900 text-base truncate group-hover:text-blue-600 transition">
                          {std.name}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5 truncate">
                          {language === 'en' ? 'Father:' : 'पिता:'} <strong className="text-slate-800">{std.fatherName}</strong>
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Heart className="w-2.5 h-2.5 fill-rose-500" />
                            <span>{std.bloodGroup || 'B+'}</span>
                          </span>
                          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {journey.completedCount}/5 {language === 'en' ? 'Steps' : 'चरण पूर्ण'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 font-mono font-medium">
                        <Phone className="w-3.5 h-3.5 text-blue-600" />
                        <span>{std.parentPhone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => safeOpenUrl(`tel:${std.parentPhone}`)}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white transition touch-manipulation cursor-pointer"
                          title={t('call')}
                        >
                          <Phone className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => safeOpenUrl(`https://wa.me/${std.parentPhone.replace(/[^0-9]/g, '')}`)}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white transition touch-manipulation cursor-pointer"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                          <span>{t('parent_credentials')}:</span>
                        </span>
                        <span className="text-[9px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                          Auto-Linked
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                        <div className="bg-white p-1.5 rounded-lg border border-amber-200 truncate">
                          <span className="text-[9px] text-slate-400 block font-sans">User:</span>
                          <span className="font-bold text-slate-900 truncate block">{uName}</span>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-amber-200 truncate">
                          <span className="text-[9px] text-slate-400 block font-sans">Pass:</span>
                          <span className="font-bold text-slate-900 truncate block">{pWord}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyCredentials(`User: ${uName} | Pass: ${pWord}`, `cred_${std.id}`)}
                          className="flex-1 py-1 px-2 rounded-lg bg-white hover:bg-slate-100 border border-amber-300 text-slate-700 text-[10px] font-bold flex items-center justify-center gap-1 transition touch-manipulation cursor-pointer"
                        >
                          {copiedKey === `cred_${std.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">{t('copied')}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>{t('copy')}</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const msg = encodeURIComponent(
                              `अभिभावक लॉगिन विवरण:\nछात्र: ${std.name} (${std.className})\nयूजरनेम: ${uName}\nपासवर्ड: ${pWord}\nलिंक: ${window.location.origin}`
                            );
                            safeOpenUrl(`https://wa.me/${std.parentPhone.replace(/[^0-9]/g, '')}?text=${msg}`);
                          }}
                          className="py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition touch-manipulation cursor-pointer"
                          title="Share credentials on WhatsApp"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedStudentForCard(std)}
                        className="flex-1 py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 touch-manipulation cursor-pointer"
                        title={t('print_id_card')}
                      >
                        <IdCard className="w-4 h-4" />
                        <span>{t('print_id_card')}</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditStudent(std)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs transition touch-manipulation cursor-pointer"
                        title={t('edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setStudentToDelete(std)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs transition touch-manipulation cursor-pointer"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: STAFF MANAGEMENT */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-600 font-bold">
              {language === 'en' ? 'School Security & Teachers' : 'स्कूल स्टाफ व शिक्षक'}: {users.length}
            </span>
            <button
              onClick={() => {
                setStaffName('');
                setStaffUsername('');
                setStaffPassword('staff123');
                setStaffPhone('');
                setShowAddStaffModal(true);
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 touch-manipulation cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('add_staff')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {users.map((stf) => (
              <div
                key={stf.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      stf.role === 'GUARD'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : stf.role === 'TEACHER'
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                  >
                    {stf.role === 'GUARD'
                      ? t('role_guard')
                      : stf.role === 'TEACHER'
                      ? `${t('role_teacher')} (${stf.assignedClass || 'Class 5-A'})`
                      : t('role_school_admin')}
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Active" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">{stf.fullName}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">@{stf.username}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{language === 'en' ? 'Password' : 'पासवर्ड'}:</span>
                    <span className="font-mono font-bold text-slate-800">{stf.password || '••••••'}</span>
                  </div>
                  {stf.phone && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{language === 'en' ? 'Phone' : 'फोन'}:</span>
                      <span className="font-mono">{stf.phone}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEditStaff(stf)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1 touch-manipulation cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{t('edit')}</span>
                  </button>
                  <button
                    onClick={() => setStaffToDelete(stf)}
                    className="py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition flex items-center justify-center gap-1 touch-manipulation cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('delete')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg">
                    {t('add_student')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t('auto_linked_parent_notice')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1 text-xs font-bold touch-manipulation cursor-pointer"
                title={t('close')}
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">{t('close')}</span>
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-4 mt-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-24 rounded-2xl overflow-hidden border-2 border-blue-400 bg-white shrink-0 shadow-xs flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1 text-center sm:text-left">
                  <label className="block text-xs font-bold text-slate-800">
                    {t('upload_photo')}
                  </label>
                  <p className="text-[10px] text-slate-500">
                    PWA ऑटो-कंप्रेशन (&lt;50KB) से स्टोरेज सुरक्षित रहती है
                  </p>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{photoPreview ? 'फोटो बदलें' : 'फोटो चुनें'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('student_name')} *</label>
                  <input
                    type="text"
                    required
                    value={stdName}
                    onChange={(e) => setStdName(e.target.value)}
                    placeholder="उदा. आरव शर्मा"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('roll_no')} *</label>
                  <input
                    type="text"
                    required
                    value={stdRoll}
                    onChange={(e) => setStdRoll(e.target.value)}
                    placeholder="उदा. R-101"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('class_name')} *</label>
                  <select
                    value={stdClass}
                    onChange={(e) => setStdClass(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {allClasses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="Class 9-A">Class 9-A</option>
                    <option value="Class 10-A">Class 10-A</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('blood_group')}</label>
                  <select
                    value={stdBlood}
                    onChange={(e) => setStdBlood(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('father_name')} *</label>
                  <input
                    type="text"
                    required
                    value={stdFather}
                    onChange={(e) => setStdFather(e.target.value)}
                    placeholder="पिता या अभिभावक का नाम"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('parent_phone')} *</label>
                  <input
                    type="tel"
                    required
                    value={stdParentPhone}
                    onChange={(e) => setStdParentPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('emergency_phone')}</label>
                  <input
                    type="tel"
                    value={stdEmergencyPhone}
                    onChange={(e) => setStdEmergencyPhone(e.target.value)}
                    placeholder="9876500000"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('address')}</label>
                  <input
                    type="text"
                    value={stdAddress}
                    onChange={(e) => setStdAddress(e.target.value)}
                    placeholder="घर का पता"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* AUTO-LINKED PARENT LOGIN CREDENTIALS SECTION */}
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-700" />
                  <span className="font-black text-amber-950 text-xs">
                    {t('parent_credentials')} (Auto-Linked Parent Account)
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  यह यूजरनेम व पासवर्ड छात्र के पहचान पत्र पर भी छपेंगे ताकि अभिभावक तुरंत लॉगिन कर सकें।
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t('parent_username')} *</label>
                    <input
                      type="text"
                      required
                      value={parentUsername}
                      onChange={(e) => setParentUsername(e.target.value)}
                      placeholder="उदा. parent_r101"
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t('parent_password')} *</label>
                    <div className="relative">
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        required
                        value={parentPassword}
                        onChange={(e) => setParentPassword(e.target.value)}
                        placeholder="parent123"
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-600 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isCompressing}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md shadow-blue-500/25 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>छात्र जोड़ें + ID कार्ड देखें</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base sm:text-lg">
                    {language === 'en' ? 'Edit Student Details' : 'छात्र विवरण संपादित करें'}
                  </h3>
                  <p className="text-[11px] text-slate-500">{editingStudent.name} ({editingStudent.rollNo})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-4 mt-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-24 rounded-2xl overflow-hidden border-2 border-blue-400 bg-white shrink-0 shadow-xs flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1 text-center sm:text-left">
                  <label className="block text-xs font-bold text-slate-800">
                    {t('upload_photo')}
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>फोटो बदलें</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('student_name')} *</label>
                  <input
                    type="text"
                    required
                    value={stdName}
                    onChange={(e) => setStdName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('roll_no')} *</label>
                  <input
                    type="text"
                    required
                    value={stdRoll}
                    onChange={(e) => setStdRoll(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('class_name')} *</label>
                  <select
                    value={stdClass}
                    onChange={(e) => setStdClass(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  >
                    {allClasses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('blood_group')}</label>
                  <select
                    value={stdBlood}
                    onChange={(e) => setStdBlood(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('father_name')} *</label>
                  <input
                    type="text"
                    required
                    value={stdFather}
                    onChange={(e) => setStdFather(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('parent_phone')} *</label>
                  <input
                    type="tel"
                    required
                    value={stdParentPhone}
                    onChange={(e) => setStdParentPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('parent_username')}</label>
                  <input
                    type="text"
                    value={parentUsername}
                    onChange={(e) => setParentUsername(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('parent_password')}</label>
                  <input
                    type="text"
                    value={parentPassword}
                    onChange={(e) => setParentPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-500/25 cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE STUDENT CONFIRMATION MODAL */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">{t('confirm_delete')}</h3>
                <p className="text-xs text-slate-500">{t('delete_warning')}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
              <p className="font-bold text-slate-800">
                {language === 'en' ? 'Student:' : 'छात्र:'} {studentToDelete.name} ({studentToDelete.rollNo}, {studentToDelete.className})
              </p>
              <p className="text-slate-500">
                {language === 'en' ? 'Parent phone:' : 'अभिभावक:'} {studentToDelete.fatherName} • {studentToDelete.parentPhone}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-500/25 cursor-pointer"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-base">{t('add_staff')}</h3>
              </div>
              <button onClick={() => setShowAddStaffModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">पद (Role) *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStaffRole('GUARD')}
                    className={`py-2 px-3 rounded-xl font-bold border transition cursor-pointer ${
                      staffRole === 'GUARD'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    🛡️ {t('role_guard')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffRole('TEACHER')}
                    className={`py-2 px-3 rounded-xl font-bold border transition cursor-pointer ${
                      staffRole === 'TEACHER'
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    🎓 {t('role_teacher')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">पूरा नाम (Full Name) *</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="उदा. रमेश सिंह"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">यूजरनेम *</label>
                <input
                  type="text"
                  required
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value)}
                  placeholder="उदा. guardramesh"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">पासवर्ड *</label>
                <input
                  type="text"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="staff123"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
              </div>

              {staffRole === 'TEACHER' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">कक्षा (Assigned Class)</label>
                  <select
                    value={staffClass}
                    onChange={(e) => setStaffClass(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  >
                    {allClasses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">मोबाइल नंबर</label>
                <input
                  type="tel"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md shadow-blue-500/25 cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE STAFF MODAL */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">स्टाफ हटाएं?</h3>
                <p className="text-xs text-slate-500">{staffToDelete.fullName} (@{staffToDelete.username})</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT ID CARD MODAL */}
      {selectedStudentForCard && (
        <StudentIdCardModal
          student={selectedStudentForCard}
          onClose={() => setSelectedStudentForCard(null)}
        />
      )}
    </div>
  );
};
