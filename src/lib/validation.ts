import { z, ZodError } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Shared email schema for all auth routes.
//
// Why this exists: every auth route previously declared its own
// `z.string().email()` and each service function separately did
// `email.toLowerCase()` when querying Mongo. That meant:
//   1. Whitespace (e.g. a trailing space from copy/paste) was never
//      stripped at the API boundary, only by Mongoose's `trim: true` on
//      the *stored* User document — so a lookup for "user@x.com " would
//      not match a stored "user@x.com", and vice versa depending on which
//      side had the stray space.
//   2. Casing normalization was duplicated in six different files. One
//      inconsistency (e.g. a route that forgot `.toLowerCase()`) is enough
//      to make "email already exists" checks and "does this email exist"
//      checks disagree with each other.
//
// Normalizing once, here, at the zod layer means every route and service
// function receives the exact same canonical string for a given input.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address');

// ─────────────────────────────────────────────────────────────────────────────
// Turns a ZodError into one human-readable sentence for the API's top-level
// `message` field.
//
// Before this, every auth route did:
//   errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors)
// which put the actually useful text ("Password must be at least 6
// characters") inside `errors.password[0]`, a field the login/signup pages
// never read — they only ever displayed the generic `message`. The user
// saw "Validation failed" with no indication of what to fix.
export function firstZodErrorMessage(error: ZodError, fallback = 'Please check your input and try again.'): string {
  const first = error.issues[0];
  return first?.message || fallback;
}