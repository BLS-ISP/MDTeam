#!/usr/bin/env python3
"""Shared helpers for MDTeam NethServer 8 secrets.env and local admin password sync."""

import hashlib
import json
import os
import secrets


VALID_SCRUM_ROLES = {
    "developer",
    "stakeholder",
    "scrum-master",
    "product-owner",
    "admin",
}


def sanitize_env_value(raw_val: object) -> str:
    """Strip CR/LF characters so Podman --env-file lines cannot be injected."""
    if raw_val is None:
        return ""
    return str(raw_val).replace("\r", "").replace("\n", "")


def read_secrets_env(secrets_path: str = "secrets.env") -> dict:
    """Parse an existing Podman --env-file into a key/value dict."""
    parsed = {}
    if not os.path.isfile(secrets_path):
        return parsed
    with open(secrets_path, "r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.rstrip("\r\n")
            if not line or line.lstrip().startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            parsed[key.strip()] = val
    return parsed


def write_secrets_env(entries: dict, secrets_path: str = "secrets.env") -> None:
    """Atomically write secrets.env with strict 0o600 owner-only permissions."""
    tmp_path = f"{secrets_path}.{secrets.token_hex(4)}.tmp"
    lines = [
        f"{key}={sanitize_env_value(val)}\n"
        for key, val in entries.items()
    ]
    fd = os.open(tmp_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
            fh.writelines(lines)
        os.chmod(tmp_path, 0o600)
        os.replace(tmp_path, secrets_path)
        os.chmod(secrets_path, 0o600)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def sync_admin_password_in_volume(plain_password: str) -> None:
    """Update local 'admin' scrypt hash in mdteam-data/users.json if already seeded."""
    if not plain_password or len(plain_password) < 6:
        return
    users_file = os.path.expanduser(
        "~/.local/share/containers/storage/volumes/mdteam-data/_data/users.json"
    )
    if not os.path.isfile(users_file):
        return
    try:
        with open(users_file, "r", encoding="utf-8") as fh:
            store = json.load(fh)
        users = store.get("users")
        if not isinstance(users, list):
            return
        updated = False
        for user in users:
            if isinstance(user, dict) and user.get("username") == "admin":
                salt = secrets.token_bytes(16)
                derived = hashlib.scrypt(
                    plain_password.encode("utf-8"),
                    salt=salt,
                    n=16384,
                    r=8,
                    p=1,
                    dklen=64,
                )
                user["passwordHash"] = derived.hex()
                user["passwordSalt"] = salt.hex()
                user["authProvider"] = "local"
                updated = True
                break
        if updated:
            tmp_users = f"{users_file}.{secrets.token_hex(4)}.tmp"
            with open(tmp_users, "w", encoding="utf-8", newline="\n") as fh:
                json.dump(store, fh, indent=2)
            os.chmod(tmp_users, 0o600)
            os.replace(tmp_users, users_file)
    except Exception:
        # Never block module configuration if volume storage layout differs
        pass
