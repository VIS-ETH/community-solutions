import {
  performRequest,
  performDataRequest,
  type HttpResponse,
} from "./fetch-utils";

export const customFetch = async <T>(
  url: string | URL,
  options: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  } & RequestInit,
): Promise<T> => {
  let response: HttpResponse<T>;

  if (options.method === "GET" || options.method === "DELETE") {
    response = await performRequest<T>(options.method, url, options);
  } else {
    const body = options.body;

    response = await performDataRequest<T>(
      options.method,
      url,
      body ?? {},
      options,
    );
  }

  return response.data;
};
