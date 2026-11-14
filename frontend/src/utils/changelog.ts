import changelogVersions from "virtual:changelog";

export const versions = changelogVersions;

export const latestVersion: string | undefined = versions[0]?.version;
