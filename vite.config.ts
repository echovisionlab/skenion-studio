import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900
  },
  optimizeDeps: {
    exclude: ["@skenion/contracts"]
  },
  plugins: [react()],
  server: {
    watch: {
      ignored: ["**/.deps/**"]
    }
  }
});
