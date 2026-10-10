import { DailyScan, School, StepType, Student, User, JOURNEY_STEPS } from '../types';
import { speakHindiText, broadcastScanNotification, showSystemNotification } from './soundService';
import {
  getStudentPhotoBucketUrl,
  getSupabase,
  isSupabaseConfigured,
  sanitizePhotoUrl,
} from './supabaseClient';

const KEY_SCHOOLS = 'suraksha_schools_v4';
const KEY_USERS = 'suraksha_users_v4';
const KEY_STUDENTS = 'suraksha_students_v4';
const KEY_SCANS = 'suraksha_scans_v4';
const KEY_CURRENT_USER = 'suraksha_current_user_v4';

// Format YYYY-MM-DD
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getOffsetDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Clean Initial State: NO DEMO DATA
// Only one Master Administrator account to allow setup
const INITIAL_SCHOOLS: School[] = [];

const INITIAL_USERS: User[] = [
  {
    id: 'user_superadmin_mukesh',
    email: 'mukeshchaudhary15796@gmail.com',
    username: 'mukeshchaudhary15796@gmail.com',
    password: 'Mukesh123',
    fullName: 'Mukesh Chaudhary (Superadmin)',
    role: 'SUPERADMIN',
    phone: '+91 99999 00000',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_master_admin',
    email: 'admin@suraksha.in',
    username: 'admin',
    password: 'admin',
    fullName: 'System Administrator',
    role: 'SUPERADMIN',
    phone: '+91 99999 00000',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_STUDENTS: Student[] = [];

export class DBStore {
  private static instance: DBStore;
  private isSyncingFromSupabase: boolean = false;
  private realtimeChannelSubscribed: boolean = false;

  private constructor() {
    this.init();
    this.purgeMonthlyScans();
    this.initSupabaseSync();
  }

  public static getInstance(): DBStore {
    if (!DBStore.instance) {
      DBStore.instance = new DBStore();
    }
    return DBStore.instance;
  }

  private init(): void {
    // Purge old versions / demo data completely
    localStorage.removeItem('suraksha_schools_v3');
    localStorage.removeItem('suraksha_users_v3');
    localStorage.removeItem('suraksha_students_v3');
    localStorage.removeItem('suraksha_scans_v3');

    if (!localStorage.getItem(KEY_SCHOOLS)) {
      localStorage.setItem(KEY_SCHOOLS, JSON.stringify(INITIAL_SCHOOLS));
    }
    if (!localStorage.getItem(KEY_USERS)) {
      localStorage.setItem(KEY_USERS, JSON.stringify(INITIAL_USERS));
    }
    if (!localStorage.getItem(KEY_STUDENTS)) {
      localStorage.setItem(KEY_STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    }
    if (!localStorage.getItem(KEY_SCANS)) {
      localStorage.setItem(KEY_SCANS, JSON.stringify([]));
    }

    // Sanitize any existing storage to ensure 0 demo accounts and valid Superadmin
    try {
      const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
      const sanitizedUsers = users.filter(
        (u) =>
          u.username !== 'dpsadmin' &&
          u.username !== 'guardramesh' &&
          u.username !== 'teacherpriya' &&
          u.username !== 'parent_r101' &&
          u.id !== 'user_school_admin' &&
          u.id !== 'user_guard_1' &&
          u.id !== 'user_teacher_1' &&
          u.id !== 'user_parent_1'
      );

      // Ensure mukeshchaudhary15796@gmail.com is present with Mukesh123 password
      const mukeshIdx = sanitizedUsers.findIndex(
        (u) =>
          u.email?.toLowerCase() === 'mukeshchaudhary15796@gmail.com' ||
          u.username?.toLowerCase() === 'mukeshchaudhary15796@gmail.com'
      );
      if (mukeshIdx >= 0) {
        sanitizedUsers[mukeshIdx].password = 'Mukesh123';
        sanitizedUsers[mukeshIdx].role = 'SUPERADMIN';
        sanitizedUsers[mukeshIdx].isActive = true;
      } else {
        sanitizedUsers.unshift(INITIAL_USERS[0]);
      }

      if (!sanitizedUsers.some((u) => u.username === 'admin')) {
        sanitizedUsers.push(INITIAL_USERS[1]);
      }
      localStorage.setItem(KEY_USERS, JSON.stringify(sanitizedUsers));

      const schools: School[] = JSON.parse(localStorage.getItem(KEY_SCHOOLS) || '[]');
      const sanitizedSchools = schools.filter((s) => s.id !== 'sch_dps' && s.code !== 'DPS101');
      localStorage.setItem(KEY_SCHOOLS, JSON.stringify(sanitizedSchools));

      const students: Student[] = JSON.parse(localStorage.getItem(KEY_STUDENTS) || '[]');
      const sanitizedStudents = students
        .filter((s) => s.id !== 'std_aarav' && s.rollNo !== 'R-101')
        .map((s) => {
          const cleanKey =
            s.photoKey || `std_${(s.rollNo || 'std').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.jpg`;
          const cleanUrl = sanitizePhotoUrl(s.photoUrl) || getStudentPhotoBucketUrl(cleanKey);
          return {
            ...s,
            photoKey: cleanKey,
            photoUrl: cleanUrl,
            photoDataUrl: undefined,
          };
        });
      localStorage.setItem(KEY_STUDENTS, JSON.stringify(sanitizedStudents));
    } catch {
      // ignore
    }
  }

  public async initSupabaseSync(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      await this.pullFromSupabase();
      this.subscribeToRealtimeScans();
    } catch (err) {
      console.warn('Initial Supabase sync skipped:', err);
    }
  }

  private subscribeToRealtimeScans(): void {
    const supabase = getSupabase();
    if (!supabase || this.realtimeChannelSubscribed) return;
    try {
      supabase
        .channel('suraksha_realtime_scans')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'daily_scans' },
          (payload) => {
            const row = payload.new as Record<string, any>;
            if (!row || !row.id) return;
            const existing = this.getScans();
            if (existing.some((s) => s.id === row.id)) return;
            const scan: DailyScan = {
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
            };
            existing.push(scan);
            localStorage.setItem(KEY_SCANS, JSON.stringify(existing));

            const student = this.getStudentById(scan.studentId);
            if (student) {
              const stepInfo = JOURNEY_STEPS[scan.step];
              const msg = stepInfo ? stepInfo.voiceTemplateHi(student.name) : 'स्कैन दर्ज हुआ';
              broadcastScanNotification({
                studentName: student.name,
                step: scan.step,
                messageHi: msg,
                studentId: student.id,
                time: new Date(scan.scannedAt).toLocaleTimeString('hi-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              });
            }
          }
        )
        .subscribe();
      this.realtimeChannelSubscribed = true;
    } catch (e) {
      console.warn('Supabase realtime subscription error:', e);
    }
  }

  public async pullFromSupabase(): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, message: 'Supabase URL/Key not configured' };
    }
    if (this.isSyncingFromSupabase) {
      return { success: true, message: 'Sync in progress' };
    }
    this.isSyncingFromSupabase = true;
    try {
      const { data: schoolsData, error: schoolsErr } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });
      if (!schoolsErr && Array.isArray(schoolsData)) {
        const schools: School[] = schoolsData.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          address: s.address || '',
          phone: s.phone,
          principalName: s.principal_name || '',
          isActive: s.is_active ?? true,
          createdAt: s.created_at || new Date().toISOString(),
          adminEmail: s.admin_email || '',
        }));
        localStorage.setItem(KEY_SCHOOLS, JSON.stringify(schools));
      }

      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (!profilesErr && Array.isArray(profilesData)) {
        const users: User[] = profilesData.map((u) => ({
          id: u.id,
          email: u.email || '',
          username: u.username,
          password: u.password,
          fullName: u.full_name,
          role: u.role,
          phone: u.phone,
          schoolId: u.school_id,
          schoolName: u.school_name,
          assignedClass: u.assigned_class,
          studentId: u.student_id,
          isActive: u.is_active ?? true,
          createdAt: u.created_at || new Date().toISOString(),
        }));
        if (!users.some((u) => u.username === 'admin')) {
          users.unshift(INITIAL_USERS[0]);
        }
        localStorage.setItem(KEY_USERS, JSON.stringify(users));
      }

      const { data: studentsData, error: studentsErr } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });
      if (!studentsErr && Array.isArray(studentsData)) {
        const students: Student[] = studentsData.map((std) => {
          const photoKey = std.photo_key || 'std_photo.jpg';
          const cleanPhotoUrl =
            sanitizePhotoUrl(std.photo_url) || getStudentPhotoBucketUrl(photoKey);
          return {
            id: std.id,
            schoolId: std.school_id,
            schoolName: std.school_name,
            name: std.name,
            rollNo: std.roll_no,
            className: std.class_name,
            bloodGroup: std.blood_group || 'B+',
            fatherName: std.father_name,
            motherName: std.mother_name || '',
            parentPhone: std.parent_phone,
            emergencyPhone: std.emergency_phone,
            address: std.address || '',
            photoKey,
            photoUrl: cleanPhotoUrl,
            photoDataUrl: undefined,
            qrToken: std.qr_token,
            parentId: std.parent_id,
            parentUsername: std.parent_username,
            parentPassword: std.parent_password,
            isActive: std.is_active ?? true,
            createdAt: std.created_at || new Date().toISOString(),
          };
        });
        localStorage.setItem(KEY_STUDENTS, JSON.stringify(students));
      }

      const cutoff = getOffsetDateString(30);
      const { data: scansData, error: scansErr } = await supabase
        .from('daily_scans')
        .select('*')
        .gte('scan_date', cutoff)
        .order('scanned_at', { ascending: true });
      if (!scansErr && Array.isArray(scansData)) {
        const scans: DailyScan[] = scansData.map((sc) => ({
          id: sc.id,
          studentId: sc.student_id,
          schoolId: sc.school_id,
          scanDate: sc.scan_date,
          step: sc.step,
          scannedAt: sc.scanned_at,
          scannedBy: sc.scanned_by || '',
          scannedByName: sc.scanned_by_name || '',
          scannedByRole: sc.scanned_by_role || 'GUARD',
          notes: sc.notes || '',
        }));
        localStorage.setItem(KEY_SCANS, JSON.stringify(scans));
      }

      return { success: true, message: 'Supabase लाइव डेटा सिंक पूर्ण!' };
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, message: `सिंक त्रुटि: ${error?.message || 'अज्ञात'}` };
    } finally {
      this.isSyncingFromSupabase = false;
    }
  }

  public async pushToSupabase(): Promise<{ success: boolean; message: string; count: number }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, message: 'Supabase URL/Key दर्ज नहीं है', count: 0 };
    }
    try {
      let count = 0;
      const schools = this.getSchools();
      for (const s of schools) {
        await supabase.from('schools').upsert({
          id: s.id,
          name: s.name,
          code: s.code,
          address: s.address,
          phone: s.phone,
          principal_name: s.principalName,
          is_active: s.isActive,
          admin_email: s.adminEmail,
          created_at: s.createdAt,
        });
        count++;
      }

      const users = this.getUsers();
      for (const u of users) {
        await supabase.from('profiles').upsert({
          id: u.id,
          email: u.email,
          username: u.username,
          password: u.password || 'admin',
          full_name: u.fullName,
          role: u.role,
          phone: u.phone,
          school_id: u.schoolId,
          school_name: u.schoolName,
          assigned_class: u.assignedClass,
          student_id: u.studentId,
          is_active: u.isActive,
          created_at: u.createdAt,
        });
        count++;
      }

      const students = this.getStudents();
      for (const std of students) {
        const photoKey = std.photoKey || 'std_photo.jpg';
        const cleanPhotoUrl =
          sanitizePhotoUrl(std.photoUrl) || getStudentPhotoBucketUrl(photoKey);
        await supabase.from('students').upsert({
          id: std.id,
          school_id: std.schoolId,
          school_name: std.schoolName,
          name: std.name,
          roll_no: std.rollNo,
          class_name: std.className,
          blood_group: std.bloodGroup,
          father_name: std.fatherName,
          mother_name: std.motherName,
          parent_phone: std.parentPhone,
          emergency_phone: std.emergencyPhone,
          address: std.address,
          photo_key: photoKey,
          photo_url: cleanPhotoUrl,
          qr_token: std.qrToken,
          parent_id: std.parentId,
          parent_username: std.parentUsername,
          parent_password: std.parentPassword,
          is_active: std.isActive,
          created_at: std.createdAt,
        });
        count++;
      }

      const scans = this.getScans();
      for (const sc of scans) {
        await supabase.from('daily_scans').upsert({
          id: sc.id,
          student_id: sc.studentId,
          school_id: sc.schoolId,
          scan_date: sc.scanDate,
          step: sc.step,
          scanned_at: sc.scannedAt,
          scanned_by: sc.scannedBy,
          scanned_by_name: sc.scannedByName,
          scanned_by_role: sc.scannedByRole,
          notes: sc.notes,
        });
        count++;
      }

      return {
        success: true,
        message: `सफलतापूर्वक ${count} रिकॉर्ड्स Supabase में अपलोड हुए!`,
        count,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, message: `सिंक विफल: ${error?.message || 'त्रुटि'}`, count: 0 };
    }
  }

  public purgeMonthlyScans(): number {
    try {
      const scans = this.getScans();
      const cutoffDate = getOffsetDateString(30);
      const filtered = scans.filter((s) => s.scanDate >= cutoffDate);
      const purgedCount = scans.length - filtered.length;
      if (purgedCount > 0) {
        localStorage.setItem(KEY_SCANS, JSON.stringify(filtered));
      }
      return purgedCount;
    } catch {
      return 0;
    }
  }

  public getCurrentUser(): User | null {
    try {
      const raw = localStorage.getItem(KEY_CURRENT_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(KEY_CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEY_CURRENT_USER);
    }
  }

  // SCHOOLS
  public getSchools(): School[] {
    try {
      const raw = localStorage.getItem(KEY_SCHOOLS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public addSchool(schoolData: Omit<School, 'id' | 'createdAt'>): School {
    const schools = this.getSchools();
    const newSchool: School = {
      ...schoolData,
      id: `sch_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    schools.unshift(newSchool);
    localStorage.setItem(KEY_SCHOOLS, JSON.stringify(schools));

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('schools')
        .insert({
          id: newSchool.id,
          name: newSchool.name,
          code: newSchool.code,
          address: newSchool.address,
          phone: newSchool.phone,
          principal_name: newSchool.principalName,
          is_active: newSchool.isActive,
          admin_email: newSchool.adminEmail,
          created_at: newSchool.createdAt,
        })
        .then(({ error }) => {
          if (error) console.warn('Supabase addSchool error:', error);
        });
    }
    return newSchool;
  }

  public updateSchool(schoolId: string, updatedData: Partial<School>): School | null {
    const schools = this.getSchools();
    const idx = schools.findIndex((s) => s.id === schoolId);
    if (idx === -1) return null;
    schools[idx] = { ...schools[idx], ...updatedData };
    localStorage.setItem(KEY_SCHOOLS, JSON.stringify(schools));

    const supabase = getSupabase();
    if (supabase) {
      const dbPayload: Record<string, any> = {};
      if (updatedData.name !== undefined) dbPayload.name = updatedData.name;
      if (updatedData.code !== undefined) dbPayload.code = updatedData.code;
      if (updatedData.address !== undefined) dbPayload.address = updatedData.address;
      if (updatedData.phone !== undefined) dbPayload.phone = updatedData.phone;
      if (updatedData.principalName !== undefined)
        dbPayload.principal_name = updatedData.principalName;
      if (updatedData.isActive !== undefined) dbPayload.is_active = updatedData.isActive;
      if (updatedData.adminEmail !== undefined) dbPayload.admin_email = updatedData.adminEmail;
      supabase
        .from('schools')
        .update(dbPayload)
        .eq('id', schoolId)
        .then(({ error }) => {
          if (error) console.warn('Supabase updateSchool error:', error);
        });
    }
    return schools[idx];
  }

  public deleteSchool(schoolId: string): boolean {
    let schools = this.getSchools();
    schools = schools.filter((s) => s.id !== schoolId);
    localStorage.setItem(KEY_SCHOOLS, JSON.stringify(schools));

    let students = this.getStudents();
    students = students.filter((s) => s.schoolId !== schoolId);
    localStorage.setItem(KEY_STUDENTS, JSON.stringify(students));

    let users = this.getUsers();
    users = users.filter((u) => u.schoolId !== schoolId);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('schools')
        .delete()
        .eq('id', schoolId)
        .then(({ error }) => {
          if (error) console.warn('Supabase deleteSchool error:', error);
        });
    }
    return true;
  }

  public toggleSchoolStatus(schoolId: string): void {
    const schools = this.getSchools().map((s) =>
      s.id === schoolId ? { ...s, isActive: !s.isActive } : s
    );
    localStorage.setItem(KEY_SCHOOLS, JSON.stringify(schools));
    const updated = schools.find((s) => s.id === schoolId);
    if (updated) {
      this.updateSchool(schoolId, { isActive: updated.isActive });
    }
  }

  // USERS
  public getUsers(): User[] {
    try {
      const raw = localStorage.getItem(KEY_USERS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public addUser(userData: Omit<User, 'id' | 'createdAt'>): User {
    const users = this.getUsers();
    const newUser: User = {
      ...userData,
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    users.unshift(newUser);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('profiles')
        .insert({
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          password: newUser.password || 'admin',
          full_name: newUser.fullName,
          role: newUser.role,
          phone: newUser.phone,
          school_id: newUser.schoolId,
          school_name: newUser.schoolName,
          assigned_class: newUser.assignedClass,
          student_id: newUser.studentId,
          is_active: newUser.isActive,
          created_at: newUser.createdAt,
        })
        .then(({ error }) => {
          if (error) console.warn('Supabase addUser error:', error);
        });
    }
    return newUser;
  }

  public updateUser(userId: string, updatedData: Partial<User>): User | null {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updatedData };
    localStorage.setItem(KEY_USERS, JSON.stringify(users));

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      this.setCurrentUser({ ...currentUser, ...updatedData });
    }

    const supabase = getSupabase();
    if (supabase) {
      const dbPayload: Record<string, any> = {};
      if (updatedData.email !== undefined) dbPayload.email = updatedData.email;
      if (updatedData.username !== undefined) dbPayload.username = updatedData.username;
      if (updatedData.password !== undefined) dbPayload.password = updatedData.password;
      if (updatedData.fullName !== undefined) dbPayload.full_name = updatedData.fullName;
      if (updatedData.phone !== undefined) dbPayload.phone = updatedData.phone;
      if (updatedData.assignedClass !== undefined)
        dbPayload.assigned_class = updatedData.assignedClass;
      if (updatedData.isActive !== undefined) dbPayload.is_active = updatedData.isActive;
      supabase
        .from('profiles')
        .update(dbPayload)
        .eq('id', userId)
        .then(({ error }) => {
          if (error) console.warn('Supabase updateUser error:', error);
        });
    }
    return users[idx];
  }

  public deleteUser(userId: string): boolean {
    let users = this.getUsers();
    users = users.filter((u) => u.id !== userId);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('profiles')
        .delete()
        .eq('id', userId)
        .then(({ error }) => {
          if (error) console.warn('Supabase deleteUser error:', error);
        });
    }
    return true;
  }

  public updateUserPassword(userId: string, newPassword: string): boolean {
    return Boolean(this.updateUser(userId, { password: newPassword }));
  }

  public toggleUserStatus(userId: string): void {
    const users = this.getUsers().map((u) =>
      u.id === userId ? { ...u, isActive: !u.isActive } : u
    );
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
    const target = users.find((u) => u.id === userId);
    if (target) {
      this.updateUser(userId, { isActive: target.isActive });
    }
  }

  // STUDENTS
  public getStudents(schoolId?: string): Student[] {
    try {
      const raw = localStorage.getItem(KEY_STUDENTS);
      const list: Student[] = raw ? JSON.parse(raw) : [];
      if (schoolId) {
        return list.filter((s) => s.schoolId === schoolId);
      }
      return list;
    } catch {
      return [];
    }
  }

  public getStudentById(id: string): Student | null {
    const students = this.getStudents();
    return students.find((s) => s.id === id) || null;
  }

  public getStudentByQR(token: string): Student | null {
    const students = this.getStudents();
    return students.find((s) => s.qrToken === token || s.id === token) || null;
  }

  public addStudent(studentData: Omit<Student, 'id' | 'createdAt'>): Student {
    const students = this.getStudents();
    const photoKey =
      studentData.photoKey ||
      `std_${(studentData.rollNo || 'std').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.jpg`;
    const cleanPhotoUrl =
      sanitizePhotoUrl(studentData.photoUrl) || getStudentPhotoBucketUrl(photoKey);

    const newStudent: Student = {
      ...studentData,
      id: `std_${Date.now()}`,
      photoKey,
      photoUrl: cleanPhotoUrl,
      photoDataUrl: undefined,
      createdAt: new Date().toISOString(),
    };
    students.unshift(newStudent);
    localStorage.setItem(KEY_STUDENTS, JSON.stringify(students));

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('students')
        .insert({
          id: newStudent.id,
          school_id: newStudent.schoolId,
          school_name: newStudent.schoolName,
          name: newStudent.name,
          roll_no: newStudent.rollNo,
          class_name: newStudent.className,
          blood_group: newStudent.bloodGroup,
          father_name: newStudent.fatherName,
          mother_name: newStudent.motherName,
          parent_phone: newStudent.parentPhone,
          emergency_phone: newStudent.emergencyPhone,
          address: newStudent.address,
          photo_key: photoKey,
          photo_url: cleanPhotoUrl,
          qr_token: newStudent.qrToken,
          parent_id: newStudent.parentId,
          parent_username: newStudent.parentUsername,
          parent_password: newStudent.parentPassword,
          is_active: newStudent.isActive,
          created_at: newStudent.createdAt,
        })
        .then(({ error }) => {
          if (error) console.warn('Supabase addStudent error:', error);
        });
    }
    return newStudent;
  }

  public updateStudent(studentId: string, updatedData: Partial<Student>): Student | null {
    const students = this.getStudents();
    const idx = students.findIndex((s) => s.id === studentId);
    if (idx === -1) return null;

    const cleanPhotoUrl = updatedData.photoUrl
      ? sanitizePhotoUrl(updatedData.photoUrl)
      : undefined;

    const sanitizedData = {
      ...updatedData,
      ...(cleanPhotoUrl !== undefined ? { photoUrl: cleanPhotoUrl } : {}),
      photoDataUrl: undefined,
    };

    students[idx] = { ...students[idx], ...sanitizedData };
    localStorage.setItem(KEY_STUDENTS, JSON.stringify(students));

    const supabase = getSupabase();
    if (supabase) {
      const dbPayload: Record<string, any> = {};
      if (updatedData.name !== undefined) dbPayload.name = updatedData.name;
      if (updatedData.rollNo !== undefined) dbPayload.roll_no = updatedData.rollNo;
      if (updatedData.className !== undefined) dbPayload.class_name = updatedData.className;
      if (updatedData.bloodGroup !== undefined) dbPayload.blood_group = updatedData.bloodGroup;
      if (updatedData.fatherName !== undefined) dbPayload.father_name = updatedData.fatherName;
      if (updatedData.motherName !== undefined) dbPayload.mother_name = updatedData.motherName;
      if (updatedData.parentPhone !== undefined) dbPayload.parent_phone = updatedData.parentPhone;
      if (updatedData.emergencyPhone !== undefined)
        dbPayload.emergency_phone = updatedData.emergencyPhone;
      if (updatedData.address !== undefined) dbPayload.address = updatedData.address;
      if (cleanPhotoUrl !== undefined) dbPayload.photo_url = cleanPhotoUrl;
      if (updatedData.photoKey !== undefined) dbPayload.photo_key = updatedData.photoKey;
      if (updatedData.isActive !== undefined) dbPayload.is_active = updatedData.isActive;
      if (updatedData.parentUsername !== undefined)
        dbPayload.parent_username = updatedData.parentUsername;
      if (updatedData.parentPassword !== undefined)
        dbPayload.parent_password = updatedData.parentPassword;
      supabase
        .from('students')
        .update(dbPayload)
        .eq('id', studentId)
        .then(({ error }) => {
          if (error) console.warn('Supabase updateStudent error:', error);
        });
    }
    return students[idx];
  }

  public deleteStudent(studentId: string): boolean {
    let students = this.getStudents();
    students = students.filter((s) => s.id !== studentId);
    localStorage.setItem(KEY_STUDENTS, JSON.stringify(students));

    let scans = this.getScans();
    scans = scans.filter((s) => s.studentId !== studentId);
    localStorage.setItem(KEY_SCANS, JSON.stringify(scans));

    let users = this.getUsers();
    users = users.filter((u) => u.studentId !== studentId);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('students')
        .delete()
        .eq('id', studentId)
        .then(({ error }) => {
          if (error) console.warn('Supabase deleteStudent error:', error);
        });
    }
    return true;
  }

  // SCANS
  public getScans(): DailyScan[] {
    try {
      const raw = localStorage.getItem(KEY_SCANS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public getScansForDate(date: string, schoolId?: string): DailyScan[] {
    const scans = this.getScans().filter((s) => s.scanDate === date);
    if (schoolId) {
      return scans.filter((s) => s.schoolId === schoolId);
    }
    return scans;
  }

  /**
   * Validates if a student can be scanned for a given step today.
   * Enforces:
   * 1. No double scan (a step can only be recorded once per day).
   * 2. Strict step-by-step sequence (step N requires step N-1 to be complete).
   */
  public validateStepForStudent(
    studentId: string,
    step: StepType,
    date: string = getTodayDateString()
  ): { valid: boolean; error?: string } {
    const student = this.getStudentById(studentId);
    if (!student) {
      return { valid: false, error: 'छात्र रिकॉर्ड नहीं मिला (Student record not found)।' };
    }

    const scans = this.getScans().filter(
      (s) => s.studentId === studentId && s.scanDate === date
    );

    // 1. Double scan check for the exact step
    const alreadyDone = scans.find((s) => s.step === step);
    if (alreadyDone) {
      const timeStr = new Date(alreadyDone.scannedAt).toLocaleTimeString('hi-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        valid: false,
        error: `चरण ${step} (${JOURNEY_STEPS[step].titleHi}) आज पहले ही ${timeStr} पर दर्ज हो चुका है! दोहराव (Double Scan) की अनुमति नहीं है।`,
      };
    }

    // 2. Strict sequence check: All steps prior to this step must already be done
    if (step > 1) {
      for (let prev = 1; prev < step; prev++) {
        const prevStep = prev as StepType;
        const prevDone = scans.some((s) => s.step === prevStep);
        if (!prevDone) {
          return {
            valid: false,
            error: `क्रमबद्ध नियम: चरण ${step} (${JOURNEY_STEPS[step].titleHi}) से पहले चरण ${prevStep} (${JOURNEY_STEPS[prevStep].titleHi}) का पूरा होना अनिवार्य है!`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Calculates the exact next pending step for a student today.
   */
  public getNextStepForStudent(
    studentId: string,
    date: string = getTodayDateString()
  ): {
    nextStep: StepType | null;
    completedSteps: StepType[];
    isComplete: boolean;
  } {
    const scans = this.getScans().filter(
      (s) => s.studentId === studentId && s.scanDate === date
    );
    const completedSteps: StepType[] = [];
    for (let s = 1; s <= 5; s++) {
      if (scans.some((scan) => scan.step === s)) {
        completedSteps.push(s as StepType);
      }
    }

    let nextStep: StepType | null = null;
    for (let s = 1; s <= 5; s++) {
      if (!completedSteps.includes(s as StepType)) {
        nextStep = s as StepType;
        break;
      }
    }

    return {
      nextStep,
      completedSteps,
      isComplete: completedSteps.length === 5,
    };
  }

  public async recordScan(
    studentId: string,
    step: StepType,
    scannedBy: User,
    notes?: string
  ): Promise<{ scan: DailyScan; student: Student; messageHi: string }> {
    const student = this.getStudentById(studentId);
    if (!student) {
      throw new Error('छात्र नहीं मिला (Student not found)');
    }

    const today = getTodayDateString();

    // Enforce strict double scan protection and sequential step-by-step order
    const validation = this.validateStepForStudent(studentId, step, today);
    if (!validation.valid) {
      throw new Error(validation.error || 'स्कैन सत्यापन विफल हुआ');
    }

    const existingScans = this.getScans();

    const newScan: DailyScan = {
      id: `scan_${Date.now()}`,
      studentId: student.id,
      schoolId: student.schoolId,
      scanDate: today,
      step,
      scannedAt: new Date().toISOString(),
      scannedBy: scannedBy.id,
      scannedByName: scannedBy.fullName,
      scannedByRole: scannedBy.role,
      notes: notes || JOURNEY_STEPS[step].titleHi,
    };

    existingScans.push(newScan);
    localStorage.setItem(KEY_SCANS, JSON.stringify(existingScans));

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('daily_scans')
        .upsert(
          {
            id: newScan.id,
            student_id: newScan.studentId,
            school_id: newScan.schoolId,
            scan_date: newScan.scanDate,
            step: newScan.step,
            scanned_at: newScan.scannedAt,
            scanned_by: newScan.scannedBy,
            scanned_by_name: newScan.scannedByName,
            scanned_by_role: newScan.scannedByRole,
            notes: newScan.notes,
          },
          { onConflict: 'student_id,scan_date,step' }
        )
        .then(({ error }) => {
          if (error) console.warn('Supabase recordScan error:', error);
        });
    }

    const voiceTemplate = JOURNEY_STEPS[step].voiceTemplateHi;
    const messageHi = voiceTemplate(student.name);

    await speakHindiText(messageHi);
    await showSystemNotification(`सुरक्षा अलर्ट - ${JOURNEY_STEPS[step].titleHi}`, messageHi);

    broadcastScanNotification({
      studentName: student.name,
      step,
      messageHi,
      studentId: student.id,
      time: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }),
    });

    return { scan: newScan, student, messageHi };
  }

  public getStudentDailyJourney(
    studentId: string,
    date: string
  ): {
    steps: Partial<Record<StepType, DailyScan>>;
    completedCount: number;
    isComplete: boolean;
    lastCompletedStep: number;
  } {
    const scans = this.getScans().filter(
      (s) => s.studentId === studentId && s.scanDate === date
    );
    const stepsMap: Partial<Record<StepType, DailyScan>> = {};
    let lastStep = 0;
    for (const scan of scans) {
      stepsMap[scan.step] = scan;
      if (scan.step > lastStep) {
        lastStep = scan.step;
      }
    }
    const completedCount = Object.keys(stepsMap).length;
    const isComplete = completedCount === 5;
    return {
      steps: stepsMap,
      completedCount,
      isComplete,
      lastCompletedStep: lastStep,
    };
  }

  public getStudentPast5Days(studentId: string): Array<{
    date: string;
    dayLabel: string;
    steps: Partial<Record<StepType, DailyScan>>;
    completedCount: number;
    isComplete: boolean;
  }> {
    const history = [];
    for (let i = 0; i < 5; i++) {
      const dateStr = getOffsetDateString(i);
      let dayLabel = `${dateStr}`;
      if (i === 0) dayLabel = 'आज (Today)';
      else if (i === 1) dayLabel = 'कल (Yesterday)';
      else dayLabel = `${i} दिन पहले (${dateStr})`;

      const journey = this.getStudentDailyJourney(studentId, dateStr);
      history.push({
        date: dateStr,
        dayLabel,
        steps: journey.steps,
        completedCount: journey.completedCount,
        isComplete: journey.isComplete,
      });
    }
    return history;
  }

  public clearAllData(): void {
    localStorage.removeItem(KEY_SCHOOLS);
    localStorage.removeItem(KEY_USERS);
    localStorage.removeItem(KEY_STUDENTS);
    localStorage.removeItem(KEY_SCANS);
    localStorage.removeItem(KEY_CURRENT_USER);
    this.init();
  }
}

export const dbStore = DBStore.getInstance();
