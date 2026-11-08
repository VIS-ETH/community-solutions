export type KeysWhereValue<T, S> = {
  [K in keyof T]: T[K] extends S ? K : never;
}[keyof T];

type Options = Record<string, string>;
type OptionsResult<T extends Options> = {
  [key in keyof T]: { value: key; label: T[key] };
};

export const createOptions = <T extends Options>(o: T) =>
  Object.fromEntries(
    Object.entries(o).map(([key, value]) => [
      key,
      { value: key, label: value },
    ]) as [string, unknown][],
  ) as unknown as OptionsResult<T>;
export const options = <T extends Options>(map: OptionsResult<T>) =>
  Object.values(map) as { value: keyof T & string; label: string }[];
