// Crash and error reports from the app to Sentry. Off in development and when no DSN is set. Nothing personal goes
// out: no default PII, no request bodies, and URLs lose their query strings (signed photo URLs carry access there).
// Error messages are kept, so screens and hooks must never put salaries or document data into an Error.
import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

function withoutQuery(url: unknown): unknown {
  return typeof url === "string" ? url.split("?")[0] : url;
}

export function initMonitoring() {
  if (!dsn || __DEV__) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    attachScreenshot: false,
    beforeBreadcrumb(breadcrumb) {
      // Console output can quote anything; the rest keeps only where it went, not what it carried.
      if (breadcrumb.category === "console") return null;
      if (breadcrumb.data) breadcrumb.data = { ...breadcrumb.data, url: withoutQuery(breadcrumb.data.url) };
      return breadcrumb;
    },
    beforeSend(event) {
      if (event.request) event.request = { url: withoutQuery(event.request.url) as string | undefined };
      return event;
    },
  });
}

export const reportError = (error: unknown) => Sentry.captureException(error);
export const wrapRoot = Sentry.wrap;
