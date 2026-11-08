import changelogSource from "@changelog?raw";

const VERSION_HEADING = /^(v\S+).*[\s]*$/m;
const LEVEL_2_HEADING = /^## (.*)$/gm;

const parseVersions = (): {
  version: string;
  index: number;
  content: string;
}[] => {
  const matches: { version: string; index: number; content: string }[] = [];
  for (const m of changelogSource.matchAll(LEVEL_2_HEADING)) {
    const version = VERSION_HEADING.exec(m[1]);
    matches.push({
      version: version ? version[1] : m[1],
      index: m.index,
      content: "",
    });
  }
  for (const [i, match] of matches.entries()) {
    const nextIndex =
      i + 1 < matches.length ? matches[i + 1].index : changelogSource.length;
    // Ignore first line - it is the heading
    const firstLineEnd = changelogSource.indexOf("\n", match.index);
    match.content = changelogSource.slice(firstLineEnd + 1, nextIndex).trim();
  }
  return matches;
};

export const versions = parseVersions();

export const latestVersion: string | undefined = versions[0]?.version;
