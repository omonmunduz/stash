/**
 * IMAGE UPLOAD COMPONENT
 *
 * Reusable component for uploading images to Supabase Storage.
 * Shows a preview of the current image and allows selecting a new one.
 *
 * Design decisions:
 * - Accepts File objects directly, no automatic upload on selection
 * - Parent component controls when to upload via a server action
 * - Shows preview using object URLs for selected files
 * - Optional: can display existing image via signed URL
 * - Validates file type and size client-side before allowing selection
 */

'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import Image from 'next/image';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

interface ImageUploadProps {
  /** Field identifier for accessibility */
  id: string;
  /** Label text */
  label: string;
  /** Current image URL (signed URL from server) */
  currentImageUrl?: string | null;
  /** Callback when file is selected */
  onFileSelect: (file: File | null) => void;
  /** Whether the upload is disabled */
  disabled?: boolean;
  /** Helper text shown below the upload area */
  helperText?: string;
  /** Maximum file size in bytes (default: 5MB) */
  maxSizeBytes?: number;
  /** Accepted file types */
  accept?: string;
  /** CSS classes for the container */
  className?: string;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp';

export function ImageUpload({
  id,
  label,
  currentImageUrl,
  onFileSelect,
  disabled = false,
  helperText,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  accept = DEFAULT_ACCEPT,
  className,
}: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);

    if (!file) {
      setPreviewUrl(null);
      onFileSelect(null);
      return;
    }

    // Validate file size
    if (file.size > maxSizeBytes) {
      const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
      setError(`File must be smaller than ${maxMB}MB`);
      setPreviewUrl(null);
      onFileSelect(null);
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Validate file type
    const acceptedTypes = accept.split(',').map((t) => t.trim());
    if (!acceptedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP)');
      setPreviewUrl(null);
      onFileSelect(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Create preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    onFileSelect(file);
  };

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError(null);
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>

      <div className="space-y-3">
        {/* Preview area */}
        {displayUrl ? (
          <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border bg-muted">
            <Image
              src={displayUrl}
              alt="Preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 448px"
              unoptimized={!!previewUrl} // object URLs can't be optimized
            />
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 shadow-sm transition-colors hover:bg-background"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className={cn(
              'flex aspect-video w-full max-w-md flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors',
              disabled
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer hover:border-primary hover:bg-muted/50'
            )}
          >
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Click to select an image
            </span>
          </button>
        )}

        {/* Hidden file input */}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={disabled}
          className="sr-only"
          aria-describedby={helperText ? `${id}-description` : undefined}
        />

        {/* Upload button (when image is displayed) */}
        {displayUrl && !disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClick}
          >
            <Upload className="mr-2 h-4 w-4" />
            Change Image
          </Button>
        )}

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {/* Helper text */}
        {helperText && !error && (
          <p id={`${id}-description`} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    </div>
  );
}
