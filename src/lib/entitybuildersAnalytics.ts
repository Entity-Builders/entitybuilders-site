import { Analytics, PostHogProvider } from '@eb-packages/analytics';

type PageType = 'home' | 'privacy' | 'unknown';

type AnalyticsConfig = {
  posthogKey?: string;
  posthogHost?: string;
  environment: string;
  route: string;
  pageType: PageType;
  title: string;
};

type SafeEventProperties = {
  route?: string;
  page_type?: PageType;
  surface?: string;
  action?: string;
  entity_status?: string;
  entity_type?: string;
  question_index?: number;
  answer_length_bucket?: string;
  context_length_bucket?: string;
  fit_score?: 'high_fit' | 'medium_fit' | 'low_fit';
  email_status?: 'sent' | 'failed';
  error_category?: string;
  [key: string]: string | number | boolean | undefined;
};

declare global {
  interface Window {
    entityBuildersAnalytics?: {
      track: (event: string, properties?: SafeEventProperties) => void;
      lengthBucket: (text: string) => string;
      getSourceMetadata: () => SafeEventProperties;
    };
  }
}

const analytics = new Analytics(new PostHogProvider());
let initialized = false;
let clickTrackingAttached = false;
let config: AnalyticsConfig | null = null;

function readConfig(): AnalyticsConfig | null {
  const el = document.getElementById('entitybuilders-analytics-config');
  if (!el?.textContent) return null;

  try {
    return JSON.parse(el.textContent) as AnalyticsConfig;
  } catch {
    return null;
  }
}

function sanitize(value: string | undefined, fallback = 'unknown'): string {
  const safe = value?.trim();
  if (!safe) return fallback;
  return safe.slice(0, 120);
}

export function lengthBucket(text: string): string {
  const length = text.trim().length;
  if (length <= 0) return 'empty';
  if (length <= 240) return 'short';
  if (length <= 900) return 'medium';
  return 'long';
}

function baseProperties(): SafeEventProperties {
  return {
    route: config?.route ?? window.location.pathname,
    page_type: config?.pageType ?? 'unknown',
  };
}

export function trackEntityBuildersEvent(
  event: string,
  properties: SafeEventProperties = {},
): void {
  if (!initialized) return;

  analytics.track(event, {
    app: 'entitybuilders',
    environment: config?.environment ?? 'unknown',
    ...baseProperties(),
    ...properties,
  });
}

function attachClickTracking(): void {
  if (clickTrackingAttached) return;
  clickTrackingAttached = true;

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest<HTMLAnchorElement>('a[href]');
      if (!link) return;

      const surface = sanitize(
        link.dataset.analyticsSurface ??
          link.closest<HTMLElement>('[data-analytics-surface]')?.dataset
            .analyticsSurface,
      );
      const action = sanitize(link.dataset.analyticsAction, 'link_click');

      trackEntityBuildersEvent('entitybuilders_link_click', {
        surface,
        action,
      });
    },
    { passive: true },
  );
}

export function initEntityBuildersAnalyticsFromDom(): void {
  if (initialized) return;
  config = readConfig();
  if (!config?.posthogKey) return;

  analytics.init({
    apiKey: config.posthogKey,
    apiHost: config.posthogHost || 'https://us.i.posthog.com',
    autocapture: false,
    disableSessionRecording: true,
  });
  analytics.setGlobalProperties({
    app: 'entitybuilders',
    platform: 'web',
    environment: config.environment,
  });

  initialized = true;

  window.entityBuildersAnalytics = {
    track: trackEntityBuildersEvent,
    lengthBucket,
    getSourceMetadata: baseProperties,
  };

  trackEntityBuildersEvent('entitybuilders_page_view', {
    surface: config.pageType,
  });
  attachClickTracking();
}
