export type UserRole = 'SUPERADMIN' | 'SCHOOL_ADMIN' | 'GUARD' | 'TEACHER' | 'PARENT';

export type StepType = 1 | 2 | 3 | 4 | 5;

export interface StepDefinition {
  step: StepType;
  titleHi: string;
  titleEn: string;
  descHi: string;
  role: 'PARENT' | 'GUARD' | 'TEACHER';
  icon: string;
  color: string;
  voiceTemplateHi: (studentName: string) => string;
}

export const JOURNEY_STEPS: Record<StepType, StepDefinition> = {
  1: {
    step: 1,
    titleHi: 'घर से निकला',
    titleEn: 'Left Home',
    descHi: 'अभिभावक ने स्कैन किया - छात्र स्कूल के लिए निकला',
    role: 'PARENT',
    icon: 'Home',
    color: 'from-amber-500 to-orange-600',
    voiceTemplateHi: (name) => `सूचना: छात्र ${name} घर से स्कूल के लिए निकल चुका है।`,
  },
  2: {
    step: 2,
    titleHi: 'स्कूल गेट प्रवेश',
    titleEn: 'School Gate In',
    descHi: 'सुरक्षा गार्ड द्वारा स्कूल मुख्य द्वार पर स्कैन किया गया',
    role: 'GUARD',
    icon: 'ShieldCheck',
    color: 'from-emerald-500 to-green-600',
    voiceTemplateHi: (name) => `सूचना: आपका बच्चा ${name} सुरक्षित स्कूल गेट के अंदर पहुँच चुका है।`,
  },
  3: {
    step: 3,
    titleHi: 'कक्षा हाजिरी',
    titleEn: 'Classroom In',
    descHi: 'कक्षा अध्यापक द्वारा कक्षा में उपस्थिति दर्ज की गई',
    role: 'TEACHER',
    icon: 'GraduationCap',
    color: 'from-blue-500 to-indigo-600',
    voiceTemplateHi: (name) => `सूचना: छात्र ${name} कक्षा में उपस्थित है और पढ़ाई शुरू हो चुकी है।`,
  },
  4: {
    step: 4,
    titleHi: 'स्कूल से प्रस्थान',
    titleEn: 'School Gate Out',
    descHi: 'छुट्टी के समय स्कूल मुख्य द्वार पर सुरक्षा गार्ड द्वारा स्कैन',
    role: 'GUARD',
    icon: 'DoorOpen',
    color: 'from-purple-500 to-indigo-700',
    voiceTemplateHi: (name) => `सूचना: छात्र ${name} स्कूल की छुट्टी के बाद गेट से बाहर निकल चुका है।`,
  },
  5: {
    step: 5,
    titleHi: 'घर पहुँच गया',
    titleEn: 'Reached Home',
    descHi: 'अभिभावक द्वारा सुरक्षित घर पहुँचने की पुष्टि',
    role: 'PARENT',
    icon: 'CheckCircle2',
    color: 'from-teal-500 to-emerald-600',
    voiceTemplateHi: (name) => `बधाई: आपका बच्चा ${name} सकुशल घर पहुँच चुका है। आज की सुरक्षित यात्रा पूर्ण हुई।`,
  },
};

export interface User {
  id: string;
  email: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  phone: string;
  schoolId?: string;
  schoolName?: string;
  assignedClass?: string; // e.g. "Class 5-A" for Teachers
  studentId?: string;     // For Parents (linked child)
  isActive: boolean;
  createdAt: string;
}

export interface School {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  principalName: string;
  isActive: boolean;
  createdAt: string;
  adminEmail?: string;
}

export interface Student {
  id: string;
  schoolId: string;
  schoolName?: string;
  name: string;
  rollNo: string;
  className: string;
  bloodGroup: string;
  fatherName: string;
  motherName?: string;
  parentPhone: string;
  emergencyPhone: string;
  address: string;
  photoKey: string;      // short storage key, e.g. "std_101.jpg" (<50KB in bucket)
  photoUrl?: string;     // public Supabase bucket URL (short, NOT base64!)
  photoDataUrl?: string; // local temporary preview only in browser
  qrToken: string;       // unique QR payload
  parentId?: string;
  parentUsername?: string;
  parentPassword?: string;
  isActive: boolean;
  createdAt: string;
}

export interface DailyScan {
  id: string;
  studentId: string;
  schoolId: string;
  scanDate: string;      // YYYY-MM-DD
  step: StepType;
  scannedAt: string;     // ISO timestamp
  scannedBy: string;     // User ID
  scannedByName: string;
  scannedByRole: UserRole;
  notes?: string;
}

export interface StudentDailyStatus {
  student: Student;
  date: string;
  steps: Partial<Record<StepType, DailyScan>>;
  currentStep: number;
  isComplete: boolean;
  hasMissedOrDelayed: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  bucketName: string;
  isConnected: boolean;
}
