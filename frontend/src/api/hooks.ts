import { useRequest } from "ahooks";
import { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import {
  CategoryExam,
  CategoryMetaData,
  CategoryMetaDataMinimal,
  MetaCategory,
  NotificationInfo,
} from "../interfaces";
import PDF from "../pdf/pdf-renderer";
import { getDocument } from "../pdf/pdfjs";
import { fetchDelete, fetchGet, fetchPost, fetchPut } from "./fetch-utils";

// Interval to consider "close succession" to de-dupe requests
const RAPID_SUCCESSIVE_REQUESTS_DEDUPE_INTERVAL = 500; // milliseconds

export declare type Mutate<R> = (x: R | undefined | ((data: R) => R)) => void;

const loadEnabledNotifications = async (isMyself: boolean) => {
  if (isMyself) {
    return new Set<number>(
      (await fetchGet(`/api/notification/getenabled/`)).value,
    );
  } else {
    return undefined;
  }
};
export const useEnabledNotifications = (isMyself: boolean) => {
  const { error, loading, data, run } = useRequest(
    () => loadEnabledNotifications(isMyself),
    {
      refreshDeps: [isMyself],
      cacheKey: "enabled-notifications",
    },
  );
  return [error, loading, data, run] as const;
};
const setEnabledNotifications = async (type: number, enabled: boolean) => {
  await fetchPost(`/api/notification/setenabled/`, {
    type,
    enabled,
  });
};
export const useSetEnabledNotifications = (cb: () => void) => {
  const { error, loading, run } = useRequest(setEnabledNotifications, {
    manual: true,
    onSuccess: cb,
  });
  return [error, loading, run] as const;
};
const loadNotifications = async (mode: "all" | "unread") => {
  if (mode === "all") {
    return (await fetchGet("/api/notification/all/"))
      .value as NotificationInfo[];
  } else {
    return (await fetchGet("/api/notification/unread/"))
      .value as NotificationInfo[];
  }
};
export const useNotifications = (mode: "all" | "unread") => {
  const { error, loading, data, run } = useRequest(
    () => loadNotifications(mode),
    {
      refreshDeps: [mode],
      cacheKey: `notifications-${mode}`,
    },
  );
  return [error, loading, data, run] as const;
};
const markAllRead = async (...ids: string[]) => {
  return Promise.all(
    ids.map(oid =>
      fetchPost(`/api/notification/setread/${oid}/`, {
        read: true,
      }),
    ),
  );
};
export const useMarkAllAsRead = () => {
  const { error, loading, run } = useRequest(markAllRead, {
    manual: true,
  });
  return [error, loading, run] as const;
};

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
