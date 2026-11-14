declare module "virtual:changelog" {
  const changelog: {
    version: string;
    title: string;
    content: string;
  }[];

  export default changelog;
}
