'use client';

import { usePathname } from 'next/navigation';
// import FloatingSocialIcons from '@/components/ui/FloatingSocialIcons';
import GemConsultant from '@/components/GemConsultant/GemConsultant';

export default function HomeOnlyWidgets() {
  const pathname = usePathname();
  const isHome = pathname === '/';

  if (!isHome) return null;

  return (
    <>
      {/* <FloatingSocialIcons /> */}
      <GemConsultant />
    </>
  );
}