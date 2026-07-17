import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getProductsByIds } from '@/services/product.service';
import { successResponse, errorResponse } from '@/lib/api-response';

// Hard cap protects against an oversized/abusive payload — the client-side
// history is itself capped well below this, so a legitimate request never
// gets truncated.
const MAX_IDS = 50;

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const ids = (body as { ids?: unknown })?.ids;
    if (!Array.isArray(ids)) {
      return errorResponse('"ids" must be an array of product ids', 400);
    }

    const cleanIds = ids
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, MAX_IDS);

    if (cleanIds.length === 0) {
      return successResponse([]);
    }

    await connectDB();
    const products = await getProductsByIds(cleanIds);

    // Preserve the order the caller requested (most-recently-viewed first),
    // since Mongo's $in does not guarantee result order. Products that were
    // deleted, deactivated, or had an invalid id are simply absent — the
    // client uses that to prune its own history.
    const byId = new Map(products.map((p) => [String((p as { _id: unknown })._id), p]));
    const ordered = cleanIds.map((id) => byId.get(id)).filter(Boolean);

    return successResponse(ordered);
  } catch (err) {
    console.error('[POST /api/products/by-ids]', err);
    return errorResponse('Failed to fetch products', 500);
  }
}