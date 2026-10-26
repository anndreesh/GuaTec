import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import { defineConfig } from "vite";

const sourceOnlyModels = [
  "arboles.glb",
  "edificio_colon_-_modelo_3d.glb",
  "mercenary_astronaut.glb",
  "mies_van_der_rohe_oficina_bacardi.glb",
  "space_shuttle_nasa.glb",
];

// Dev-server proxy so the SPA can call relative "/api/..." URLs without
// hard-coding the backend origin; production deployments should instead
// set VITE_API_BASE_URL and serve the built assets behind the same
// reverse proxy as the Flask API (see docker-compose.yml).
export default defineConfig(({ command }) => ({
  plugins: command === "build" ? [{
    name: "exclude-source-only-models",
    apply: "build",
    async closeBundle() {
      await Promise.all(sourceOnlyModels.map(file =>
        rm(resolve(__dirname, "dist/assets/models", file), { force: true }),
      ));
    },
  }] : [],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      input: ["index.html", "legal.html"],
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5050",
        changeOrigin: true,
      },
    },
  },
}));
