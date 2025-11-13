# Sentry Error Tracking Setup Guide

This guide explains how to set up Sentry error tracking for the VDT Unified application.

## Overview

Sentry provides real-time error tracking and monitoring for the application, helping you:

- Catch and diagnose errors before users report them
- Track error frequency and trends
- Get detailed stack traces and context
- Monitor application performance
- Replay user sessions leading to errors

## Quick Start

### 1. Create a Sentry Account

1. Go to [sentry.io](https://sentry.io) and create an account (free tier available)
2. Create a new project and select "Next.js" as the platform
3. Note your DSN (Data Source Name) - you'll need this for configuration

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and update the Sentry variables:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/web/.env.local` and add:

```env
# Required: Sentry DSN (from your Sentry project settings)
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_PUBLIC_KEY@o0.ingest.sentry.io/YOUR_PROJECT_ID

# Optional: For production source map uploads
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=your_auth_token_here

# Environment identifier
NEXT_PUBLIC_ENVIRONMENT=development
```

### 3. Get Your Sentry DSN

1. Log in to [sentry.io](https://sentry.io)
2. Navigate to **Settings** → **Projects** → **[Your Project]** → **Client Keys (DSN)**
3. Copy the **DSN** value
4. Paste it into your `.env.local` file as `NEXT_PUBLIC_SENTRY_DSN`

### 4. (Optional) Set Up Source Maps for Production

Source maps help Sentry show you the exact line of code that caused an error. To enable:

1. Create a Sentry Auth Token:
   - Go to **Settings** → **Account** → **API** → **Auth Tokens**
   - Click **Create New Token**
   - Name: "Source Map Upload"
   - Scopes: `project:releases` and `project:write`
   - Copy the token

2. Add to `.env.local`:
   ```env
   SENTRY_AUTH_TOKEN=your_token_here
   SENTRY_ORG=your-org-slug  # From your Sentry URL
   SENTRY_PROJECT=your-project-slug  # From your Sentry URL
   ```

## Configuration Files

The following Sentry configuration files have been created:

### Client Configuration (`sentry.client.config.ts`)

Configures Sentry for client-side error tracking:

- Error reporting with session replay
- Performance monitoring
- Breadcrumb tracking
- Error filtering (browser extensions, network errors, etc.)

### Edge Runtime Configuration (`sentry.edge.config.ts`)

Configures Sentry for edge runtime (Vercel Edge Functions, Middleware):

- Lightweight configuration for edge environments
- Basic error tracking

### Instrumentation (`instrumentation.ts`)

Next.js instrumentation hook that:

- Initializes Sentry based on runtime (Node.js, Edge)
- Provides request error handling

### Next.js Configuration (`next.config.ts`)

Integrates Sentry webpack plugin for:

- Automatic source map upload
- React component annotations
- Bundle size optimization

## Error Boundaries Integration

Error boundaries automatically report to Sentry with module-specific context:

### Root Error Boundary

- **File**: `src/components/ErrorBoundary.tsx`
- **Tag**: `errorBoundary: root`
- **Context**: Component stack trace

### Module-Specific Error Boundaries

- **Dashboard**: `src/app/dashboard/error.tsx` (tag: `module: dashboard`)
- **Accounting**: `src/app/accounting/error.tsx` (tag: `module: accounting`)
- **Projects**: `src/app/projects/error.tsx` (tag: `module: projects`)
- **Procurement**: `src/app/procurement/error.tsx` (tag: `module: procurement`)

Each module error boundary includes:

- Module tag for filtering in Sentry
- Error digest for tracking
- Detailed error context

## Testing Sentry Integration

### Local Development Testing

1. Start the development server:

   ```bash
   pnpm dev
   ```

2. Trigger a test error:
   - Add this to any component:
     ```typescript
     throw new Error('Sentry test error');
     ```
   - Visit that page in your browser

3. Check Sentry dashboard:
   - Go to **Issues** in Sentry
   - You should see the test error appear within seconds

### Production Testing

1. Build the application:

   ```bash
   pnpm build
   ```

2. Deploy to your hosting platform
3. Trigger an error in production
4. Verify error appears in Sentry with source maps

## Sentry Features

### Error Tracking

All JavaScript errors are automatically tracked:

- Unhandled promise rejections
- Component errors (via Error Boundaries)
- Network errors
- Console errors

### Performance Monitoring

Tracks application performance:

- Page load times
- API response times
- Component render times
- Database query performance

### Session Replay

Records user sessions leading to errors:

- Click events
- Navigation
- Console logs
- Network requests

**Note**: Session replay is configured with privacy settings:

- All text is masked by default
- All media (images, video) is blocked
- Only 10% of sessions are recorded (configurable)

### Breadcrumbs

Automatically tracks user actions before errors:

- Navigation
- UI clicks
- Console logs
- Network requests
- State changes

## Filtering Errors

The configuration includes filters to reduce noise:

### Ignored Errors

- Network errors (`Failed to fetch`, `NetworkError`)
- Browser extension errors
- Non-error promise rejections

### Filtered by Source

- Chrome extensions
- Third-party scripts
- Browser plugins

You can customize these filters in `sentry.client.config.ts`.

## Sentry Tags

Errors are tagged for easy filtering:

| Tag             | Values                                               | Description          |
| --------------- | ---------------------------------------------------- | -------------------- |
| `module`        | `dashboard`, `accounting`, `projects`, `procurement` | Application module   |
| `errorBoundary` | `root`, `dashboard-module`, etc.                     | Error boundary type  |
| `errorDigest`   | UUID                                                 | Next.js error digest |
| `environment`   | `development`, `production`                          | Environment          |

## Best Practices

### 1. Don't Log Sensitive Data

Never send sensitive information to Sentry:

```typescript
// ❌ Bad - exposes user data
Sentry.captureException(error, {
  extra: {
    email: user.email,
    password: password,
  },
});

// ✅ Good - sanitized data
Sentry.captureException(error, {
  extra: {
    userId: user.id,
    action: 'login_attempt',
  },
});
```

### 2. Use Sentry Contexts

Add context to help debug issues:

```typescript
Sentry.setContext('payment', {
  amount: 1000,
  currency: 'INR',
  paymentMethod: 'card',
});
```

### 3. Set User Context

Identify users for better error tracking:

```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.displayName,
});
```

### 4. Add Breadcrumbs

Track custom events:

```typescript
Sentry.addBreadcrumb({
  category: 'procurement',
  message: 'Purchase order created',
  level: 'info',
  data: {
    poNumber: 'PO-001',
    vendor: 'ABC Corp',
  },
});
```

### 5. Monitor Performance

Track custom transactions:

```typescript
const transaction = Sentry.startTransaction({
  name: 'Calculate Budget',
  op: 'function',
});

