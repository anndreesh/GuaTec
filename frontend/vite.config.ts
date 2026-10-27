import { resolve, relative, sep } from "node:path";
import { rm, readdir } from "node:fs/promises";
import { defineConfig, type Plugin } from "vite";

/** Public assets remain direct URLs; only their names enter the JS bundle. */
function menuBackgrounds(): Plugin {
  const id = "virtual:menu-backgrounds", resolvedId = "\0" + id;
  const directory = resolve(__dirname, "public/images");
  async function images(folder: string): Promise<string[]> {
    const entries = await readdir(folder, { withFileTypes: true });
    const paths = await Promise.all(entries.map(async entry => {
      const path = resolve(folder, entry.name);
      if (entry.isDirectory()) return images(path);
      if (!entry.isFile() || !/\.(avif|webp|png|jpe?g|gif|svg)$/i.test(entry.name)) return [];
      return ["/images/" + relative(directory, path).split(sep).map(encodeURIComponent).join("/")];
    }));
    return paths.flat().sort();
  }
  return {
    name: "discover-menu-backgrounds",
    resolveId(source) { if (source === id) return resolvedId; },
    async load(source) { if (source === resolvedId) return `export default ${JSON.stringify(await images(directory))};`; },
    configureServer(server) {
      const refresh = (path: string) => {
        if (!path.startsWith(directory + sep) || !/\.(avif|webp|png|jpe?g|gif|svg)$/i.test(path)) return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.add(directory);
      server.watcher.on("add", refresh); server.watcher.on("unlink", refresh);
      server.httpServer?.once("close", () => { server.watcher.off("add", refresh); server.watcher.off("unlink", refresh); });
    },
  };
}

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
  plugins: [menuBackgrounds(), ...(command === "build" ? [{
    name: "exclude-source-only-models",
    apply: "build",
    async closeBundle() {
      await Promise.all(sourceOnlyModels.map(file =>
        rm(resolve(__dirname, "dist/assets/models", file), { force: true }),
      ));
    },
  } satisfies Plugin] : [])],
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
