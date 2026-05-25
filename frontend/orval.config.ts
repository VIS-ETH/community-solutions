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
  api: {
    output: {
      mode: "tags",
      target: "src/api/hooks/api.ts",
      schemas: "src/api/model",
      client: "react-query",
      httpClient: "fetch",
      mock: false,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: "src/api/mutator.ts",
          name: "customFetch",
        },
      },
    },
    input: {
      target: fileURLToPath(inputPath),
    },
  },
});
