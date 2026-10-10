import React, { useState, useEffect } from 'react';
import {
  School as SchoolIcon,
  Plus,
  ShieldCheck,
  UserPlus,
  Power,
  Users,
  Search,
  Database,
  Building2,
  Edit,
  Trash2,
  X,
} from 'lucide-react';
import { School, User } from '../../types';
import { dbStore } from '../../services/dbStore';
import { useLanguage } from '../../services/languageContext';

interface SuperadminDashboardProps {
  currentUser: User;
  onOpenSupabase: () => void;
  activeNavTab?: string;
  onNavTabChange?: (tab: string) => void;
  navAction?: string | null;
  onClearNavAction?: () => void;
}

export const SuperadminDashboard: React.FC<SuperadminDashboardProps> = ({
  onOpenSupabase,
  navAction,
  onClearNavAction,
}) => {
  const { language, t } = useLanguage();
  const [schools, setSchools] = useState<School[]>(dbStore.getSchools());
  const [users, setUsers] = useState<User[]>(dbStore.getUsers());
  const [students, setStudents] = useState(dbStore.getStudents());
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle BottomNav actions
  useEffect(() => {
    if (navAction === 'add-school-action') {
      setShowAddModal(true);
      if (onClearNavAction) onClearNavAction();
    } else if (navAction === 'database-action') {
      onOpenSupabase();
      if (onClearNavAction) onClearNavAction();
    }
  }, [navAction, onClearNavAction, onOpenSupabase]);

  // Form State
  const [schoolName, setSchoolName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('school123');
  const [formSuccess, setFormSuccess] = useState(false);

  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editSchoolCode, setEditSchoolCode] = useState('');
  const [editSchoolPhone, setEditSchoolPhone] = useState('');
  const [editPrincipalName, setEditPrincipalName] = useState('');
  const [editSchoolAddress, setEditSchoolAddress] = useState('');

  const refreshData = () => {
    setSchools(dbStore.getSchools());
    setUsers(dbStore.getUsers());
    setStudents(dbStore.getStudents());
  };

  const handleOpenEditSchool = (school: School) => {
    setEditingSchool(school);
    setEditSchoolName(school.name);
    setEditSchoolCode(school.code);
    setEditSchoolPhone(school.phone);
    setEditPrincipalName(school.principalName);
    setEditSchoolAddress(school.address);
  };

  const handleUpdateSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    dbStore.updateSchool(editingSchool.id, {
      name: editSchoolName,
      code: editSchoolCode.toUpperCase(),
      phone: editSchoolPhone,
      principalName: editPrincipalName,
      address: editSchoolAddress,
    });
    setEditingSchool(null);
    refreshData();
  };

  const handleConfirmDeleteSchool = () => {
    if (!schoolToDelete) return;
    dbStore.deleteSchool(schoolToDelete.id);
    refreshData();
    setSchoolToDelete(null);
  };

  const handleCreateSchool = (e: React.FormEvent) => {
    e.preventDefault();
    // 1. Create School
    const newSchool = dbStore.addSchool({
      name: schoolName,
      code: schoolCode.toUpperCase(),
      address: schoolAddress,
      phone: schoolPhone,
      principalName,
      isActive: true,
      adminEmail,
    });

    // 2. Create School Admin User
    dbStore.addUser({
      fullName: adminName || principalName,
      username: adminUsername.toLowerCase(),
      email: adminEmail.toLowerCase() || `${adminUsername.toLowerCase()}@suraksha.in`,
      password: adminPassword,
      role: 'SCHOOL_ADMIN',
      schoolId: newSchool.id,
      schoolName: newSchool.name,
      phone: schoolPhone,
      isActive: true,
    });

    setFormSuccess(true);
    refreshData();
    setTimeout(() => {
      setFormSuccess(false);
      setShowAddModal(false);
      setSchoolName('');
      setSchoolCode('');
      setSchoolAddress('');
      setSchoolPhone('');
      setPrincipalName('');
      setAdminName('');
      setAdminUsername('');
      setAdminEmail('');
      setAdminPassword('school123');
    }, 1200);
  };

  const handleToggleSchool = (schoolId: string) => {
    dbStore.toggleSchoolStatus(schoolId);
    const schoolAdmins = users.filter((u) => u.schoolId === schoolId);
    schoolAdmins.forEach((admin) => dbStore.toggleUserStatus(admin.id));
    refreshData();
  };

  const filteredSchools = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold mb-2">
            <span>👑 {language === 'en' ? 'Superadmin Control Panel' : 'सुपरएडमिन नियंत्रण कक्ष'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {language === 'en' ? 'Multi-School Governance' : 'मल्टी-स्कूल प्रबंधन व निगरानी'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            {language === 'en'
              ? 'Provision schools, configure principal accounts, manage database sync.'
              : 'नए स्कूल जोड़ें, प्रधानाचार्य खाते बनाएं और डेटाबेस सिंक प्रबंधित करें।'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition active:scale-95 touch-manipulation cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('add_school')}</span>
          </button>
          <button
            onClick={onOpenSupabase}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition active:scale-95 touch-manipulation cursor-pointer"
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span>{t('tab_database')}</span>
          </button>
        </div>
      </div>

      {/* Global Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>{language === 'en' ? 'Registered Schools' : 'कुल स्कूल'}</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-2">
            {schools.length}
          </span>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>{language === 'en' ? 'Enrolled Students' : 'कुल छात्र'}</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-2">
            {students.length}
          </span>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>{language === 'en' ? 'Total Users' : 'कुल उपयोगकर्ता'}</span>
            <UserPlus className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-2">
            {users.length}
          </span>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>{language === 'en' ? 'Active Status' : 'सक्रिय स्कूल'}</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-emerald-600 block mt-2">
            {schools.filter((s) => s.isActive).length} / {schools.length}
          </span>
        </div>
      </div>

      {/* Schools Directory Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-black text-lg text-slate-900">
          {language === 'en' ? 'Affiliated Schools Directory' : 'संबंधित स्कूलों की सूची'}
        </h3>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'en' ? 'Search school name or code...' : 'स्कूल नाम या कोड से खोजें...'}
            className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
          />
        </div>
      </div>

      {/* School Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSchools.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white border border-slate-200 rounded-3xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <SchoolIcon className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">
              {language === 'en' ? 'No Schools Registered Yet' : 'अभी तक कोई स्कूल पंजीकृत नहीं है'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {language === 'en'
                ? 'Click "+ Add School" button above to add your first school and create its administrator.'
                : 'ऊपर दिए गए "+ नया स्कूल जोड़ें" बटन पर क्लिक करके पहला स्कूल और उसका एडमिन बनाएं।'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm hover:bg-blue-700 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('add_school')}</span>
            </button>
          </div>
        ) : (
          filteredSchools.map((school) => {
            const schoolAdmins = users.filter((u) => u.schoolId === school.id && u.role === 'SCHOOL_ADMIN');
            const studentCount = students.filter((s) => s.schoolId === school.id).length;

            return (
              <div
                key={school.id}
                className={`bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 ${
                  school.isActive ? 'border-slate-200' : 'border-rose-300 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {school.code}
                      </span>
                      <h4 className="font-black text-base text-slate-900 mt-1">{school.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{school.address}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        school.isActive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {school.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                    </span>
                  </div>

                  <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{language === 'en' ? 'Principal:' : 'प्रधानाचार्य:'}</span>
                      <span className="font-bold text-slate-900">{school.principalName}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{language === 'en' ? 'Helpline:' : 'हेल्पलाइन:'}</span>
                      <span className="font-mono">{school.phone}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{language === 'en' ? 'Enrolled Students:' : 'पंजीकृत छात्र:'}</span>
                      <span className="font-bold text-blue-600">{studentCount} छात्र</span>
                    </div>
                  </div>

                  {schoolAdmins.length > 0 && (
                    <div className="mt-3 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs">
                      <span className="text-[10px] text-indigo-700 font-bold block uppercase">
                        प्रिंसिपल लॉगिन विवरण
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono text-slate-900 font-bold">@{schoolAdmins[0].username}</span>
                        <span className="font-mono text-slate-600">{schoolAdmins[0].password || '••••••'}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleSchool(school.id)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      school.isActive
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{school.isActive ? 'Deactivate' : 'Activate'}</span>
                  </button>
                  <button
                    onClick={() => handleOpenEditSchool(school)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs transition cursor-pointer"
                    title={t('edit')}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSchoolToDelete(school)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs transition cursor-pointer"
                    title={t('delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add School Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-lg">{t('add_school')}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formSuccess && (
              <div className="p-3 my-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center">
                नया स्कूल व एडमिन खाता सफलतापूर्वक बन गया!
              </div>
            )}

            <form onSubmit={handleCreateSchool} className="space-y-4 mt-4 text-xs">
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                  स्कूल विवरण (School Profile)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">स्कूल नाम *</label>
                    <input
                      type="text"
                      required
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="उदा. Delhi Public Model School"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">स्कूल कोड *</label>
                    <input
                      type="text"
                      required
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                      placeholder="DPS101"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">हेल्पलाइन फोन *</label>
                    <input
                      type="tel"
                      required
                      value={schoolPhone}
                      onChange={(e) => setSchoolPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">प्रधानाचार्य नाम *</label>
                    <input
                      type="text"
                      required
                      value={principalName}
                      onChange={(e) => setPrincipalName(e.target.value)}
                      placeholder="डॉ. रमेश शर्मा"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">स्कूल का पता</label>
                  <input
                    type="text"
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    placeholder="सेक्टर 14, रोहिणी, नई दिल्ली"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
                  प्रिंसिपल लॉगिन विवरण (Admin Credentials)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">यूजरनेम *</label>
                    <input
                      type="text"
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="dpsadmin"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">पासवर्ड *</label>
                    <input
                      type="text"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="school123"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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

      {/* Delete School Modal */}
      {schoolToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">स्कूल हटाएं?</h3>
                <p className="text-xs text-slate-500">{schoolToDelete.name} ({schoolToDelete.code})</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSchoolToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSchool}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit School Modal */}
      {editingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-lg">स्कूल विवरण संपादित करें</h3>
              <button onClick={() => setEditingSchool(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateSchool} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">स्कूल नाम</label>
                <input
                  type="text"
                  required
                  value={editSchoolName}
                  onChange={(e) => setEditSchoolName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">स्कूल कोड</label>
                <input
                  type="text"
                  required
                  value={editSchoolCode}
                  onChange={(e) => setEditSchoolCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">प्रधानाचार्य नाम</label>
                <input
                  type="text"
                  required
                  value={editPrincipalName}
                  onChange={(e) => setEditPrincipalName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">फोन नंबर</label>
                <input
                  type="tel"
                  required
                  value={editSchoolPhone}
                  onChange={(e) => setEditSchoolPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSchool(null)}
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
    </div>
  );
};
