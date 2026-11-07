import { useRequest } from "ahooks";
import PDF from "../pdf/pdf-renderer";
import { getDocument } from "../pdf/pdfjs";

export declare type Mutate<R> = (x: R | undefined | ((data: R) => R)) => void;

export const loadSplitRenderer = async (filename: string) => {
  const pdf = await getDocument({
    url: filename,
    disableStream: true,
    disableAutoFetch: true,
  }).promise;
  const renderer = new PDF(pdf);
  return [pdf, renderer] as const;
};

export const useMutation = <B, T extends unknown[]>(
  service: (...args: T) => Promise<B>,
  onSuccess?: (res: B, params: T) => void,
) => {
  const { loading, run } = useRequest(service, { manual: true, onSuccess });
  return [loading, run] as const;
};
