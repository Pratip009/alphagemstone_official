import { connectDB } from "@/lib/db";
import {
  countProductsAdmin,
  bulkReactivateProductsAdmin,
} from "@/services/product.service";
import { withAdmin } from "@/middleware/auth.middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

// Reactivates every product matching a filter (category/subcategory/
// search/shape/clarity/status/memo — the same filters the admin product
// list uses), instead of one product at a time. Mirror image of
// bulk-deactivate: sets isActive back to true instead of false.
//
// POST (not PUT) for the same reason as bulk-deactivate — a JSON body is
// never in question across proxies/clients. Two-step by design:
//   1. { ...filters }                -> preview only, returns the count,
//                                        nothing is changed
//   2. { ...filters, confirm: true } -> actually reactivates that set
//
// Refuses to run (400) if no filter is set at all, so this endpoint can
// never become an accidental "reactivate the whole catalogue" — same
// guardrail as bulk-deactivate.
const bodySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  status: z.enum(["all", "active", "inactive"]).optional(),
  shape: z.string().optional(),
  clarity: z.string().optional(),
  memo: z.enum(["all", "eligible", "not"]).optional(),
  confirm: z.boolean().optional().default(false),
});

export const POST = withAdmin(async (req) => {
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Validation failed", 400, parsed.error.flatten().fieldErrors);
    }
    const { confirm, ...filters } = parsed.data;

    if (!confirm) {
      const matched = await countProductsAdmin(filters);
      return successResponse({ preview: true, matched });
    }

    const result = await bulkReactivateProductsAdmin(filters);
    return successResponse({ preview: false, ...result });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Bulk reactivate failed",
      err instanceof Error && err.message.includes("At least one filter") ? 400 : 500
    );
  }
});