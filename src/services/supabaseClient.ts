import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig, User } from '../types';

const STORAGE_KEY_CONFIG = 'suraksha_supabase_config';
export const STUDENT_PHOTOS_BUCKET = 'student-photos';

export const PERMANENT_SUPABASE_URL = 'https://kzbnwvztiojwnfhnposz.supabase.co';
export const PERMANENT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6Ym53dnp0aW9qd25maG5wb3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1OTYzMjgsImV4cCI6MjEwNzE3MjMyOH0.0GpI-6yApf5Fzlt0ElT7yTZAPufElJr0ObSp8q1j2d8';

/**
 * Normalizes and sanitizes Supabase URL to prevent "Invalid path specified in request URL"
 * Converts dashboard URLs (https://supabase.com/dashboard/project/xxxx) to API URLs (https://xxxx.supabase.co)
 * Strips trailing slashes, /rest/v1, /auth/v1, etc.
 */
export function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // If user pasted dashboard URL: https://supabase.com/dashboard/project/xxxx
  const dashMatch = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashMatch && dashMatch[1]) {
    return `https://${dashMatch[1]}.supabase.co`;
  }

  // Remove trailing subpaths like /rest/v1, /auth/v1, /storage/v1
  url = url.replace(/\/(rest|auth|storage)\/v1\/?.*$/i, '');

  // Strip trailing slashes
  url = url.replace(/\/+$/, '');

  // Ensure https:// protocol if user only pasted "xxxx.supabase.co"
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  return url;
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.url || parsed.anonKey)) {
        const cleanUrl = normalizeSupabaseUrl(parsed.url || PERMANENT_SUPABASE_URL);
        const cleanKey = (parsed.anonKey || PERMANENT_SUPABASE_ANON_KEY).trim();
        return {
          ...parsed,
          url: cleanUrl,
          anonKey: cleanKey,
          bucketName: STUDENT_PHOTOS_BUCKET,
          isConnected: Boolean(cleanUrl && cleanKey),
        };
      }
    }
  } catch {
    // fallback
  }

  const envUrl = normalizeSupabaseUrl(
    (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL ||
      PERMANENT_SUPABASE_URL
  );
  const envKey = (
    (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY ||
      PERMANENT_SUPABASE_ANON_KEY
  ).trim();

  return {
    url: envUrl,
    anonKey: envKey,
    bucketName: STUDENT_PHOTOS_BUCKET,
    isConnected: Boolean(envUrl && envKey),
  };
}

export function saveStoredSupabaseConfig(config: SupabaseConfig): void {
  const cleanUrl = normalizeSupabaseUrl(config.url);
  const cleanKey = (config.anonKey || '').trim();

  localStorage.setItem(
    STORAGE_KEY_CONFIG,
    JSON.stringify({
      ...config,
      url: cleanUrl,
      anonKey: cleanKey,
      bucketName: STUDENT_PHOTOS_BUCKET,
      isConnected: Boolean(cleanUrl && cleanKey),
    })
  );
}

let supabaseInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const config = getStoredSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

export function getSupabase(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return supabaseInstance;
}

export function resetSupabaseClient(config: SupabaseConfig): SupabaseClient | null {
  if (config.url && config.anonKey) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return supabaseInstance;
    } catch (e) {
      console.warn('Failed to reset Supabase client:', e);
      supabaseInstance = null;
      return null;
    }
  }
  supabaseInstance = null;
  return null;
}

export function getStudentPhotoBucketUrl(photoKey: string): string {
  if (!photoKey) return '';
  if (photoKey.startsWith('http://') || photoKey.startsWith('https://')) {
    return photoKey;
  }
  const config = getStoredSupabaseConfig();
  const baseUrl = config.url || PERMANENT_SUPABASE_URL;
  return `${baseUrl}/storage/v1/object/public/${STUDENT_PHOTOS_BUCKET}/${photoKey}`;
}

/**
 * Ensures photo URL is strictly a clean HTTP/HTTPS URL.
 * Strictly strips any base64 data URLs to prevent table bloat.
 */
