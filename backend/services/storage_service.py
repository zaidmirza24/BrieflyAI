"""Direct-to-storage uploads via Backblaze B2 (S3-compatible API).

B2 is used purely as a TEMPORARY staging layer between the browser upload
and Deepgram -- see api/services/analysis_service.py, which deletes the
object only after the analysis is saved to MongoDB.

The backend never touches audio bytes for the upload itself: it only mints
a short-lived presigned PUT URL scoped to one object key. The browser
uploads straight to B2 with that URL. Credentials (B2_KEY_ID /
B2_APPLICATION_KEY) live only in backend env vars -- never sent to the
client. For the download side (pulling the file back down for Deepgram),
the backend already holds those credentials, so it fetches the object
directly rather than minting another presigned URL.
"""

import os
import re
import uuid

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

from config import AppConfig
from backend.constants import ALLOWED_AUDIO_EXTENSIONS


class StorageError(Exception):
    """Human-readable, user-facing storage error."""


class StorageNotConfigured(StorageError):
    pass


def _normalize_endpoint(endpoint: str) -> str:
    # Accept the endpoint with or without a scheme (B2's bucket details page
    # shows it as a bare host, e.g. "s3.us-east-005.backblazeb2.com").
    return endpoint if endpoint.startswith(("http://", "https://")) else f"https://{endpoint}"


def _region_from_endpoint(endpoint: str) -> str:
    # B2's S3-compatible endpoints look like s3.<region>.backblazeb2.com --
    # SigV4 signing needs the matching region or requests fail to sign.
    match = re.match(r"https?://s3\.([a-z0-9-]+)\.backblazeb2\.com", endpoint)
    return match.group(1) if match else "us-west-004"


def _client(cfg: AppConfig):
    if not (cfg.b2_key_id and cfg.b2_application_key and cfg.b2_endpoint):
        raise StorageNotConfigured(
            "Audio storage isn't configured yet. Set B2_KEY_ID, B2_APPLICATION_KEY "
            "and B2_ENDPOINT in the backend environment."
        )
    endpoint = _normalize_endpoint(cfg.b2_endpoint)
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=cfg.b2_key_id,
        aws_secret_access_key=cfg.b2_application_key,
        config=BotoConfig(signature_version="s3v4", region_name=_region_from_endpoint(endpoint)),
    )


def validate_filename(filename: str) -> str:
    """Returns the validated extension (lowercase, with dot) or raises StorageError.

    Only the extension is authoritative -- browsers report wildly inconsistent
    Content-Type/MIME values for the same audio file (e.g. Chromium reports
    .aac as "audio/vnd.dlna.adts"), so that value is used only to set the
    object's Content-Type in storage, never to block an upload."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise StorageError(
            f"Unsupported audio file type '{ext or 'unknown'}'. "
            f"Supported types: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}."
        )
    return ext


def create_presigned_upload(
    cfg: AppConfig,
    filename: str,
    content_type: str | None,
    size_bytes: int | None,
) -> dict:
    ext = validate_filename(filename)

    max_bytes = cfg.max_upload_mb * 1024 * 1024
    if size_bytes is not None:
        if size_bytes <= 0:
            raise StorageError("Audio file appears to be empty.")
        if size_bytes > max_bytes:
            raise StorageError(f"Audio file is too large (max {cfg.max_upload_mb} MB).")

    storage_key = f"uploads/{uuid.uuid4().hex}{ext}"
    client = _client(cfg)

    put_kwargs = {
        "Bucket": cfg.b2_bucket,
        "Key": storage_key,
    }
    if content_type:
        put_kwargs["ContentType"] = content_type

    try:
        upload_url = client.generate_presigned_url(
            ClientMethod="put_object",
            Params=put_kwargs,
            ExpiresIn=cfg.b2_upload_url_ttl_seconds,
        )
    except (BotoCoreError, ClientError) as e:
        raise StorageError("Could not create an upload link right now. Please try again.") from e

    return {
        "upload_url": upload_url,
        "storage_key": storage_key,
        "content_type": content_type,
        "expires_in_seconds": cfg.b2_upload_url_ttl_seconds,
    }


def download_object_to_file(cfg: AppConfig, storage_key: str, dest_path: str) -> None:
    """Pulls a staged object down from B2 into a local file so the existing
    (unmodified) core pipeline -- which expects a local path -- can read it."""
    client = _client(cfg)
    try:
        client.download_file(cfg.b2_bucket, storage_key, dest_path)
    except (BotoCoreError, ClientError) as e:
        raise StorageError("Could not retrieve the uploaded audio file. Please try again.") from e


def delete_object(cfg: AppConfig, storage_key: str) -> None:
    """Best-effort: never raises. A failed delete just leaves the object for
    the cleanup job to catch later -- callers (post-success cleanup, the
    abandoned-upload sweep) should never be blocked by a delete failure."""
    try:
        client = _client(cfg)
        client.delete_object(Bucket=cfg.b2_bucket, Key=storage_key)
    except (StorageError, BotoCoreError, ClientError):
        pass


def confirm_object_exists(cfg: AppConfig, storage_key: str) -> dict | None:
    """Returns {size, content_type} if the object exists in B2, else None."""
    client = _client(cfg)
    try:
        head = client.head_object(Bucket=cfg.b2_bucket, Key=storage_key)
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise StorageError("Could not verify the uploaded file right now.") from e
    return {
        "size": head.get("ContentLength"),
        "content_type": head.get("ContentType"),
    }
