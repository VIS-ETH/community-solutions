import { useRequest } from "ahooks";
import { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import {
  CategoryExam,
  CategoryMetaData,
  CategoryMetaDataMinimal,
  MetaCategory,
} from "../interfaces";
import PDF from "../pdf/pdf-renderer";
import { getDocument } from "../pdf/pdfjs";
import { fetchDelete, fetchGet, fetchPost, fetchPut } from "./fetch-utils";

// Interval to consider "close succession" to de-dupe requests
const RAPID_SUCCESSIVE_REQUESTS_DEDUPE_INTERVAL = 500; // milliseconds

export declare type Mutate<R> = (x: R | undefined | ((data: R) => R)) => void;


export const loadCategories = async () => {
  return (await fetchGet("/api/category/listonlyadmin/"))
    .value as CategoryMetaDataMinimal[];
};
export const loadAllCategories = async () => {
  return (await fetchGet("/api/category/listwithmeta/"))
    .value as CategoryMetaDataMinimal[];
};
export const loadCategoryMetaData = async (slug: string) => {
  return (await fetchGet(`/api/category/metadata/${slug}/`))
    .value as CategoryMetaData;
};
export const loadMetaCategories = async () => {
  return (await fetchGet("/api/category/listmetacategories/"))
    .value as MetaCategory[];
};
export const useMetaCategories = () => {
  const { error, loading, data, mutate } = useRequest(loadMetaCategories, {
    cacheKey: "listmetacategories",
    staleTime: RAPID_SUCCESSIVE_REQUESTS_DEDUPE_INTERVAL,
  });
  return [error, loading, data, mutate] as const;
};
export const loadList = async (slug: string) => {
  return (await fetchGet(`/api/category/listexams/${slug}/`))
    .value as CategoryExam[];
};
export const loadSplitRenderer = async (filename: string) => {
  const pdf = await new Promise<PDFDocumentProxy>((resolve, reject) =>
    getDocument({
      url: filename,
      disableStream: true,
      disableAutoFetch: true,
    }).promise.then(resolve, reject),
  );
  const renderer = new PDF(pdf);
  return [pdf, renderer] as const;
};
export const loadPaymentCategories = async () => {
  return (await fetchGet("/api/category/listonlypayment/"))
    .value as CategoryMetaData[];
};

export const useMutation = <B, T extends any[]>(
  service: (...args: T) => Promise<B>,
  onSuccess?: (res: B, params: T) => void,
) => {
  const { loading, run } = useRequest(service, { manual: true, onSuccess });
  return [loading, run] as const;
};

export const removeCategory = async (slug: string) => {
  await fetchPost("/api/category/remove/", { slug });
};
export const useRemoveCategory = (onSuccess?: () => void) =>
  useMutation(removeCategory, onSuccess);

export const markCategoryUserPinned = async (slug: string) => {
  return fetchPut<{ category_pinned: boolean }>(
    `/api/category/${slug}/pinned/`,
    {},
  );
};

export const unmarkCategoryUserPinned = async (slug: string) => {
  return fetchDelete<{ category_pinned: boolean }>(
    `/api/category/${slug}/pinned/`,
  );
};
