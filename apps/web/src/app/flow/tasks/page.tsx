'use client';

/**
 * My Tasks → My Work
 *
 * Manual tasks now live in the same list as the notifications you owe, at
 * /flow. This stays as a redirect so existing links and bookmarks keep working.
 *
 * `?new=true` is preserved: the dashboard and command palette use it to open
 * the create dialog straight away.
 *
 * Under `output: 'export'` there is no server-side redirect, so it happens on
 * mount.
 */

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingState } from '@vapour/ui';

function TasksRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const isNew = searchParams.get('new') === 'true';
    router.replace(isNew ? '/flow?new=true' : '/flow');
  }, [router, searchParams]);

  return <LoadingState message="Taking you to My Work…" />;
}

export default function TasksRedirectPage() {
  return (
    <Suspense fallback={<LoadingState message="Taking you to My Work…" />}>
      <TasksRedirect />
    </Suspense>
  );
}