export function sanitizePhotoUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) {
    return '';
  }
  return url.trim();
}

/**
 * Resolves the display image source for a student:
 * Prefers Supabase storage public URL or short bucket key.
 * Never displays broken data URLs.
 */
export function getStudentPhotoSrc(student?: {
  photoUrl?: string;
  photoDataUrl?: string;
  photoKey?: string;
} | null): string {
  if (!student) return '';
  if (student.photoUrl && !student.photoUrl.startsWith('data:')) {
    return student.photoUrl;
  }
  if (student.photoKey && !student.photoKey.startsWith('data:')) {
    return getStudentPhotoBucketUrl(student.photoKey);
  }
  if (student.photoDataUrl && !student.photoDataUrl.startsWith('data:')) {
    return student.photoDataUrl;
  }
  return '';
}

/**
 * Uploads student photo (<50KB) directly to Supabase storage bucket
 * Returns public URL for minimal database footprint (<300 bytes per student)
 */
export async function uploadStudentPhotoToSupabase(
  photoBlob: Blob,
  fileName: string
): Promise<{ publicUrl: string; key: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const cleanKey = fileName.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

    // Upload with overwrite enabled
    const { error: uploadErr } = await supabase.storage
      .from(STUDENT_PHOTOS_BUCKET)
      .upload(cleanKey, photoBlob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (uploadErr) {
      console.warn('Supabase storage upload error:', uploadErr);
      try {
        await supabase.storage.createBucket(STUDENT_PHOTOS_BUCKET, { public: true });
        await supabase.storage.from(STUDENT_PHOTOS_BUCKET).upload(cleanKey, photoBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
        });
      } catch {
        // ignore
      }
    }

    const { data: urlData } = supabase.storage
      .from(STUDENT_PHOTOS_BUCKET)
      .getPublicUrl(cleanKey);

    const publicUrl = urlData?.publicUrl || getStudentPhotoBucketUrl(cleanKey);

    return {
      publicUrl,
      key: cleanKey,
    };
  } catch (err) {
    console.warn('Photo upload exception:', err);
    return null;
  }
}

/**
 * Deletes student photo from Supabase storage bucket
 */
export async function deleteStudentPhotoFromSupabase(fileName: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const cleanKey = fileName.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const { error } = await supabase.storage
      .from(STUDENT_PHOTOS_BUCKET)
      .remove([cleanKey]);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Superadmin Supabase Auth: Sign in with Supabase Authentication
 */
export async function signInSuperadminWithSupabase(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase URL और Anon Key अभी दर्ज नहीं हैं। कृपया पहले Supabase कनेक्ट करें।',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error || !data.user) {
      return {
        success: false,
        error: error?.message || 'अमान्य Supabase Auth ईमेल या पासवर्ड।',
      };
    }

    const authUser = data.user;

    let profileUser: User = {
      id: authUser.id,
      email: authUser.email || email,
      username: (authUser.email?.split('@')[0] || 'superadmin').toLowerCase(),
      fullName: (authUser.user_metadata?.full_name as string) || 'Super Administrator',
      role: 'SUPERADMIN',
      phone: authUser.phone || '+91 99999 00000',
      isActive: true,
      createdAt: authUser.created_at || new Date().toISOString(),
    };

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (existingProfile) {
        profileUser = {
          id: existingProfile.id,
          email: existingProfile.email || authUser.email || email,
          username: existingProfile.username,
          fullName: existingProfile.full_name,
          role: 'SUPERADMIN',
          phone: existingProfile.phone || '+91 99999 00000',
          isActive: existingProfile.is_active ?? true,
          createdAt: existingProfile.created_at || new Date().toISOString(),
        };
      } else {
        await supabase.from('profiles').upsert({
          id: profileUser.id,
          email: profileUser.email,
          username: profileUser.username,
          password: 'supabase_auth_managed',
          full_name: profileUser.fullName,
          role: 'SUPERADMIN',
          phone: profileUser.phone,
          is_active: true,
          created_at: profileUser.createdAt,
        });
      }
    } catch {
      // ignore
    }

    return { success: true, user: profileUser };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error?.message || 'लॉगिन के दौरान त्रुटि हुई।' };
  }
}

