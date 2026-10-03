# Service Image Implementation

## Overview
Added image upload capability to services, following the same pattern as products and organization images.

## What Was Implemented

### 1. Database Changes

#### Migration: `20261003000001_service_images.sql`
- Added `image_url` column to `services` table
- Created `service-images` storage bucket (private, 5MB limit)
- Added RLS policies for tenant-isolated access
- Path structure: `{organization_id}/{service_id}.{ext}`
- Manager+ can upload/update/delete
- All org members can view (needed for booking flow and landing page)

### 2. TypeScript Type Updates

#### Files Updated:
- **Service Types** (`src/features/services/types.ts`)
  - Added `image_url: string | null` to `Service` interface
  - Added `image_url?: string` to `CreateServiceInput`
  - Added `image_url?: string` to `UpdateServiceInput`

- **Service Repository** (`src/features/services/repository.ts`)
  - Updated `SERVICE_COLUMNS` to include `image_url`
  - Updated `create()` to handle `image_url` in insert
  - Updated `mapService()` to map `image_url` field

- **Database Types** (`src/lib/supabase/database.types.ts`)
  - Added `image_url: string | null` to services Row type
  - Added `image_url?: string | null` to services Insert type
  - Added `image_url?: string | null` to services Update type

### 3. Storage Helper Functions

#### Updated: `src/lib/supabase/storage.ts`
- Added `generateServiceImagePath()` function
- Format: `{org_id}/{service_id}.{ext}`
- Follows same pattern as `generateProductImagePath()`

### 4. Server Actions

#### Updated: `src/app/actions/services.ts`
- Changed `createServiceAction` to accept `FormData` instead of `ServiceFormValues`
- Changed `updateServiceAction` to accept `FormData` instead of `ServiceFormValues`
- Both actions now:
  1. Extract form fields from FormData
  2. Extract image file if provided
  3. Create/update service in database
  4. Upload image to storage if present
  5. Update service record with storage path

### 5. UI Components

#### Updated: `src/features/services/components/ServiceForm.tsx`
- Added `ImageUpload` component for image selection
- Added `currentImageUrl` prop to display existing images
- Changed form submission to use FormData
- Added image file state management
- Form now sends:
  - All form fields as FormData entries
  - Image file (if selected) as 'image' entry
  - Provider IDs as JSON string

#### Updated: `src/app/(dashboard)/services/[id]/edit/page.tsx`
- Fetches signed URL for existing service image
- Passes `currentImageUrl` to ServiceForm
- Uses 1-hour expiry for signed URLs

### 6. Translations

#### Updated Files:
- **English** (`messages/en/services.json`)
  - Added `form.image`: "Service image"
  - Added `form.imageHelp`: "Optional photo of the service. Max 5MB (JPEG, PNG, or WebP)"

- **Russian** (`messages/ru/services.json`)
  - Added `form.image`: "Изображение услуги"
  - Added `form.imageHelp`: "Необязательное фото услуги. Максимум 5 МБ (JPEG, PNG или WebP)"

## How It Works

### Upload Flow (Create)
1. User selects image file in ServiceForm
2. File stored in component state (not uploaded yet)
3. On form submit, FormData created with all fields + image file
4. Server action creates service first
5. If successful and image was selected, image uploads to storage
6. Service record updated with storage path
7. Path format: `{org_id}/{service_id}.{ext}`

### Upload Flow (Update)
1. User sees existing image (if present) via signed URL
2. User can change or remove image
3. On form submit, new image file sent via FormData
4. Server action uploads new image if provided
5. Service record updated with new storage path
6. Old image is overwritten (upsert mode)

### Display Flow
1. Database stores storage path (not URL)
2. Server-side edit page fetches signed URL (valid for 1 hour)
3. Signed URL passed to ServiceForm component
4. ImageUpload component displays using Next.js Image

## Security

### Storage Bucket
- **Private bucket** - not publicly accessible
- **Signed URLs** - temporary access (1 hour expiry)
- **Path-based tenancy** - first path segment must match user's org_id
- **File validation** - 5MB limit, JPEG/PNG/WebP only

### RLS Policies
- **SELECT**: All authenticated org members can view (for booking flow)
- **INSERT/UPDATE/DELETE**: Manager role or above only

### Validation
- Client-side: File type and size checked in ImageUpload component
- Server-side: Bucket configuration enforces 5MB limit and mime types
- RLS policies prevent cross-org access

## Technical Details

### FormData Usage
- Server Actions cannot directly receive File objects
- Form now uses FormData to serialize all fields including files
- Actions extract values and files from FormData on the server
- Provider IDs sent as JSON string, parsed server-side

### File Validation
- File size checked: `imageFile && imageFile.size > 0`
- Prevents submitting empty File objects
- Upload failures are non-blocking (service saved even if image fails)

### Non-blocking Uploads
- Service creation/update succeeds even if image upload fails
- Image upload happens after service is created
- Ensures data consistency - service always exists

## Where Images Are Used

Currently, service images are stored but not yet displayed in:
- **Landing page** - Service cards on public booking page
- **Booking flow** - Service selection UI
- **Service list** - Internal service management dashboard
- **Appointment booking** - Service preview when booking

## Future Enhancements

Potential improvements:
- Display service images on landing page service cards
- Show service images in booking flow
- Display thumbnails in service list
- Image cropping/resizing before upload
- Multiple service images (gallery)
- Automatic thumbnail generation
- Image optimization/compression
- Drag-and-drop upload
- Delete old images when replacing (currently overwrites)
- Progress indicators for uploads

## Testing

To test:
1. **Create Service**: Go to Services → Add Service → upload an image
2. **Edit Service**: Edit an existing service → upload or change image
3. **Verify**: Image displays correctly when editing
4. **Optional**: Verify service can be saved without an image
5. **Check Storage**: Verify image appears in Supabase Storage under `service-images` bucket

## Migration Application

To apply the database changes:
```bash
# If using local Supabase
npx supabase db reset

# Or push migration to remote
npx supabase db push

# Or apply manually in Supabase dashboard
# Copy contents of supabase/migrations/20261003000001_service_images.sql
# and run in SQL Editor
```
