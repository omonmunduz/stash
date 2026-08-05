/**
 * DASHBOARD LOADING BOUNDARY
 *
 * Why this file exists at all: without a loading boundary, a dynamic route has
 * nothing for Next to prefetch and nothing to paint on click, so the previous
 * page stays frozen on screen for the full duration of the server render — auth
 * plus queries. The screen looks broken even when the request is healthy.
 *
 * Placed at the route-group root so every dashboard page inherits it. A page with
 * a materially different shape can add its own loading.tsx, which takes
 * precedence over this one.
 *
 * Deliberately generic: this stands in for lists, detail pages and the dashboard
 * alike, so it suggests "content is arriving" rather than mimicking one specific
 * layout. A skeleton that mismatches the real page causes a visible jump when
 * content lands, which reads as slower than a neutral placeholder.
 */

export default function DashboardLoading() {
  return (
    <div
      className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6"
      // Announced politely rather than assertively: navigation is expected, so
      // it should not interrupt whatever the screen reader is currently reading.
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>

      {/* Page header: title + description */}
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Body rows. Six is about one phone screen — enough to fill the viewport
          without implying a specific record count. */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}
