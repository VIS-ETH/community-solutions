import { clearReadingPages } from "../utils/reading-page";
import {
  getAuthLoginUrl,
  getAuthLogoutUrl,
  getAuthRefreshUrl,
} from "./hooks/auth";

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

const encodeScopes = (...scopes: string[]) => scopes.join(" ");

const scopes = encodeScopes("profile", "openid");

export function login(redirectUrl = location.pathname) {
  location.href = getAuthLoginUrl({
    rd: redirectUrl,
    scope: scopes,
  });
}

export function logout(redirectUrl = location.pathname) {
  clearReadingPages();
  const form = document.createElement("form");
  form.method = "POST";
  form.action = getAuthLogoutUrl();

  const rdInput = document.createElement("input");
  rdInput.name = "rd";
  rdInput.value = redirectUrl;
  rdInput.type = "hidden";
  form.append(rdInput);

  const csrfInput = document.createElement("input");
  csrfInput.name = "csrfmiddlewaretoken";
  csrfInput.value = getCookie("csrftoken") ?? "";
  csrfInput.type = "hidden";
  form.append(csrfInput);

  document.body.append(form);
  form.submit();
}

export function refreshToken() {
  if (refreshRequest !== undefined) {
    return refreshRequest;
  }
  const refreshUrl = getAuthRefreshUrl({
    scope: scopes,
  });
  refreshRequest = fetch(refreshUrl, {
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

export function getCookie(name: string): string | null {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      cookie = cookie.trim();

      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) === `${name}=`) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
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
