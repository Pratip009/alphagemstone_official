import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { toPublicUser } from '@/services/auth.service';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { uploadBuffer, destroyImage } from '@/lib/cloudinary';
import { assertValidImageBuffer } from '@/lib/file-signature';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/;

type AddressKey = 'line1' | 'line2' | 'city' | 'state' | 'postalCode' | 'country';
const ADDRESS_KEYS: AddressKey[] = ['line1', 'line2', 'city', 'state', 'postalCode', 'country'];
const REQUIRED_ADDRESS_KEYS: AddressKey[] = ['line1', 'city', 'state', 'postalCode', 'country'];

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

export const PATCH = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await connectDB();

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return errorResponse('Invalid form submission', 400);
    }

    const name = str(formData.get('name'));
    const phone = str(formData.get('phone'));
    const removeAvatar = str(formData.get('removeAvatar')) === 'true';
    const avatarEntry = formData.get('avatar');
    const avatarFile = avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;

    const address: Record<AddressKey, string> = ADDRESS_KEYS.reduce((acc, key) => {
      acc[key] = str(formData.get(`address[${key}]`));
      return acc;
    }, {} as Record<AddressKey, string>);

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, unknown> = {};

    if (!name) {
      errors.name = 'Full name is required.';
    } else if (name.length > 100) {
      errors.name = 'Name cannot exceed 100 characters.';
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      errors.phone = 'Enter a valid phone number.';
    }

    // Address is optional as a whole, but once any field is filled in, the
    // fields marked required on the form become required server-side too —
    // this mirrors the client validation and stops a half-saved address.
    const addressTouched = ADDRESS_KEYS.some((key) => address[key].length > 0);
    if (addressTouched) {
      const addressErrors: Partial<Record<AddressKey, string>> = {};
      for (const key of REQUIRED_ADDRESS_KEYS) {
        if (!address[key]) {
          addressErrors[key] = 'This field is required.';
        }
      }
      if (address.postalCode && !/^[a-zA-Z0-9\s-]{3,12}$/.test(address.postalCode)) {
        addressErrors.postalCode = 'Enter a valid postal code.';
      }
      if (Object.keys(addressErrors).length > 0) {
        errors.address = addressErrors;
      }
    }

    let avatarBuffer: Buffer | null = null;
    if (avatarFile) {
      if (avatarFile.size > MAX_AVATAR_BYTES) {
        errors.avatar = 'Image must be smaller than 5MB.';
      } else {
        avatarBuffer = Buffer.from(await avatarFile.arrayBuffer());
        try {
          // Trust only the actual file bytes, never the client-supplied
          // file.type / extension.
          assertValidImageBuffer(avatarBuffer, ['jpeg', 'png', 'webp']);
        } catch {
          errors.avatar = 'Please upload a JPG, PNG, or WebP image.';
          avatarBuffer = null;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return errorResponse('Please fix the highlighted fields.', 422, errors);
    }

    // ── Load user (need current avatarPublicId to clean up old asset) ───────
    const user = await User.findById(req.user.userId).select('+avatarPublicId');
    if (!user) return errorResponse('User not found', 404);

    const previousPublicId = user.avatarPublicId;

    user.name = name;
    user.phone = phone;
    user.address = addressTouched
      ? {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        }
      : user.address;

    if (avatarBuffer) {
      const { secure_url, public_id } = await uploadBuffer(avatarBuffer, avatarFile!.name, 'avatars');
      user.avatarUrl = secure_url;
      user.avatarPublicId = public_id;
    } else if (removeAvatar) {
      user.avatarUrl = '';
      user.avatarPublicId = '';
    }

    await user.save();

    // Clean up the old Cloudinary asset only after the new one is safely
    // saved, and only if it actually changed — never blocks the response.
    if (previousPublicId && (avatarBuffer || removeAvatar) && previousPublicId !== user.avatarPublicId) {
      void destroyImage(previousPublicId);
    }

    return successResponse(toPublicUser(user));
  } catch (err) {
    console.error('[PATCH /api/account]', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Failed to update profile',
      500
    );
  }
});