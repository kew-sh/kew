import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/react-router"],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: process.env.KEW_API_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
