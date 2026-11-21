'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// GemConsultant pulls in framer-motion, react-markdown and remark-gfm. A
// static import put all of that into the shared JS of EVERY page even though
// it only renders on "/". Loading it dynamically keeps it out of every other
// route's bundle, and defers it on the homepage until after hydration.
const GemConsultant = dynamic(
  () => import('@/components/GemConsultant/GemConsultant'),
  { ssr: false },
);

export default function HomeOnlyWidgets() {
  const pathname = usePathname();
  if (pathname !== '/') return null;
  return <GemConsultant />;
}
