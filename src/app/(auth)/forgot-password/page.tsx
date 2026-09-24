import { Suspense } from 'react';
import LoginPage from './LoginPage';
import { isGoogleAuthConfigured } from '@/lib/google-oauth';

// Read env at request time so enabling Google doesn't require a rebuild.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage googleEnabled={isGoogleAuthConfigured()} />
    </Suspense>
  );
}
