import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  return NextResponse.next();
}

// ✅ Disabled — auth handled client-side in each page
export const config = {
  matcher: [],
};