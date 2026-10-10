import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'hi' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  hi: {
    // App & Branding
    app_name: 'सुरक्षाट्रैक',
    app_subtitle: 'छात्र सुरक्षा QR ट्रैकिंग व रियल-टाइम वॉइस अलर्ट PWA',
    pwa_badge: 'PWA',
    online: 'ऑनलाइन',
    offline: 'ऑफ़लाइन (लोकल मोड)',
    lang_name: 'हिन्दी',
    switch_language: 'भाषा बदलें / Language',

    // Roles
    role_superadmin: 'सुपरएडमिन (मालिक)',
    role_school_admin: 'स्कूल एडमिन (प्रिंसिपल)',
    role_guard: 'सुरक्षा गार्ड (गेट)',
    role_teacher: 'कक्षा अध्यापक (टीचर)',
    role_parent: 'अभिभावक (माता-पिता)',

    // Navigation & Tabs
    tab_live_tracking: 'लाइव ट्रैकिंग',
    tab_students: 'छात्र सूची',
    tab_staff: 'स्टाफ प्रबंधन',
    tab_attendance: 'कक्षा हाजिरी',
    tab_scanner: 'QR स्कैनर',
    tab_alerts: 'अलर्ट्स',
    tab_timeline: 'यात्रा टाइमलाइन',
    tab_id_card: 'आईडी कार्ड',
    tab_emergency: 'आपातकालीन सहायता',
    tab_schools: 'स्कूल सूची',
    tab_add_school: 'नया स्कूल',
    tab_database: 'डेटाबेस',
    tab_profile: 'प्रोफाइल',

    // 5-Step Journey
    step_1_title: 'घर से निकला',
    step_1_desc: 'अभिभावक ने स्कैन किया - छात्र स्कूल के लिए निकला',
    step_2_title: 'स्कूल गेट प्रवेश',
    step_2_desc: 'सुरक्षा गार्ड द्वारा स्कूल मुख्य द्वार पर स्कैन',
    step_3_title: 'कक्षा हाजिरी',
    step_3_desc: 'कक्षा अध्यापक द्वारा कक्षा में उपस्थिति दर्ज की गई',
    step_4_title: 'स्कूल से प्रस्थान',
    step_4_desc: 'छुट्टी के समय मुख्य गेट पर सुरक्षा गार्ड द्वारा स्कैन',
    step_5_title: 'घर पहुँच गया',
    step_5_desc: 'अभिभावक द्वारा सुरक्षित घर पहुँचने की पुष्टि',

    // Common Actions
    add_student: '+ नया छात्र जोड़ें',
    add_staff: '+ नया स्टाफ जोड़ें',
    add_school: '+ नया स्कूल जोड़ें',
    edit: 'संपादित करें (Edit)',
    delete: 'हटाएं (Delete)',
    save: 'सुरक्षित करें (Save)',
    cancel: 'रद्द करें (Cancel)',
    close: 'बंद करें (Close)',
    cut_close: 'काटें / बंद करें',
    print: 'प्रिंट करें (Print)',
    print_id_card: 'आईडी कार्ड प्रिंट करें',
    download: 'डाउनलोड',
    download_image: 'डाउनलोड फोटो',
    search: 'खोजें...',
    search_placeholder: 'नाम, रोल नं, कक्षा या फोन नंबर से खोजें...',
    filter_class: 'कक्षा चुनें',
    all_classes: 'सभी कक्षाएं',
    all: 'सभी',
    present: 'उपस्थित (School In)',
    departed: 'प्रस्थान (Departed)',
    absent: 'अनुपस्थित (Absent)',
    simulate_scan: 'स्कैन परीक्षण (Simulate)',
    test_voice: 'आवाज टेस्ट करें',
    logout: 'लॉग आउट',
    change_password: 'पासवर्ड बदलें',
    quick_demo_login: 'क्विक टेस्ट लॉगिन',
    share_whatsapp: 'व्हाट्सएप पर भेजें',
    call: 'कॉल करें',
    copy: 'कॉपी करें',
    copied: 'कॉपी हो गया!',
    confirm_delete: 'हटाने की पुष्टि करें',
    delete_warning: 'क्या आप वाकई इसे हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।',

    // Student Fields
    student_name: 'छात्र का नाम',
    roll_no: 'रोल नंबर',
    class_name: 'कक्षा (Class)',
    blood_group: 'रक्त समूह',
    father_name: 'पिता / अभिभावक का नाम',
    mother_name: 'माता का नाम',
    parent_phone: 'अभिभावक का मोबाइल नंबर',
    emergency_phone: 'आपातकालीन फोन नंबर',
    address: 'पता',
    photo: 'छात्र की फोटो',
    upload_photo: 'फोटो अपलोड करें (कैमरा / गैलरी)',
    parent_credentials: 'अभिभावक लॉगिन विवरण',
    parent_username: 'अभिभावक यूजरनेम',
    parent_password: 'अभिभावक पासवर्ड',
    auto_linked_parent_notice: 'छात्र जोड़ते ही अभिभावक का ऑटो-लिंक्ड लॉगिन खाता अपने आप बन जाता है।',

    // Card & Status Details
    principal_signature: 'प्रिंसिपल हस्ताक्षर',
    emergency_helpline: 'आपातकालीन हेल्पलाइन',
    scan_qr_prompt: 'सुरक्षित यात्रा व वॉइस अलर्ट हेतु QR स्कैन करें',
    status_completed: 'यात्रा पूर्ण (Safely Completed)',
    status_in_progress: 'यात्रा जारी (In Progress)',
    status_delayed: 'अलर्ट: देरी या छूटा',
    today_journey: 'आज की 5-स्टेप यात्रा',
    past_history: 'पिछले दिनों का रिकॉर्ड',
    no_students_found: 'कोई छात्र नहीं मिला',
    no_records_found: 'कोई रिकॉर्ड उपलब्ध नहीं है',

    // Auth & Login
    login_title: 'लॉगिन करें',
    login_subtitle: 'अपने स्कूल या अभिभावक पोर्टल में प्रवेश करें',
    username_or_email: 'यूजरनेम, फोन या ईमेल',
    password: 'पासवर्ड',
    sign_in: 'साइन इन करें',
    demo_accounts: '1-क्लिक टेस्ट खाते',
    superadmin_only_schema: 'डेटाबेस सेटिंग्स व स्कीमा (सुपरएडमिन केवल)',
  },
  en: {
    // App & Branding
    app_name: 'SurakshaTrack',
    app_subtitle: 'Student Safety QR Tracking & Real-Time Voice Alert PWA',
    pwa_badge: 'PWA',
    online: 'Online',
    offline: 'Offline (Local Mode)',
    lang_name: 'English',
    switch_language: 'Change Language / भाषा बदलें',

    // Roles
    role_superadmin: 'Superadmin',
    role_school_admin: 'School Admin (Principal)',
    role_guard: 'Security Guard',
    role_teacher: 'Class Teacher',
    role_parent: 'Parent',

    // Navigation & Tabs
    tab_live_tracking: 'Live Tracking',
    tab_students: 'Students',
    tab_staff: 'Staff Management',
    tab_attendance: 'Attendance',
    tab_scanner: 'QR Scanner',
    tab_alerts: 'Alerts',
    tab_timeline: 'Journey Timeline',
    tab_id_card: 'ID Card',
    tab_emergency: 'Emergency Support',
    tab_schools: 'Schools List',
    tab_add_school: 'New School',
    tab_database: 'Database',
    tab_profile: 'Profile',

    // 5-Step Journey
    step_1_title: 'Left Home',
    step_1_desc: 'Parent scanned - Student left for school',
    step_2_title: 'School Gate In',
    step_2_desc: 'Security Guard scanned at the entrance gate',
    step_3_title: 'Classroom Attendance',
    step_3_desc: 'Teacher marked attendance in classroom',
    step_4_title: 'School Gate Out',
    step_4_desc: 'Guard scanned departure at school gate',
    step_5_title: 'Reached Home Safely',
    step_5_desc: 'Parent confirmed safe arrival at home',

    // Common Actions
    add_student: 'Add New Student',
    add_staff: 'Add Staff Member',
    add_school: 'Add New School',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    cut_close: 'Close / Cut',
    print: 'Print',
    print_id_card: 'Print ID Card',
    download: 'Download',
    download_image: 'Download Image',
    search: 'Search...',
    search_placeholder: 'Search by name, roll no, class or phone...',
    filter_class: 'Filter by Class',
    all_classes: 'All Classes',
    all: 'All',
    present: 'Present (In School)',
    departed: 'Departed',
    absent: 'Absent',
    simulate_scan: 'Simulate Scan',
    test_voice: 'Test Voice Alert',
    logout: 'Logout',
    change_password: 'Change Password',
    quick_demo_login: 'Quick Demo Login',
    share_whatsapp: 'Share on WhatsApp',
    call: 'Call',
    copy: 'Copy',
    copied: 'Copied!',
    confirm_delete: 'Confirm Deletion',
    delete_warning: 'Are you sure you want to delete this record? This action cannot be undone.',

    // Student Fields
    student_name: 'Student Name',
    roll_no: 'Roll Number',
    class_name: 'Class & Section',
    blood_group: 'Blood Group',
    father_name: "Father's / Guardian Name",
    mother_name: "Mother's Name",
    parent_phone: 'Parent Mobile Number',
    emergency_phone: 'Emergency Phone Number',
    address: 'Residential Address',
    photo: 'Student Photo',
    upload_photo: 'Upload Photo (Camera / Gallery)',
    parent_credentials: 'Parent Login Credentials',
    parent_username: 'Parent Username',
    parent_password: 'Parent Password',
    auto_linked_parent_notice: 'A linked parent account is automatically generated upon adding the student.',

    // Card & Status Details
    principal_signature: 'Principal Signature',
    emergency_helpline: 'Emergency Helpline',
    scan_qr_prompt: 'Scan QR for voice alert and safety tracking',
    status_completed: 'Journey Completed',
    status_in_progress: 'Journey In Progress',
    status_delayed: 'Alert: Delayed or Missed',
    today_journey: "Today's 5-Step Journey",
    past_history: 'Past Days History',
    no_students_found: 'No students found',
    no_records_found: 'No records available',

    // Auth & Login
    login_title: 'Sign In',
    login_subtitle: 'Sign in to access your school or parent portal',
    username_or_email: 'Username, Phone or Email',
    password: 'Password',
    sign_in: 'Sign In',
    demo_accounts: '1-Click Test Accounts',
    superadmin_only_schema: 'Database Schema & Settings (Superadmin)',
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'hi',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('suraksha_language');
      if (saved === 'en' || saved === 'hi') return saved;
    } catch {
      // ignore
    }
    return 'hi';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('suraksha_language', lang);
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'hi' ? 'en' : 'hi');
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // ignore
    }
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    const dict = translations[language];
    if (dict && dict[key]) {
      return dict[key];
    }
    const otherDict = language === 'hi' ? translations.en : translations.hi;
    if (otherDict && otherDict[key]) {
      return otherDict[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
