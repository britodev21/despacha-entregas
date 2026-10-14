import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader/PageLoader";

// Mapa carregado sob demanda: o Leaflet (~150 KB) só é baixado por quem abre o mapa.
const TrackingPage = lazy(() =>
  import("./TrackingPage").then((module) => ({ default: module.TrackingPage })),
);

export function LazyTrackingPage() {
  return (
    <Suspense fallback={<PageLoader label="Carregando mapa" />}>
      <TrackingPage />
    </Suspense>
  );
}
