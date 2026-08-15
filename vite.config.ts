import { defineConfig } from "vite";

export default defineConfig({
  base: "/phylum/",
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    exclude: ["@dimforge/rapier2d-compat"],
  },
});
