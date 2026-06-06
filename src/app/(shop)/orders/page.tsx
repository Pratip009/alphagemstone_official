import { Suspense } from 'react';
import OrdersPage from './OrdersPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrdersPage />
    </Suspense>
  );
}