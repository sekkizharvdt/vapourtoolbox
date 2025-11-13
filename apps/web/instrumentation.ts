export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side instrumentation - not used in static export but good for future
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string | string[] | undefined };
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering';
    revalidateReason: 'on-demand' | 'stale' | undefined;
    renderType: 'dynamic' | 'dynamic-resume';
  }
) => {
  // Error handling instrumentation
  console.error('Request error:', {
    path: request.path,
    method: request.method,
    error: err,
    context,
  });
};
