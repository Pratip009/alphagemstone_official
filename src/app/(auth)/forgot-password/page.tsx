import { Suspense } from 'react';
import ForgotPasswordPage from './ForgotPasswordPage';

export default function Page() {
  return (
    <Suspense>
      <ForgotPasswordPage />
    </Suspense>
  );
}