"""Password hashing (PBKDF2-SHA256) and HS256 JWT encode/decode, stdlib only.

Deliberately small: this app has two roles and a handful of users, so a
compiled bcrypt/pyjwt dependency isn't worth it. PBKDF2 with a high iteration
count and per-hash salt is a fine choice at this scale.
"""

import base64
import hashlib
import hmac
import json
import secrets
import time

_PBKDF2_ROUNDS = 600_000
_ALGO = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"{_ALGO}${_PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algo, rounds, salt_hex, digest_hex = encoded.split("$")
        if algo != _ALGO:
            return False
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds))
    except (ValueError, AttributeError):
        return False
    return hmac.compare_digest(expected, actual)


def generate_temp_password(length: int = 12) -> str:
    # url-safe, unambiguous-ish, always mixed — for one-time hand-off to a mentor.
    alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


class TokenError(Exception):
    pass


def create_token(claims: dict, secret: str, ttl_seconds: int) -> str:
    now = int(time.time())
    payload = {**claims, "iat": now, "exp": now + ttl_seconds}
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header}.{body}".encode()
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url_encode(sig)}"


def decode_token(token: str, secret: str) -> dict:
    try:
        header_b64, body_b64, sig_b64 = token.split(".")
    except ValueError:
        raise TokenError("Malformed token.")

    expected_sig = hmac.new(secret.encode(), f"{header_b64}.{body_b64}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected_sig, _b64url_decode(sig_b64)):
        raise TokenError("Bad token signature.")

    try:
        payload = json.loads(_b64url_decode(body_b64))
    except (ValueError, json.JSONDecodeError):
        raise TokenError("Malformed token payload.")

    if int(payload.get("exp", 0)) < int(time.time()):
        raise TokenError("Token expired.")
    return payload
