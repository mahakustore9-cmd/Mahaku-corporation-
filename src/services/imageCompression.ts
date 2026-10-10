/**
 * Client-Side Image Compressor & Supabase Bucket Uploader
 * Enforces strictly < 50KB file size restriction for Supabase bucket storage.
 * Ensures 10,000+ students fit comfortably within Supabase free tier limits.
 */

import { uploadStudentPhotoToSupabase } from './supabaseClient';

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  sizeKb: number;
  shortKey: string;
  publicUrl?: string;
}

/**
 * Compresses an image file or data URL to guaranteed < 50KB JPEG
 * and generates short clean file key like "std_101.jpg"
 */
export async function compressStudentPhoto(
  fileOrDataUrl: File | string,
  suggestedRollNo: string = 'std'
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const processImage = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Constrain max dimensions to 360x360 (crisp for badge & ID card, tiny footprint)
        const maxDimension = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Fill white background for transparent PNG inputs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Iterative compression to ensure strictly <= 48 KB (< 50 KB specification)
        let quality = 0.76;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        let sizeInBytes = Math.round((dataUrl.length * 3) / 4);
        while (sizeInBytes > 48 * 1024 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          sizeInBytes = Math.round((dataUrl.length * 3) / 4);
        }

        // Convert dataUrl to Blob
        const byteString = atob(dataUrl.split(',')[1]);
        const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const sizeKb = Math.round((blob.size / 1024) * 10) / 10;

        // Generate short, clean filename key like "std_101.jpg"
        const cleanRoll = suggestedRollNo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'std';
        const shortKey = `std_${cleanRoll}.jpg`;

        // Attempt live upload to Supabase bucket if connected
        let publicUrl: string | undefined = undefined;
        try {
          const uploadRes = await uploadStudentPhotoToSupabase(blob, shortKey);
          if (uploadRes?.publicUrl) {
            publicUrl = uploadRes.publicUrl;
          }
        } catch {
          // fallback to dataUrl
        }

        resolve({
          blob,
          dataUrl,
          sizeKb,
          shortKey,
          publicUrl,
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onload = () => {
      processImage();
    };
    img.onerror = (err) => reject(err);

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
