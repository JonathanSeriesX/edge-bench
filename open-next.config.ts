import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

// The one disclosed deviation from platform defaults (see the dashboard
// methodology): OpenNext's default ("dummy") incremental cache re-renders the
// prerendered page inside the Worker on every request — measured at
// ~300-500 ms TTFB with zero cache headers. The static-assets cache serves
// prerendered HTML straight from Workers assets, and cache interception
// answers those requests before the Next.js server even boots. This app has
// no ISR/revalidation, which is exactly the case the read-only assets cache
// is for.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
