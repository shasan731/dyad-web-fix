import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Skip certain warnings during build
        if (warning.code === 'UNRESOLVED_ENTRY' || warning.code === 'CIRCULAR_DEPENDENCY') {
          return;
        }
        warn(warning);
      },
    },
  },
});
