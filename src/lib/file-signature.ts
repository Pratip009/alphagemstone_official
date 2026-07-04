// lib/file-signature.ts
//
// The browser-supplied `File.type` (and the filename extension) are just
// metadata the client sends alongside the bytes — nothing stops a caller
// from relabeling a `.html`/`.svg` payload (or anything else) as
// "image/png". Any code path that trusts `file.type` for a security
// decision (e.g. "is this safe to store/serve as an image?") can be
// bypassed with a single header edit in curl/Postman.
//
// This module inspects the first bytes of the actual file content (the
// "magic number") to determine what the file really is, independent of
// whatever the client claims. Only files whose real signature matches a
// known raster image format are accepted.
//
// Deliberately NOT included: SVG. SVG is XML and can embed <script>,
// event handlers, or external references — it has no safe "magic byte"
// signature to check, and treating it as an image opens a stored-XSS
// path if it's ever rendered/served inline. If SVG upload support is
// ever needed, it requires dedicated sanitization (e.g. DOMPurify with
// an SVG profile), not this signature check.

export type DetectedImageType = "jpeg" | "png" | "gif" | "webp" | "bmp";

const ALL_SUPPORTED_TYPES: DetectedImageType[] = [
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
];

/**
 * Sniffs the real image format from file bytes. Returns null if the
 * content doesn't match any known raster image signature.
 */
export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // GIF: "GIF87a" or "GIF89a"
  const gifHeader = buffer.subarray(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return "gif";
  }

  // WEBP: "RIFF"....\"WEBP\"
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  // BMP: "BM"
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return "bmp";
  }

  return null;
}

/**
 * Validates that a buffer's *actual content* is one of the allowed image
 * formats. Throws with a user-safe message if it isn't — callers should
 * catch this and turn it into a 400 response.
 *
 * This should be called on the real bytes (after `arrayBuffer()`), never
 * substituted with a check on `file.type` or the filename extension,
 * both of which are attacker-controlled.
 */
export function assertValidImageBuffer(
  buffer: Buffer,
  allowed: DetectedImageType[] = ALL_SUPPORTED_TYPES
): DetectedImageType {
  const detected = detectImageType(buffer);
  if (!detected || !allowed.includes(detected)) {
    throw new Error(
      "File content does not match a supported image format (JPEG, PNG, GIF, WebP, or BMP). " +
        "The file's declared type is ignored — only the actual file content is checked."
    );
  }
  return detected;
}
