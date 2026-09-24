/**
 * CompleteSource — homepage "Your complete gemstone source" section with a
 * full product finder.
 *
 * Server component: pre-renders every filter count, so tabs, shapes and
 * colors appear instantly with real numbers. Products are listed only after
 * the visitor searches or picks a filter. After that, the client component talks to
 * /api/products/finder as the visitor searches and filters.
 * If the database is unreachable the section still renders; the client
 * then fetches on mount.
 */
import CompleteSourceClient from "./CompleteSourceClient";
import type { FinderResult } from "@/lib/finder";

async function loadInitial(): Promise<FinderResult | null> {
  try {
    const { runFinder } = await import("@/lib/finder");
    await import("@/models/Category"); // registers the schema for category names
    return await runFinder({ page: 1, limit: 1 }); // only the counts are used up front
  } catch (err) {
    console.error("[CompleteSource]", err);
    return null;
  }
}

export default async function CompleteSource() {
  const initial = await loadInitial();
  return <CompleteSourceClient initial={initial} />;
}