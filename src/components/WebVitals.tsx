"use client";

import { useReportWebVitals } from "next/web-vitals";

type Metric = { id: string; name: string; value: number; rating?: string; navigationType?: string };

// Stable reference so metrics are not reported twice.
function report(metric: Metric) {
  const body = JSON.stringify({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    path: window.location.pathname,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/vitals", body);
  } else {
    fetch("/api/vitals", { method: "POST", body, keepalive: true });
  }
}

/** Real-user Core Web Vitals (LCP, INP, CLS, FCP, TTFB) reported to /api/vitals. */
export function WebVitals() {
  useReportWebVitals(report);
  return null;
}
