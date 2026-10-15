import { createRequire } from "node:module";
import path from "node:path";

import { defineConfig, normalizePath } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { viteStaticCopy } from "vite-plugin-static-copy";
import babel from "@rolldown/plugin-babel";

const require = createRequire(import.meta.url);
const pdfjsDistDir = path.dirname(require.resolve("pdfjs-dist/package.json"));

export default defineConfig({
  plugins: [
    react(),
    svgr({
      include: "**/*.svg?react",
    }),
    babel({
      presets: [reactCompilerPreset()],
    }),
    viteStaticCopy({
      targets: [
        {
          src: normalizePath(path.join(pdfjsDistDir, "wasm/*")),
          dest: "static/pdfjs/wasm",
          rename: {
            stripBase: true,
          },
        },
      ],
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
