import { useEffect, useState } from "react";

import { getCurrentPosition } from "./geolocation";

/** Localização pedida em segundo plano assim que o diálogo abre. */
export function useOneShotLocation() {
  const [location, setLocation] = useState({ status: "loading", coords: null });
  useEffect(() => {
    let active = true;
    getCurrentPosition().then(
      (coords) => active && setLocation({ status: coords ? "ok" : "unavailable", coords }),
    );
    return () => {
      active = false;
    };
  }, []);
  return location;
}
