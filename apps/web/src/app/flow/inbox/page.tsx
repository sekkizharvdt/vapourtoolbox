'use client';

/**
 * Inbox → My Work
 *
 * The inbox was one of two lists of work you owe; it merged into My Work at
 * /flow. This stays as a redirect so existing links, bookmarks and the
 * notification deep-links keep working.
 *
 * Under `output: 'export'` there is no server-side redirect, so it happens on
 * mount.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@vapour/ui';

export default function InboxRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/flow');
  }, [router]);

  return <LoadingState message="Taking you to My Work…" />;
}
