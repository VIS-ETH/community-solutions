declare module "virtual:changelog" {
  const changelog: {
    version: string;
    content: string;
  }[];

  export default changelog;
}
