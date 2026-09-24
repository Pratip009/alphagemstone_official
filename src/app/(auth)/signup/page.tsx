import { Suspense } from 'react';
import SignupPage from './SignupPage';
import { isGoogleAuthConfigured } from '@/lib/google-oauth';

// Read env at request time so enabling Google doesn't require a rebuild.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignupPage googleEnabled={isGoogleAuthConfigured()} />
    </Suspense>
  );
}
