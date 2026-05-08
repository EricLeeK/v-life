import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core framework — cached aggressively
          vendor: ["react", "react-dom", "react-router-dom"],
          // Data layer
          "data-core": ["@tanstack/react-query", "@supabase/supabase-js"],
          // Charts — only loaded on pages that use them
          recharts: ["recharts"],
          // DnD — only loaded on Projects page
          dnd: ["@hello-pangea/dnd"],
          // UI primitives — shared across all pages
          "ui-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-progress",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
}));
