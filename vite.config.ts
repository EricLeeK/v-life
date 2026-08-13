import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["v-life-icon.svg", "icon-192x192.png", "icon-512x512.png"],
      manifest: {
        name: "V-Life · Personal Life Management",
        short_name: "V-Life",
        description: "AI-powered personal life management app covering schedule, finance, calories, todos, goals, pantry, belongings, thoughts, and weight loss.",
        theme_color: "#f4f3ee",
        background_color: "#f4f3ee",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
        runtimeCaching: [
          {
            // Supabase API — Network First
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Images — Cache First
            urlPattern: /\.(png|jpg|jpeg|gif|svg|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Canonical module registry shared with Supabase edge functions.
      "@modules": path.resolve(__dirname, "./supabase/functions/_shared/moduleRegistry.ts"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["lunar-javascript", "astronomy-engine"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          "data-core": ["@tanstack/react-query", "@supabase/supabase-js"],
          recharts: ["recharts"],
          dnd: ["@hello-pangea/dnd"],
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
