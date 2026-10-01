'use client';

import dynamic from 'next/dynamic';

// Cookie banner isn't needed for first paint; load it after hydration.
const CookieConsent = dynamic(() => import('@/components/ui/Cookieconsent'), { ssr: false });

export default function CookieConsentLazy() {
  return <CookieConsent />;
}