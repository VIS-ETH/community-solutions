import { createRequire } from "node:module";
import path from "node:path";

import { defineConfig, normalizePath, searchForWorkspaceRoot } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { viteStaticCopy } from "vite-plugin-static-copy";
import babel from "@rolldown/plugin-babel";

const require = createRequire(import.meta.url);
const pdfjsDistDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
// The changelog lives in the repository root (one level above the frontend).
// We resolve it through an alias instead of a symlink, since symlinks require
// special privileges on Windows and don't work on some filesystems.
const changelogPath = path.resolve(import.meta.dirname, "../CHANGELOG.md");

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
  resolve: {
    alias: [
      // Matches "@changelog" and keeps any query suffix such as "?raw".
      { find: /^@changelog(?=\?|$)/, replacement: changelogPath },
    ],
  },
  build: {
    outDir: "build",
    assetsDir: "static",
  },
  server: {
    open: true,
    port: 3000,
    fs: {
      // Allow the dev server to serve the changelog from outside the frontend root.
      allow: [searchForWorkspaceRoot(process.cwd()), changelogPath],
    },
    proxy: {
      "/api": {
        target: `http://${process.env.BACKEND_HOST ?? "localhost"}:8081`,
        changeOrigin: false,
        secure: false,
      },
      "/branding": {
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
