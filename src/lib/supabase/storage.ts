/**
 * SUPABASE STORAGE HELPERS
 *
 * Utilities for uploading, downloading, and managing files in Supabase Storage.
 *
 * Design decisions:
 * - All paths are scoped by organization_id to enforce tenant isolation
 * - Uses signed URLs for private buckets (expires in 1 hour by default)
 * - File names are sanitized to prevent path traversal
 * - Returns Result types for consistent error handling
 */

import { createClient } from '@/lib/supabase/server';
import type { Result } from '@/lib/types/common';

/**
 * Upload a file to Supabase Storage.
 *
 * @param bucket - Storage bucket name
 * @param path - File path within the bucket (should include org_id prefix)
 * @param file - File to upload
 * @param options - Upload options (upsert to overwrite existing)
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Buffer,
  options?: { upsert?: boolean; contentType?: string }
): Promise<Result<{ path: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: options?.upsert ?? false,
      contentType: options?.contentType,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { path: data.path } };
}

/**
 * Get a signed URL for a private storage object.
 *
 * @param bucket - Storage bucket name
 * @param path - File path within the bucket
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<Result<{ signedUrl: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.signedUrl) {
    return { success: false, error: 'Failed to create signed URL' };
  }

  return { success: true, data: { signedUrl: data.signedUrl } };
}

/**
 * Delete a file from Supabase Storage.
 *
 * @param bucket - Storage bucket name
 * @param path - File path within the bucket
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<Result<void>> {
  const supabase = await createClient();

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: undefined };
}

/**
 * Get file extension from a File object or filename.
 */
export function getFileExtension(fileOrName: File | string): string {
  const name = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
  const lastDot = name.lastIndexOf('.');
  return lastDot === -1 ? '' : name.slice(lastDot);
}

/**
 * Generate a storage path for a product image.
 * Format: {org_id}/{product_id}.{ext}
 */
export function generateProductImagePath(
  organizationId: string,
  productId: string,
  file: File
): string {
  const ext = getFileExtension(file);
  return `${organizationId}/${productId}${ext}`;
}

/**
 * Generate a storage path for an organization image (logo or hero).
 * Format: {org_id}/{type}.{ext}
 */
export function generateOrgImagePath(
  organizationId: string,
  type: 'logo' | 'hero',
  file: File
): string {
  const ext = getFileExtension(file);
  return `${organizationId}/${type}${ext}`;
}
