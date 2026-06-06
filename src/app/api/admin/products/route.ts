import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  createProduct,
  listProducts,
  updateProduct,
  deleteProduct,
} from "@/services/product.service";
import { withAdmin } from "@/middleware/auth.middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";
import {
  SHAPES, COLORS, CLARITIES, CERTIFICATIONS,
  WATCH_GENDERS, WATCH_BRANDS, WATCH_MOVEMENTS,
  WATCH_STRAP_TYPES, WATCH_CASE_MATERIALS, WATCH_DIAL_COLORS,
  WATCH_FEATURES, WATCH_STYLES, WATCH_CASE_SIZES,
} from "@/models/Product";

const productSchema = z.object({
  // ── Discriminator ──────────────────────────────────────────────────────────
  productType: z.enum(["diamond", "watch"]),

  // ── Shared fields ──────────────────────────────────────────────────────────
  name: z.string().min(2).max(200),
  category: z.string().min(1),
  subcategory: z
    .string()
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  images: z.array(z.string().min(1)).default([]),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().default(true),

  // ── Diamond fields (optional at schema level) ──────────────────────────────
  shape: z.array(z.enum(SHAPES)).min(1).optional(),
  size: z.number().positive().optional(),
  color: z.array(z.enum(COLORS)).min(1).optional(),
  clarity: z.array(z.enum(CLARITIES)).min(1).optional(),
  certification: z.array(z.enum(CERTIFICATIONS)).optional().default([]),

  // ── Watch fields (optional at schema level) ────────────────────────────────
  watchGender: z.enum(WATCH_GENDERS).optional(),
  watchBrand: z.enum(WATCH_BRANDS).optional(),
  watchMovement: z.enum(WATCH_MOVEMENTS).optional(),
  watchStrapType: z.enum(WATCH_STRAP_TYPES).optional(),
  watchCaseMaterial: z.enum(WATCH_CASE_MATERIALS).optional(),
  watchDialColor: z.enum(WATCH_DIAL_COLORS).optional(),
  watchFeatures: z.array(z.enum(WATCH_FEATURES)).optional().default([]),
  watchStyle: z.enum(WATCH_STYLES).optional(),
  watchCaseSize: z.enum(WATCH_CASE_SIZES).optional(),
});

export const POST = withAdmin(async (req) => {
  try {
    await connectDB();
    const body = await req.json();

    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      console.error("ZOD ERRORS:", JSON.stringify(parsed.error.flatten(), null, 2));
      return errorResponse("Validation failed", 400, parsed.error.flatten().fieldErrors);
    }

    const data = parsed.data;

    // ── Cross-field validation based on productType ────────────────────────
    if (data.productType === "watch") {
      const watchErrors: Record<string, string[]> = {};
      if (!data.watchBrand)    watchErrors.watchBrand    = ["Brand is required for watches"];
      if (!data.watchMovement) watchErrors.watchMovement = ["Movement is required for watches"];
      if (Object.keys(watchErrors).length > 0) {
        return errorResponse("Validation failed", 400, watchErrors);
      }
    } else {
      // diamond
      const diamondErrors: Record<string, string[]> = {};
      if (!data.shape?.length)   diamondErrors.shape   = ["At least one shape is required"];
      if (!data.size)            diamondErrors.size    = ["Size (carat) is required"];
      if (!data.color?.length)   diamondErrors.color   = ["At least one color is required"];
      if (!data.clarity?.length) diamondErrors.clarity = ["At least one clarity is required"];
      if (Object.keys(diamondErrors).length > 0) {
        return errorResponse("Validation failed", 400, diamondErrors);
      }
    }

    // Strip productType before saving — it's not part of the Mongoose schema
    const { productType: _, ...productData } = data;

    const product = await createProduct(productData as never);
    return successResponse(product, 201);
  } catch (err) {
    console.error("[POST /api/admin/products]", err);
    return errorResponse(
      err instanceof Error ? err.message : "Failed to create product",
      500,
    );
  }
});

export const GET = withAdmin(async (req) => {
  try {
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get("page") || 1);
    const limit = Number(sp.get("limit") || 1000);

    const { products, total } = await listProducts({ page, limit });
    return Response.json({ success: true, data: products, total, page, limit });
  } catch (err) {
    return errorResponse("Failed to fetch products", 500);
  }
});