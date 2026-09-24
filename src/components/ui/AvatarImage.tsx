"use client";
import { useEffect, useState } from "react";

/** First visible character of a name (or email), uppercased. Emoji-safe. */
export function initialOf(name?: string | null, fallback = "?"): string {
  const first = Array.from((name ?? "").trim())[0];
  return first ? first.toUpperCase() : fallback;
}

interface AvatarImageProps {
  src?: string | null;
  name?: string | null;
  /** Used for the letter when the name is empty. */
  email?: string | null;
  className?: string;
  alt?: string;
}

/**
 * Renders the profile photo, or the first letter of the name when there is
 * no photo or it fails to load (expired Google photo URL, Google refusing
 * the request, offline). Place it inside the existing round avatar wrapper,
 * which already provides the size, background and letter styling.
 */
export default function AvatarImage({ src, name, email, className, alt }: AvatarImageProps) {
  const [failed, setFailed] = useState(false);

  // A new photo (upload, or a different user) gets a fresh attempt.
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return <>{initialOf(name, initialOf(email))}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? name ?? ""}
      className={className}
      // Google's photo server (lh3.googleusercontent.com) often rejects
      // requests that carry a Referer from another site.
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}