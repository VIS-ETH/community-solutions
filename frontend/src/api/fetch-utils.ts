/**
 * Minimum validity of the access token in seconds when a request to the API starts
 */
export const minValidity = 10;

let refreshRequest: Promise<Response> | undefined = undefined;

export function getAuthenticationExpiry() {
  const token_expires = getCookie("token_expires");
  const refresh_expires = getCookie("refresh_expires");
  const now = new Date().getTime();
  return {
    token: token_expires
      ? new Date(parseFloat(token_expires) * 1000).getTime() - now
      : undefined,
    refresh: refresh_expires
      ? new Date(parseFloat(refresh_expires) * 1000).getTime() - now
      : undefined,
  };
}

/**
 * Checks whether it would make sense to call `refreshToken()`
 * @returns Returns `true` iff. there is a token and it is expired.
 */
export function isTokenExpired(expires = getAuthenticationExpiry().token) {
  if (expires === undefined) return false;
  return expires < minValidity * 1000;
}

/**
 * Checks whether it makes sense to
 * @returns
 */
export function authenticated(expires = getAuthenticationExpiry().token) {
  return expires !== undefined;
}

const encodeScopes = (...scopes: string[]) => scopes.join("+");

const scopes = encodeScopes("profile", "openid");

export function login(redirectUrl = window.location.pathname) {
  window.location.href = `/api/auth/login?scope=${scopes}&rd=${encodeURIComponent(
    redirectUrl,
  )}`;
}

export function logout(redirectUrl = window.location.pathname) {
  window.location.href = `/api/auth/logout?rd=${encodeURIComponent(
    redirectUrl,
  )}`;
}

export function refreshToken() {
  if (refreshRequest !== undefined) {
    return refreshRequest;
  }
  refreshRequest = fetch(`/api/auth/refresh?scope=${scopes}`, {
    headers: getHeaders(),
  }).then(req => {
    refreshRequest = undefined;
    return req;
  });
  return refreshRequest;
}

export function getHeaders(requestInit?: RequestInit) {
  const headers = new Headers(requestInit?.headers);
  headers.set("X-CSRFToken", getCookie("csrftoken") ?? "");
  if (localStorage.getItem("simulate_nonadmin")) {
    headers.set("SimulateNonAdmin", "true");
  }
  return Object.fromEntries(headers);
}

export async function performDataRequest<T>(
  method: string,
  url: string | URL,
  data: Record<string, any> | FormData | string | URLSearchParams,
  requestInit?: RequestInit,
): Promise<HttpResponse<T>> {
  // Refresh token if needed.
  // If refresh fails or if the refresh token is expired too, we won't outright
  // reject the network request. This is because some endpoints don't need auth,
  // like the category list. Since we don't know which backend routes need auth
  // and which don't, we let the backend deal with any auth failures.
  const { token: exp, refresh: refresh_exp } = getAuthenticationExpiry();
  if (isTokenExpired(exp) && !isTokenExpired(refresh_exp)) {
    await refreshToken();
  }

  let formData: FormData | URLSearchParams | string = new FormData();
  if (
    data instanceof FormData ||
    data instanceof URLSearchParams ||
    typeof data === "string"
  ) {
    formData = data;
  } else {
    // Convert the `data` object into a `formData` object by iterating
    // through the keys and appending the (key, value) pair to the FormData
    // object. All non-Blob values are converted to a string.

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      } else {
        formData.append(key, value.toString());
      }
    }
  }

  const response = await fetch(url, {
    ...requestInit,
    credentials: "include",
    headers: getHeaders(requestInit),
    method,
    body: formData,
  });
  try {
    const body = (await response.json()) as T;
    if (!response.ok) {
      return Promise.reject((body as { err: string }).err);
    }
    return {
      data: body,
      status: response.status,
      headers: response.headers,
    };
  } catch (e: any) {
    return Promise.reject(e.toString());
  }
}

export interface HttpResponse<T> {
  status: number;
  headers: Headers;
  data: T;
}

export async function performRequest<T>(
  method: string,
  url: string | URL,
  requestInit?: RequestInit,
): Promise<HttpResponse<T>> {
  // Refresh token if needed.
  // If refresh fails or if the refresh token is expired too, we won't outright
  // reject the network request. This is because some endpoints don't need auth,
  // like the category list. Since we don't know which backend routes need auth
  // and which don't, we let the backend deal with any auth failures.
  const { token: exp, refresh: refresh_exp } = getAuthenticationExpiry();
  if (isTokenExpired(exp) && !isTokenExpired(refresh_exp)) {
    await refreshToken();
  }

  const response = await fetch(url, {
    ...requestInit,
    credentials: "include",
    headers: getHeaders(requestInit),
    method,
  });
  try {
    const body = (await response.json()) as T;
    if (!response.ok) {
      return Promise.reject((body as { err: string }).err);
    }
    return {
      data: body,
      status: response.status,
      headers: response.headers,
    };
  } catch (e: any) {
    return Promise.reject(e.toString());
  }
}

export function getCookie(name: string): string | null {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) === `${name}=`) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
export async function fetchPost<T = any>(
  url: string,
  data: Record<string, any>,
): Promise<T> {
  const response = await performDataRequest<T>("POST", url, data);
  return response.data;
}

export async function fetchPut<T = any>(
  url: string,
  data: Record<string, any>,
): Promise<T> {
  const response = await performDataRequest<T>("PUT", url, data);
  return response.data;
}

export async function fetchPatch<T = any>(
  url: string,
  data: Record<string, any>,
): Promise<T> {
  const response = await performDataRequest<T>("PATCH", url, data);
  return response.data;
}

export async function fetchDelete<T = any>(url: string): Promise<T> {
  const response = await performRequest<T>("DELETE", url);
  return response.data;
}

export async function fetchGet<T = any>(url: string): Promise<T> {
  const response = await performRequest<T>("GET", url);
  return response.data;
}

export function download(url: string, name?: string) {
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.href = url;
  a.target = "_blank";
  a.download = name ?? "file";
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 0);
}

export async function downloadIndirect(url: string) {
  const { value: signedUrl } = await fetchGet(url);
  download(signedUrl);
}
