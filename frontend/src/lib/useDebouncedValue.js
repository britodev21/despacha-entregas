import { useEffect, useState } from "react";

/** Devolve `value` só depois que ele para de mudar por `delay` ms (ex.: busca ao digitar). */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
