declare module "quick-score" {
  export type Match = Array<[number, number]>;
  export type Result<T, K> = {
    item: T;
    score: number;
    scoreKey: string;
    scores: Record<K[number], number>;
    matches: Record<K[number], Match>;
  };
  export type Options<K> = {
    keys: K;
    scorer?: (str: string, query: string, arr: T[]) => number;
    config?: any;
    minimumScore?: number;
  };
  export class QuickScore<
    T extends string | object,
    K extends (string | keyof T)[]
  > {
    constructor(items: T[], options?: Options<K>);
    search(query: string): Result<T, K>[];
  }
}
