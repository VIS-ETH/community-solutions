import {
  getAuthenticationExpiry,
  getHeaders,
  isTokenExpired,
  refreshToken,
} from "./fetch-utils";
import type { ErrorSchema } from "./model";

export class ApiError<T = ErrorSchema> extends Error {
  constructor(
    public readonly status: number,
    public readonly body: T | undefined,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

export type ErrorType<E> = ApiError<E>;

export const customFetch = async <T>(
  url: string,
  init: RequestInit,
): Promise<T> => {
  // Refresh token if needed.
  // If refresh fails or if the refresh token is expired too, we won't outright
  // reject the network request. This is because some endpoints don't need auth,
  // like the category list. Since we don't know which backend routes need auth
  // and which don't, we let the backend deal with any auth failures.
  const { token, refresh } = getAuthenticationExpiry();

  let response: Response;
  let text: string;
  try {
    if (isTokenExpired(token) && !isTokenExpired(refresh)) {
      await refreshToken();
    }
    response = await fetch(url, {
      ...init,
      credentials: "include",
      headers: getHeaders(init),
    });
    // Endpoints might respond with `200, None` or `204`
    text = await response.text();
  } catch (e) {
    // Let react-query see cancellations as such
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // token refresh, request or reading body failed
    throw new ApiError(0, undefined, "Network error", { cause: e });
  }

  const httpStatus = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
  let body: unknown = undefined;
  try {
    if (text !== "") body = JSON.parse(text);
  } catch (e) {
    throw new ApiError(
      response.status,
      undefined,
      response.ok ? `Invalid response (${httpStatus})` : httpStatus,
      { cause: e },
    );
  }

  if (!response.ok) {
    const errBody = body as
      (Partial<ErrorSchema> & { detail?: unknown }) | undefined;

    throw new ApiError(
      response.status,
      body as ErrorSchema | undefined,
      typeof errBody?.err === "string"
        ? errBody.err
        : typeof errBody?.detail === "string"
          ? errBody.detail
          : httpStatus,
    );
  }
  return body as T;
};
