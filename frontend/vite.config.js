import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Em dev, o Vite encaminha /api para o FastAPI: navegador vê uma única
// origem (igual ao Nginx em produção), sem CORS.
const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:8000",
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
  build: {
    // Sem source maps públicos em produção: não entregar o código-fonte legível.
    sourcemap: false,
  },
});
