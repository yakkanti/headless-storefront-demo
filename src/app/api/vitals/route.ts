/**
 * Receives real-user Core Web Vitals beacons. In production this would forward
 * to the observability stack (Dynatrace, Datadog, etc.). Here it writes a
 * structured log line, which Vercel captures per deployment.
 */
export async function POST(request: Request) {
  try {
    const metric = (await request.json()) as { name?: string; value?: number; rating?: string; path?: string };
    if (typeof metric.name === "string" && typeof metric.value === "number") {
      console.log(
        JSON.stringify({
          type: "web-vital",
          name: metric.name,
          value: Math.round(metric.value * 100) / 100,
          rating: metric.rating,
          path: metric.path,
        }),
      );
    }
  } catch {
    // Beacons are best effort; never fail the page over telemetry.
  }
  return new Response(null, { status: 204 });
}
