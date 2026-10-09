import { defineConfig } from "vite";

// Dev-server proxy so the SPA can call relative "/api/..." URLs without
// hard-coding the backend origin; production deployments should instead
// set VITE_API_BASE_URL and serve the built assets behind the same
// reverse proxy as the Flask API (see docker-compose.yml).
export default defineConfig({
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
});
