import { createContext, useContext } from "react";

/** Estado do compartilhamento de localização do entregador. */
export const TrackingContext = createContext({ status: "idle", refresh: () => {} });

export function useTracking() {
  return useContext(TrackingContext);
}