// ... your code ...

transaction.finish();
```

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN Configuration**
   - Verify `NEXT_PUBLIC_SENTRY_DSN` is set in `.env.local`
   - Restart development server after changing `.env.local`

2. **Check Browser Console**
   - Look for Sentry initialization messages
   - Check for network errors to Sentry

3. **Verify Sentry is Initialized**
   - Add `debug: true` to `sentry.client.config.ts`
   - Check console for Sentry debug logs

### Source Maps Not Working

1. **Check Auth Token**
   - Verify `SENTRY_AUTH_TOKEN` has correct permissions
   - Token needs `project:releases` and `project:write` scopes

2. **Verify Build Process**
   - Source maps are only uploaded in production builds
   - Check build logs for Sentry webpack plugin output

3. **Check Sentry Dashboard**
   - Go to **Settings** → **Projects** → **Source Maps**
   - Verify source maps are uploaded

### High Error Volume

1. **Filter Noise**
   - Add errors to `ignoreErrors` in `sentry.client.config.ts`
   - Use `beforeSend` to filter errors

2. **Adjust Sample Rates**
   - Reduce `tracesSampleRate` (default: 0.1 for production)
   - Reduce `replaysSessionSampleRate` (default: 0.1)

## Cost Optimization

Sentry pricing is based on:

- Number of errors tracked
- Number of transactions (performance monitoring)
- Number of replays (session replay)

To optimize costs:

1. **Use Sampling**
   - Set `tracesSampleRate: 0.1` (10% of transactions)
   - Set `replaysSessionSampleRate: 0.1` (10% of sessions)

2. **Filter Errors**
   - Ignore common, non-actionable errors
   - Filter third-party errors

3. **Set Rate Limits**
   - Configure project rate limits in Sentry dashboard
   - Set alerts for unusual error spikes

## Free Tier Limits

Sentry free tier includes:

- 5,000 errors/month
- 10,000 transactions/month
- 50 replays/month
- 1 team member
- 30 days data retention

For higher limits, upgrade to paid plan.

## Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry JavaScript SDK](https://docs.sentry.io/platforms/javascript/)
- [Sentry Best Practices](https://docs.sentry.io/product/best-practices/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Session Replay](https://docs.sentry.io/product/session-replay/)

## Support

For issues with Sentry integration:

1. Check [Sentry Status](https://status.sentry.io/)
2. Review [Sentry Docs](https://docs.sentry.io/)
3. Ask in [Sentry Discord](https://discord.gg/sentry)
4. Contact VDT support team
