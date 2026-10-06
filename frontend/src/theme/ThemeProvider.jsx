import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ThemeContext } from "./ThemeContext";

const STORAGE_KEY = "despacha:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage indisponível */
  }
  return "system";
}

// O tema do sistema operacional é um "estado externo" ao React.
// useSyncExternalStore é a forma oficial de assinar esse tipo de fonte.
function subscribeToSystemTheme(onChange) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSystemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Preferência do usuário: "light" | "dark" | "system".
 * Tema aplicado: atributo data-theme no <html>, que troca os tokens do CSS.
 * O primeiro valor já foi aplicado por public/theme-init.js (sem flash).
 */
export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const systemPrefersDark = useSyncExternalStore(subscribeToSystemTheme, getSystemPrefersDark);

  const theme = preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* sem persistência, mas o tema muda na sessão atual */
    }
  }, []);

  const value = useMemo(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
