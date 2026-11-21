// lib/revalidateNav.ts
// Wraps admin mutation handlers for categories / subcategories so the cached
// navbar data (see getNavCategories.ts) is refreshed as soon as an edit
// succeeds, instead of waiting for the 10-minute revalidate window.
import { revalidateTag } from 'next/cache';

export const NAV_CATEGORIES_TAG = 'nav-categories';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withNavRevalidate<H extends (...args: any[]) => Promise<Response>>(handler: H): H {
  return (async (...args: Parameters<H>) => {
    const res = await handler(...args);
    if (res.ok) {
      try {
        revalidateTag(NAV_CATEGORIES_TAG);
      } catch (err) {
        console.error('[revalidateNav]', err);
      }
    }
    return res;
  }) as H;
}
