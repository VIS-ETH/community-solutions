import datetime
import logging
from base64 import b64decode, b64encode, urlsafe_b64encode
from hashlib import sha256
from secrets import token_bytes
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.http import HttpRequest
from django.http.response import (
    HttpResponse,
    HttpResponseBadRequest,
    HttpResponseServerError,
)
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.csrf import csrf_protect
from ninja import Cookie, Form, P, Query, Router, Schema

from myauth import auth_check
from users.api import UserSchema
from util.schemas import ValueWrapped

logger = logging.getLogger(__name__)


router = Router(tags=["Auth"])


class User(Schema):
    loggedin: bool
    isAdmin: bool
    isCategoryAdmin: bool
    user: UserSchema | None


@router.get(
    "me/",
    response={
        200: ValueWrapped[User],
    },
    operation_id="authViewMe",
)
def me_view(request):
    if request.user is not None:
        user = User(
            loggedin=True,
            isAdmin=auth_check.has_admin_rights(request),
            isCategoryAdmin=auth_check.has_admin_rights_for_any_category(request),
            user=request.user,
        )
    else:
        user = User(
            loggedin=False,
            isAdmin=False,
            isCategoryAdmin=False,
            user=None,
        )

    return {
        "value": user,
    }


def redirect_url_from_host(host: str):
    return (
        ("http://" if settings.DEBUG else "https://")
        + host
        + reverse("api-1.0.0:auth_callback")
    )


# https://gist.github.com/cameronmaske/f520903ade824e4c30ab
def base64url_encode(data: bytes):
    """
    Removes any `=` used as padding from the encoded string.
    """
    encoded = str(urlsafe_b64encode(data), "utf-8")
    return encoded.rstrip("=")


state_delimeter = ":"


# We encode our state params as b64(nonce):rd_url
def encode_state(nonce: bytes, redirect_url: str):
    return str(b64encode(nonce), "utf-8") + state_delimeter + redirect_url


# Decode callback state into nonce and rd_url
def decode_state(state: str):
    parts = state.split(state_delimeter)
    if len(parts) != 2:
        raise ValueError("invalid state format")
    nonce = b64decode(bytes(parts[0], "utf-8"))
    redirect_url = parts[1]
    return nonce, redirect_url


def compute_hash(value: bytes):
    m = sha256()
    m.update(value)
    return base64url_encode(m.digest())


@router.get(
    "login",
    response={
        302: None,
    },
    operation_id="authLogin",
)
def login(
    request: HttpRequest,
    response: HttpResponse,
    scope: str = "",
    redirect_url: Query[str, P(alias="rd")] = "/",  # ty: ignore[invalid-type-form, invalid-type-arguments]
):
    # Check whether the redirect url is allowed: Only allow redirects to the same application
    if not url_has_allowed_host_and_scheme(
        redirect_url, settings.REAL_ALLOWED_HOSTS, settings.SECURE
    ):
        return HttpResponseBadRequest("invalid redirect url")

    # We generate a random nonce and store it encrypted as a httpOnly cookie
    # In the callback endpoint. we then check whether it matches the state we get
    # from the server to prevent CSRF attacks
    nonce = token_bytes(32)

    state = encode_state(nonce, redirect_url)
    query_params = {
        "response_type": "code",
        "client_id": settings.OAUTH2_CLIENT_ID,
        "redirect_uri": redirect_url_from_host(request.get_host()),
        "scope": scope,
        "state": state,
    }

    # We only need to store the nonce in the cookie, we can trust the AP to correctly
    # give us the redirect_url once we verified the nonce
    nonce_cookie = compute_hash(nonce)

    # The base URL of our redirect
    url = settings.OAUTH2_AUTH_URL

    response.status_code = 302
    # We need the nonce in a request which comes back from the AP - thus we have to
    # use sameSite=Lax to have the cookie included in that request
    # httponly doesn't really matter - this is only used by us (RP) to verify that the callback
    # comes from our chosen OP
    response.set_cookie("nonce", nonce_cookie, httponly=True, samesite="Lax")
    response.headers["Location"] = url + "?" + urlencode(query_params)
    return response


