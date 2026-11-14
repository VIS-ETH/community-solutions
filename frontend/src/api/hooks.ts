import PDF from "../pdf/pdf-renderer";
import { getDocument } from "../pdf/pdfjs";

export const loadSplitRenderer = async (filename: string) => {
  const pdf = await getDocument({
    url: filename,
    disableStream: true,
    disableAutoFetch: true,
  }).promise;
  const renderer = new PDF(pdf);
  return [pdf, renderer] as const;
};