/**
 * Superadmin Supabase Auth: Sign up new Superadmin in Supabase Authentication
 */
export async function signUpSuperadminWithSupabase(
  email: string,
  password: string,
  fullName: string = 'Super Administrator'
): Promise<{ success: boolean; user?: User; error?: string; requiresEmailConfirm?: boolean }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase URL और Anon Key अभी दर्ज नहीं हैं। कृपया पहले Supabase कनेक्ट करें।',
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          full_name: fullName,
          role: 'SUPERADMIN',
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'यूजर खाता नहीं बन सका।' };
    }

    const authUser = data.user;
    const profileUser: User = {
      id: authUser.id,
      email: authUser.email || email,
      username: (authUser.email?.split('@')[0] || 'superadmin').toLowerCase(),
      fullName,
      role: 'SUPERADMIN',
      phone: '+91 99999 00000',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      await supabase.from('profiles').upsert({
        id: profileUser.id,
        email: profileUser.email,
        username: profileUser.username,
        password: 'supabase_auth_managed',
        full_name: profileUser.fullName,
        role: 'SUPERADMIN',
        phone: profileUser.phone,
        is_active: true,
        created_at: profileUser.createdAt,
      });
    } catch {
      // ignore
    }

    if (data.session) {
      return { success: true, user: profileUser };
    } else {
      return {
        success: true,
        user: profileUser,
        requiresEmailConfirm: true,
      };
    }
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error?.message || 'अकाउंट बनाने में त्रुटि हुई।' };
  }
}

/**
 * Superadmin Sign Out from Supabase Auth
 */
export async function signOutSupabase(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
}

/**
 * Tests live connection to Supabase database and storage bucket
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  hasTables: boolean;
  hasBucket: boolean;
}> {
  const client = getSupabase();
  if (!client) {
    return {
      success: false,
      message: 'Supabase URL और Anon Key दर्ज नहीं है।',
      hasTables: false,
      hasBucket: false,
    };
  }
  try {
    // 1. Test database table
    let hasTables = false;
    const { error: tableError } = await client.from('schools').select('id').limit(1);
    if (!tableError) {
      hasTables = true;
    } else if (tableError.code === '42P01') {
      return {
        success: true,
        message: 'Supabase प्रोजेक्ट कनेक्ट हुआ! अब Tab 2 का SQL स्क्रिप्ट चलाकर टेबल्स बनाएं।',
        hasTables: false,
        hasBucket: false,
      };
    } else {
      return {
        success: false,
        message: `डेटाबेस एरर (${tableError.code || 'API'}): ${tableError.message}`,
        hasTables: false,
        hasBucket: false,
      };
    }

    // 2. Test storage bucket
    let hasBucket = false;
    try {
      const { data: buckets } = await client.storage.listBuckets();
      if (Array.isArray(buckets) && buckets.some((b) => b.id === STUDENT_PHOTOS_BUCKET || b.name === STUDENT_PHOTOS_BUCKET)) {
        hasBucket = true;
      }
    } catch {
      // ignore
    }

    return {
      success: true,
      message: hasBucket
        ? 'लाइव Supabase डेटाबेस और Storage Bucket दोनों सक्रिय हैं!'
        : 'डेटाबेस टेबल्स तैयार हैं! Storage Bucket बनाने के लिए SQL स्क्रिप्ट चलाएं।',
      hasTables,
      hasBucket,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      message: `कनेक्शन विफलता: ${error?.message || 'अज्ञात त्रुटि'}`,
      hasTables: false,
      hasBucket: false,
    };
  }
}

/**
 * Clean & Production-Ready PostgreSQL / Supabase Schema
 * Includes tables, indexes, RLS policies, and Storage Bucket for photos (<50KB)
 */
export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- SURAKSHATRACK: PRODUCTION SUPABASE LIVE SCHEMA
-- 100% Compatible with Free Tier (10,000+ Students)
-- Paste into: Supabase Dashboard -> SQL Editor -> Run
-- ========================================================

