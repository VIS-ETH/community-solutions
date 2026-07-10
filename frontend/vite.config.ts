import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import babel from "@rolldown/plugin-babel";

export default defineConfig({
  plugins: [
    react(),
    svgr({
      include: "**/*.svg?react",
    }),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
  build: {
    outDir: "build",
    assetsDir: "static",
  },
  server: {
    open: true,
    port: 3000,
    proxy: {
      "/api": {
        target: `http://${process.env.BACKEND_HOST ?? "localhost"}:8081`,
        changeOrigin: false,
        secure: false,
      },
      "/static/ninja": {
        target: `http://${process.env.BACKEND_HOST ?? "localhost"}:8081`,
        changeOrigin: false,
        secure: false,
      },
    },
  },
  css: {
    modules: {
      localsConvention: "camelCaseOnly",
    },
  },
});
