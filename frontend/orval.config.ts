import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { defineConfig } from "orval";

async function resolveOpenApiPath() {
  const frontendRoot = import.meta.url;
  const comsolRoot = new URL("../", frontendRoot);

  // Outside docker, it is written to backend/static/
  const hostPath = new URL("backend/static/openapi.json", comsolRoot);
  // Inside docker, we copy it to frontend/public/
  const dockerPath = new URL("public/openapi.json", frontendRoot);

  try {
    await readFile(dockerPath);
    return dockerPath;
  } catch {
    return hostPath;
  }
}

const inputPath = await resolveOpenApiPath();

export default defineConfig({
  petstore: {
    output: {
      mode: "tags-split",
      target: "src/api/hooks/petstore.ts",
      schemas: "src/api/model",
      client: "react-query",
    },
    input: {
      target: fileURLToPath(inputPath),
    },
    hooks: {
      afterAllFilesWrite: "prettier --write",
    },
  },
});