-- 1. SCHOOLS TABLE
CREATE TABLE IF NOT EXISTS public.schools (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20) NOT NULL,
    principal_name VARCHAR(80),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    admin_email VARCHAR(120)
);

-- 2. USERS / PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(120),
    username VARCHAR(60) UNIQUE NOT NULL,
    password VARCHAR(120) NOT NULL,
    full_name VARCHAR(80) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('SUPERADMIN', 'SCHOOL_ADMIN', 'GUARD', 'TEACHER', 'PARENT')),
    phone VARCHAR(20) NOT NULL,
    school_id VARCHAR(64) REFERENCES public.schools(id) ON DELETE SET NULL,
    school_name VARCHAR(120),
    assigned_class VARCHAR(30),
    student_id VARCHAR(64),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDENTS TABLE (Stores short photo key & URL)
CREATE TABLE IF NOT EXISTS public.students (
    id VARCHAR(64) PRIMARY KEY,
    school_id VARCHAR(64) NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    school_name VARCHAR(120),
    name VARCHAR(80) NOT NULL,
    roll_no VARCHAR(30) NOT NULL,
    class_name VARCHAR(30) NOT NULL,
    blood_group VARCHAR(10) DEFAULT 'B+',
    father_name VARCHAR(80) NOT NULL,
    mother_name VARCHAR(80),
    parent_phone VARCHAR(20) NOT NULL,
    emergency_phone VARCHAR(20) NOT NULL,
    address VARCHAR(200),
    photo_key VARCHAR(80) DEFAULT 'std_photo.jpg',
    photo_url VARCHAR(255),
    qr_token VARCHAR(80) UNIQUE NOT NULL,
    parent_id VARCHAR(64),
    parent_username VARCHAR(60),
    parent_password VARCHAR(60),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for photo_url (removes heavy photo_data_url from table)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255);
ALTER TABLE public.students DROP COLUMN IF EXISTS photo_data_url;

-- High speed indexes
CREATE INDEX IF NOT EXISTS idx_students_qr ON public.students(qr_token);
CREATE INDEX IF NOT EXISTS idx_students_school ON public.students(school_id);

-- 4. DAILY SCANS TABLE (5-Step Daily Student Journey)
CREATE TABLE IF NOT EXISTS public.daily_scans (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    school_id VARCHAR(64) NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    step SMALLINT NOT NULL CHECK (step BETWEEN 1 AND 5),
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scanned_by VARCHAR(64),
    scanned_by_name VARCHAR(80),
    scanned_by_role VARCHAR(20),
    notes VARCHAR(150)
);

CREATE INDEX IF NOT EXISTS idx_scans_date_student ON public.daily_scans(scan_date, student_id);
CREATE INDEX IF NOT EXISTS idx_scans_school ON public.daily_scans(school_id);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_scans ENABLE ROW LEVEL SECURITY;

-- Production Policies for Client Key Access
CREATE POLICY "Allow public read schools" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Allow public write schools" ON public.schools FOR ALL USING (true);
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public write profiles" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Allow public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public write students" ON public.students FOR ALL USING (true);
CREATE POLICY "Allow public read scans" ON public.daily_scans FOR SELECT USING (true);
CREATE POLICY "Allow public write scans" ON public.daily_scans FOR ALL USING (true);

-- 6. STORAGE BUCKET FOR STUDENT PHOTOS (<50KB JPEG)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-photos', 'student-photos', true, 524288, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public read student-photos" ON storage.objects
FOR SELECT USING (bucket_id = 'student-photos');

CREATE POLICY "Allow public upload student-photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'student-photos');

CREATE POLICY "Allow public update student-photos" ON storage.objects
FOR UPDATE USING (bucket_id = 'student-photos');

CREATE POLICY "Allow public delete student-photos" ON storage.objects
FOR DELETE USING (bucket_id = 'student-photos');

-- 7. REALTIME REPLICATION (Instant live scans across all devices)
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_scans;
`;
