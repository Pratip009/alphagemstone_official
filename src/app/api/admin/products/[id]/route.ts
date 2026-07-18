import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { updateProduct, deleteProduct } from '@/services/product.service';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { MEMO_MAX_DAYS_CEILING } from '@/models/Product';

export const PUT = withAdmin(async (req, { params }) => {
  try {
    await connectDB();
    const body = await req.json();

    // ── Memo field validation ────────────────────────────────────────────
    // The PUT route otherwise passes the body straight through to Mongoose,
    // so this is the only gate stopping an admin (or a bad request) from
    // saving a nonsensical or unsafe memo window on an existing product.
    if (Object.prototype.hasOwnProperty.call(body, 'memoEligible') && typeof body.memoEligible !== 'boolean') {
      return errorResponse('Validation failed', 400, { memoEligible: ['memoEligible must be true or false'] });
    }
    if (body.memoEligible) {
      const minDays = body.memoMinDays != null ? Number(body.memoMinDays) : 3;
      const maxDays = body.memoMaxDays != null ? Number(body.memoMaxDays) : MEMO_MAX_DAYS_CEILING;
      const memoErrors: Record<string, string[]> = {};
      if (!Number.isFinite(minDays) || minDays < 1) {
        memoErrors.memoMinDays = ['memoMinDays must be at least 1'];
      }
      if (!Number.isFinite(maxDays) || maxDays < 1) {
        memoErrors.memoMaxDays = ['memoMaxDays must be at least 1'];
      }
      if (maxDays > MEMO_MAX_DAYS_CEILING) {
        memoErrors.memoMaxDays = [`memoMaxDays cannot exceed ${MEMO_MAX_DAYS_CEILING} days`];
      }
      if (maxDays < minDays) {
        memoErrors.memoMaxDays = ['memoMaxDays must be greater than or equal to memoMinDays'];
      }
      if (Object.keys(memoErrors).length > 0) {
        return errorResponse('Validation failed', 400, memoErrors);
      }
      body.memoMinDays = minDays;
      body.memoMaxDays = maxDays;
    }

    const updated = await updateProduct(params.id, body);
    if (!updated) return errorResponse('Product not found', 404);
    return successResponse(updated);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Update failed', 500);
  }
});

export const DELETE = withAdmin(async (_req, { params }) => {
  try {
    await connectDB();
    const deleted = await deleteProduct(params.id);
    if (!deleted) return errorResponse('Product not found', 404);
    return successResponse({ message: 'Product deactivated' });
  } catch (err) {
    return errorResponse('Delete failed', 500);
  }
});
