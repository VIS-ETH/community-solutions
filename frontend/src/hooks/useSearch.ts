import { QuickScore, Options } from "quick-score";
import { useMemo } from "react";

/**
 * A React wrapper around the fuse.js search method that returns all data source elements
 * if pattern is undefined.
 * @param data The array that should be used as the fuse.js data source
 * @param options An object of fuse.js options
 * @param pattern The pattern that should be searched for
 * @param searchOptions Options passed to the fuse.js search method
 */
const useSearch = <T extends object, K extends (keyof T)[]>(
  data: T[],
  options: Options<K>,
  pattern: string,
) => {
  const qs = useMemo(() => new QuickScore<T, K>(data, options), [
    data,
    options,
  ]);

  const res = useMemo(() => qs.search(pattern), [qs, pattern]);

  return res;
};
export default useSearch;
