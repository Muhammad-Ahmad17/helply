import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/chat": { target: "http://localhost:3001", changeOrigin: true },
      "/api/crawl": { target: "http://localhost:3002", changeOrigin: true },
      "/api/bots": { target: "http://localhost:3001", changeOrigin: true },
      "/api/auth": { target: "http://localhost:3001", changeOrigin: true },
      "/api/admin": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
