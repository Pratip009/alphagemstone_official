// Merge these two entries into the existing `NAV` array in
// src/app/admin/layout.tsx, and add `FileClock, UserCheck` to the existing
// lucide-react import line at the top of that file.

import { FileClock, UserCheck } from 'lucide-react';

export const memoNavEntries = [
  { href: '/admin/memos', label: 'Memos', icon: FileClock },
  { href: '/admin/memo-eligibility', label: 'Memo Applications', icon: UserCheck },
];
