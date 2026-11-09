import { readFile } from "node:fs/promises";
import path from "node:path";

import { exactRegex } from "@rolldown/pluginutils";
import type { Plugin } from "vite";

const changelogPath = path.resolve(import.meta.dirname, "../../CHANGELOG.md");

const VERSION_HEADING = /^(v\S+).*[\s]*$/m;
const LEVEL_2_HEADING = /^## (.*)$/gm;

function parseVersions(source: string): {
  version: string;
  content: string;
}[] {
  const matches: { version: string; content: string }[] = [];
  const sections = [...source.matchAll(LEVEL_2_HEADING)];

  let previousIndex = undefined;
  for (const m of sections.toReversed()) {
    const versionMatch = VERSION_HEADING.exec(m[1]);
    const version = versionMatch ? versionMatch[1] : m[1];

    // Ignore first line - it is the heading
    const firstLineEnd = source.indexOf("\n", m.index);
    const content = source.slice(firstLineEnd + 1, previousIndex).trim();

    if (!content) {
      throw new Error(`Missing changes for version ${version}.`);
    }

    matches.unshift({
      version,
      content,
    });

    previousIndex = m.index;
  }

  return matches;
}

export function changelogParserPlugin() {
  const virtualModuleId = "virtual:changelog";
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;

  return {
    name: "@comsol/changelog-parser",
    resolveId: {
      filter: {
        id: exactRegex(virtualModuleId),
      },
      handler() {
        return resolvedVirtualModuleId;
      },
    },
    load: {
      filter: {
        id: exactRegex(resolvedVirtualModuleId),
      },
      async handler() {
        const changelogSource = await readFile(changelogPath, "utf8");

        this.addWatchFile(changelogPath);

        return {
          code: `export default ${JSON.stringify(parseVersions(changelogSource))}`,
          map: null,
        };
      },
    },
  } satisfies Plugin;
}
