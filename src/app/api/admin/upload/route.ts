import { NextRequest } from "next/server";
import { uploadBuffer } from "@/lib/cloudinary";
import { withAdmin } from "@/middleware/auth.middleware";
import { errorResponse } from "@/lib/api-response";

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return errorResponse("No files provided", 400);
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        return errorResponse(`"${file.name}" is not an image`, 400);
      }
      if (file.size > 10 * 1024 * 1024) {
        return errorResponse(`"${file.name}" exceeds the 10 MB limit`, 400);
      }
    }

    const urls = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
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