# Image Upload Implementation Summary

## Overview
Added optional image upload capability to:
1. **Product creation and editing** - Upload product photos
2. **Landing page editor** - Upload logo and hero banner images

## What Was Implemented

### 1. Core Components

#### ImageUpload Component (`src/components/shared/ImageUpload.tsx`)
- Reusable image upload component with preview
- Client-side validation (file type and size)
- Shows current image using signed URLs
- Allows changing/removing images
- Max file size: 5MB
- Supported formats: JPEG, PNG, WebP

#### Storage Helper Functions (`src/lib/supabase/storage.ts`)
- `uploadFile()` - Upload files to Supabase Storage
- `getSignedUrl()` - Generate signed URLs for private images (1 hour expiry)
- `deleteFile()` - Remove files from storage
- Path generation helpers for products and organizations

### 2. Database Changes

#### Migration: `20260915000001_organization_images_bucket.sql`
- Created new `organization-images` storage bucket
- Private bucket with RLS policies
- Path structure: `{organization_id}/{type}.{ext}` where type is 'logo' or 'hero'
- Owner-level permissions for uploads
- All org members can view (needed for logo display)

#### Existing Infrastructure
- `product-images` bucket already existed from migration `20260803000001`
- Products table already has `image_url` column

### 3. Product Image Upload

#### Updated Files:
- **ProductForm** (`src/features/products/components/ProductForm.tsx`)
  - Added optional image upload field
  - Shows current image when editing
  - File stored in state, sent via FormData on submit

- **Product Actions** (`src/app/actions/products.ts`)
  - `createProductAction` - Now accepts FormData, uploads image after creating product
  - `updateProductAction` - Now accepts FormData, uploads new image if provided
  - Non-blocking: product saves even if upload fails

- **Product Edit Page** (`src/app/(dashboard)/products/[id]/edit/page.tsx`)
  - Fetches signed URL for existing product image
  - Passes signed URL to form for preview

- **Product Types** (`src/features/products/types.ts`)
  - Added `image?: File | null` to `ProductFormValues`
  - Added `image_url?: string | null` to `UpdateProductInput`

### 4. Landing Page Image Upload

#### Updated Files:
- **LandingPageEditor** (`src/features/organizations/components/LandingPageEditor.tsx`)
  - Replaced URL text inputs with ImageUpload components
  - Separate uploads for logo and hero image
  - Shows current images when they exist
  - Sends files via FormData

- **Landing Page Actions** (`src/app/actions/landing-page.ts`)
  - `updateLandingPageAction` - Now accepts FormData, handles both logo and hero image uploads
  - Uploads to `organization-images` bucket
  - Updates database with storage paths

- **Landing Page Settings** (`src/app/(dashboard)/settings/landing-page/page.tsx`)
  - Fetches signed URLs for existing logo and hero images
  - Passes URLs to editor for preview

### 5. Configuration Changes

#### Next.js Config (`next.config.js`)
- Added Supabase domain to allowed image hosts for Next.js Image component
- Increased serverActions bodySizeLimit from 2mb to 10mb to support image uploads

## How It Works

### Upload Flow (Products)
1. User selects image file in ProductForm
2. File stored in component state (not uploaded yet)
3. On form submit, FormData created with all fields + image file
4. Server action creates/updates product first
5. If successful and image was selected, image uploads to storage
6. Product record updated with storage path
7. Path format: `{org_id}/{product_id}.{ext}`

### Upload Flow (Landing Page)
1. User selects logo or hero image in LandingPageEditor
2. Files stored in component state
3. On form submit, FormData created with all fields + image files
4. Server action uploads images to storage first
5. If successful, organization record updates with storage paths
6. Path format: `{org_id}/logo.{ext}` or `{org_id}/hero.{ext}`

### Display Flow
1. Database stores storage paths (not URLs)
2. Server-side pages fetch signed URLs (valid for 1 hour)
3. Signed URLs passed to client components
4. ImageUpload component displays using Next.js Image

### Technical Implementation Details

**FormData Usage:**
- Server Actions cannot directly receive File objects
- Forms now use FormData to serialize all fields including files
- Actions extract values and files from FormData on the server

**File Validation:**
- File size checked: `imageFile && imageFile.size > 0`
- Prevents submitting empty File objects
- Client-side validation in ImageUpload component
- Server-side validation via bucket configuration

## Security

### Storage Buckets
- **Private buckets** - not publicly accessible
- **Signed URLs** - temporary access (1 hour expiry)
- **Path-based tenancy** - first path segment must match user's org_id

### RLS Policies
- **product-images**: Manager+ can upload, all org members can view
- **organization-images**: Owner only can upload, all org members can view

### Validation
- Client-side: File type and size checked before allowing selection
- Server-side: Bucket configuration enforces 5MB limit and mime types
- RLS policies prevent cross-org access

## Future Enhancements

Potential improvements not included in this implementation:
- Image cropping/resizing before upload
- Multiple product images (gallery)
- Automatic thumbnail generation
- Image optimization/compression
- Drag-and-drop upload
- Bulk image uploads
- Delete old images when replacing (currently overwrites with upsert)
- Progress indicators for uploads

## Testing

To test:
1. **Product Images**: Go to Products → Add Product → upload an image
2. **Landing Page**: Go to Settings → Landing Page → upload logo and hero
3. Verify images display correctly when editing
4. Verify images are optional (can save without them)
5. Restart the dev server after config changes to pick up Next.js config changes
