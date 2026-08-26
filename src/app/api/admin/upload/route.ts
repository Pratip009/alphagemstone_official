import { NextRequest } from "next/server";
import { uploadBuffer } from "@/lib/cloudinary";
import { withAdmin } from "@/middleware/auth.middleware";
import { errorResponse } from "@/lib/api-response";
import { assertValidImageBuffer } from "@/lib/file-signature";

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return errorResponse("No files provided", 400);
    }

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        return errorResponse(`"${file.name}" exceeds the 10 MB limit`, 400);
      }
    }

    // Read all buffers up front and verify each file's *actual* content
    // (magic bytes), not the client-supplied `file.type` — that field is
    // just metadata the caller can set to anything, e.g. relabeling an
    // .html or .svg-with-script payload as "image/png".
    const buffers = await Promise.all(
      files.map(async (file) => ({
        file,
        buffer: Buffer.from(await file.arrayBuffer()),
      }))
    );

    for (const { file, buffer } of buffers) {
      try {
        assertValidImageBuffer(buffer);
      } catch {
        return errorResponse(`"${file.name}" is not a valid image file`, 400);
      }
    }

    const urls = await Promise.all(
      buffers.map(async ({ file, buffer }) => {
        const { secure_url } = await uploadBuffer(buffer, file.name, "products");
        return secure_url;
      })
    );

    return Response.json({ success: true, urls });
  } catch (err) {
    console.error("[POST /api/admin/upload]", err);
    return errorResponse(
      err instanceof Error ? err.message : "Upload failed",
      500
    );
  }
});