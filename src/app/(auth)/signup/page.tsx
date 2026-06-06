import { Suspense } from 'react';
import SignupPage from './SignupPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignupPage />
    </Suspense>
  );
}