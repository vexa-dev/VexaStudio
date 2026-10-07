import { Skeleton } from "@/components/ui/Skeleton";

/** Header + cards placeholder for a screen that is still loading its chunk. */
export function RouteSkeleton() {
  return (
    <output aria-busy="true" className="grid gap-4">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32 sm:col-span-2 lg:col-span-1" />
      </div>
      <Skeleton className="h-40" />
    </output>
  );
}

/** App-shaped placeholder (topbar + content) while the session or layout loads. */
export function AppShellSkeleton() {
  return (
    <div className="min-h-dvh lg:pl-60" aria-busy="true">
      <div className="h-14 border-b border-border" aria-hidden="true" />
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 lg:px-8 lg:pt-8">
        <RouteSkeleton />
      </main>
    </div>
  );
}

/** Minimal centered placeholder for the login and reset screens. */
export function CenteredSkeleton() {
  return (
    <output
      aria-busy="true"
      className="mx-auto grid min-h-dvh w-full max-w-sm content-center gap-3 px-6"
    >
      <span className="sr-only">Cargando…</span>
      <Skeleton className="mx-auto size-12 rounded-full" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-11" />
    </output>
  );
}