# set_token_cookies extracts the tokens from token_response and saves them
# in cookies
def set_token_cookies(response: HttpResponse, token_response):
    token_type: str = token_response["token_type"]

    if token_type.lower() != "bearer":
        raise ValueError("OP returned unexpected token_type")

    now = datetime.datetime.now()

    # Extract expiration time without decoding the token - this is only used by the
    # client and thus isn't relevant for security
    if "expires_in" in token_response:
        expires_in: str = token_response["expires_in"]
        expires = now + datetime.timedelta(seconds=float(expires_in))
        response.set_cookie(
            "token_expires", str(expires.timestamp()), httponly=False, samesite="Lax"
        )

    access_token = token_response["access_token"]
    response.set_cookie(
        "access_token",
        access_token,
        httponly=True,
        samesite="Strict" if settings.SECURE else "Lax",
        secure=settings.SECURE,
    )

    # Per OAuth2 spec a refresh response doesn't necessarily include a new refresh_token
    # If that is not the case we assume the refresh_token is still valid.
    if "refresh_token" in token_response:
        refresh_token: str = token_response["refresh_token"]
        response.set_cookie(
            "refresh_token",
            refresh_token,
            httponly=True,
            samesite="Strict" if settings.SECURE else "Lax",
            secure=settings.SECURE,
        )

    # Keycloak in particular may send us a refresh_expires_in number, which is
    # the session expiry for the refresh token (it's longer than expires_in).
    # Handling it is optional, but we prefer to store and use it so we don't
    # spam-request refreshing when our refresh token is already expired.
    if "refresh_expires_in" in token_response:
        refresh_expires_in: str = token_response["refresh_expires_in"]
        refresh_expires = now + datetime.timedelta(seconds=float(refresh_expires_in))
        response.set_cookie(
            "refresh_expires",
            str(refresh_expires.timestamp()),
            httponly=False,  # Client side JS will need to read it
            samesite="Strict" if settings.SECURE else "Lax",
            secure=settings.SECURE,
        )

    return response


@router.get(
    "callback",
    response={
        302: None,
    },
    operation_id="authCallback",
)
def auth_callback(
    request: HttpRequest,
    response: HttpResponse,
    error: str | None = None,
    error_description: str | None = None,
    code: str | None = None,
    state: str | None = None,
    nonce_cookie: Cookie[str | None, P(alias="nonce")] = None,  # ty: ignore[invalid-type-arguments, invalid-type-form]
):
    # E.g. https://exams.vis.ethz.ch/api/auth/callback?error=invalid_scope&error_description=Invalid+scopes:+profile+openid+badscope
    if error:
        return HttpResponseBadRequest(f"{error}: {error_description}")

    # Check whether all relevant parameters exist
    if code is None or state is None or nonce_cookie is None:
        return HttpResponseBadRequest("code, state or nonce cookie not provided")

    # Reverse encoding, check validity of nonce
    query_nonce, redirect_url = decode_state(state)
    query_nonce_hash = compute_hash(query_nonce)
    if nonce_cookie != query_nonce_hash:
        return HttpResponseBadRequest("nonce didn't match")

    # Use the code + client_secret to get our tokens
    with requests.post(
        settings.OAUTH2_TOKEN_URL,
        data={
            "client_id": settings.OAUTH2_CLIENT_ID,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_url_from_host(request.get_host()),
            "client_secret": settings.OAUTH2_CLIENT_SECRET,
        },
        headers={"Accept": "application/json"},
    ) as r:
        res = r.json()

    if "error" in res:
        logger.error("Unable to request token: %s", res["error"])
        return HttpResponseServerError(
            res["error"]
            + (": " + res["error_description"] if "error_description" in res else "")
        )

    response.status_code = 302
    set_token_cookies(response, res)
    response.delete_cookie("nonce")

    # redirect back to the location that was used in login
    response.headers["Location"] = redirect_url

    return response


@router.get(
    "refresh",
    response={
        200: None,
    },
    operation_id="authRefresh",
)
def refresh(
    request: HttpRequest,
    response: HttpResponse,
    refresh_token: Cookie[str],
    scope: str = "",
    refresh_expires: Cookie[str | None] = None,
):
    if refresh_expires:
        now = datetime.datetime.now()
        if float(refresh_expires) < now.timestamp():
            # Don't try to refresh if the refresh token is no longer valid
            return HttpResponse("Refresh token is no longer valid", status=400)

    # Get new tokens
    with requests.post(
        settings.OAUTH2_TOKEN_URL,
        data={
            "client_id": settings.OAUTH2_CLIENT_ID,
            "client_secret": settings.OAUTH2_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": scope,
        },
        headers={"Accept": "application/json"},
    ) as r:
        # A non 200 status code implies that the request was not successful
        if r.status_code != 200:
            return HttpResponse("Refresh failed", status=403)

        res = r.json()

    if "error" in res:
        logger.error("Unable to request token: %s", res["error"])
        return HttpResponseServerError(
            res["error"]
            + (": " + res["error_description"] if "error_description" in res else "")
        )

    set_token_cookies(response, res)

    return response


@router.post(
    "logout",
    response={
        302: None,
    },
    operation_id="authLogout",
)  # ty: ignore[invalid-argument-type]
@csrf_protect  # ty: ignore[invalid-argument-type]
def logout(
    request: HttpRequest,
    response: HttpResponse,
    redirect_url: Form[str, P(alias="rd")] = "/",  # ty: ignore[invalid-type-arguments, invalid-type-form]
):
    # Check whether the redirect url is allowed: Only allow redirects to the same application
    if not url_has_allowed_host_and_scheme(
        redirect_url, settings.REAL_ALLOWED_HOSTS, settings.SECURE
    ):
        return HttpResponseBadRequest("invalid redirect url")

    response.status_code = 302

    response.delete_cookie("id_token")
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    response.delete_cookie("token_expires")
    response.delete_cookie("refresh_expires")

    # redirect back to the location that was used in login
    response.headers["Location"] = redirect_url

    return response
