"""Authentication and password reset services for the FastAPI backend."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
import threading
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import smtplib
import ssl
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field, ValidationError
from .models import TokenPayload

logger = logging.getLogger(__name__)


# ----------------------
# User persistence layer
# ----------------------


class AuthServiceError(Exception):
    """Base exception for authentication service errors."""


class UserAlreadyExistsError(AuthServiceError):
    """Raised when attempting to create a user that already exists."""


class UserNotFoundError(AuthServiceError):
    """Raised when a requested user cannot be found."""


class InvalidCredentialsError(AuthServiceError):
    """Raised when provided credentials are invalid."""


class UserInactiveError(AuthServiceError):
    """Raised when trying to authenticate an inactive user."""


class UserRecord(BaseModel):
    """Representation of a stored user account."""

    id: str
    username: str
    email: EmailStr
    password_hash: str
    created_at: datetime
    updated_at: datetime
    is_active: bool = Field(default=True)
    terms_accepted_at: Optional[datetime] = Field(default=None, description="When user accepted terms of use")


class AuthService:
    """Service responsible for user persistence and password hashing."""

    def __init__(self, storage_root: Optional[Path] = None) -> None:
        if storage_root:
            self.storage_root = storage_root
        else:
            # Check environment variable for data directory
            env_data_dir = os.getenv("EINK_DATA_DIR")
            if env_data_dir:
                self.storage_root = Path(env_data_dir) / "users"
            else:
                # Default to data/users relative to current working directory
                # When run as service from /root/eink/backend, this becomes /root/eink/backend/data/users
                # When run in Docker, this can be configured via environment variables
                self.storage_root = Path("data/users")
        self.storage_root.mkdir(parents=True, exist_ok=True)
        self._users_file = self.storage_root / "users.json"
        self._lock = threading.RLock()
        # Use bcrypt directly for better reliability and explicit control
        self._users: Dict[str, UserRecord] = {}
        self._load_users()

    def _load_users(self) -> None:
        if not self._users_file.exists():
            self._users = {}
            return
        try:
            raw = json.loads(self._users_file.read_text())
        except json.JSONDecodeError as exc:
            raise AuthServiceError(f"Failed to parse user store: {exc}") from exc
        users: Dict[str, UserRecord] = {}
        for user_id, payload in raw.items():
            try:
                users[user_id] = UserRecord.model_validate(payload)
            except ValidationError as exc:
                logger.error("Skipping invalid user record %s: %s", user_id, exc)
        self._users = users

    def _persist(self) -> None:
        snapshot = {user_id: record.model_dump(mode="json") for user_id, record in self._users.items()}
        self._users_file.write_text(json.dumps(snapshot, indent=2))

    def hash_password(self, password: str) -> str:
        # bcrypt has a 72-byte limit, fail fast with clear error message
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            raise AuthServiceError(
                f"Password is too long ({len(password_bytes)} bytes). "
                "Passwords must be 72 bytes or less when encoded as UTF-8."
            )
        # Use bcrypt directly with 12 rounds (good security/performance balance)
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

    def verify_password(self, password: str, password_hash: str) -> bool:
        try:
            password_bytes = password.encode('utf-8')
            hash_bytes = password_hash.encode('utf-8')
            return bcrypt.checkpw(password_bytes, hash_bytes)
        except (ValueError, UnicodeError):
            return False

    def register_user(self, username: str, email: EmailStr, password: str) -> UserRecord:
        with self._lock:
            cleaned_username = username.strip()
            if not cleaned_username:
                raise AuthServiceError("Username cannot be blank")
            existing = self.get_user_by_email(email)
            if existing is not None:
                raise UserAlreadyExistsError(f"User with email {email} already exists")
            if self.get_user_by_username(cleaned_username) is not None:
                raise UserAlreadyExistsError(f"Username {cleaned_username} already exists")
            if len(password) < 8:
                raise AuthServiceError("Password must be at least 8 characters long")
            user_id = secrets.token_hex(16)
            now = datetime.now(timezone.utc)
            record = UserRecord(
                id=user_id,
                username=cleaned_username,
                email=email,
                password_hash=self.hash_password(password),
                created_at=now,
                updated_at=now,
            )
            self._users[user_id] = record
            self._persist()
            return record

    def get_user_by_email(self, email: str) -> Optional[UserRecord]:
        normalized = email.strip().lower()
        for record in self._users.values():
            if record.email.lower() == normalized:
                return record
        return None

    def get_user_by_username(self, username: str) -> Optional[UserRecord]:
        normalized = username.strip().lower()
        for record in self._users.values():
            if record.username.lower() == normalized:
                return record
        return None

    def get_user_by_id(self, user_id: str) -> UserRecord:
        try:
            return self._users[user_id]
        except KeyError as exc:
            raise UserNotFoundError(f"User {user_id} not found") from exc

    def authenticate_user(self, username: str, password: str) -> UserRecord:
        user = self.get_user_by_username(username)
        if user is None:
            raise InvalidCredentialsError("Invalid username or password")
        if not user.is_active:
            raise UserInactiveError(f"User {username} is inactive")
        if not self.verify_password(password, user.password_hash):
            raise InvalidCredentialsError("Invalid username or password")
        return user

    def update_user_password(self, user_id: str, new_password: str) -> None:
        """Update a user's password."""
        with self._lock:
            if user_id not in self._users:
                raise UserNotFoundError(f"User {user_id} not found")

            if len(new_password) < 8:
                raise AuthServiceError("Password must be at least 8 characters long")

            # Check bcrypt length limit before hashing
            password_bytes = new_password.encode('utf-8')
            if len(password_bytes) > 72:
                raise AuthServiceError(
                    f"Password is too long ({len(password_bytes)} bytes). "
                    "Passwords must be 72 bytes or less when encoded as UTF-8."
                )

            # Update the password hash
            user = self._users[user_id]
            user.password_hash = self.hash_password(new_password)
            user.updated_at = datetime.now(timezone.utc)

            # Persist the changes
            self._persist()

    def accept_terms(self, user_id: str) -> UserRecord:
        """Mark that a user has accepted the terms of use."""
        with self._lock:
            if user_id not in self._users:
                raise UserNotFoundError(f"User {user_id} not found")

            user = self._users[user_id]
            user.terms_accepted_at = datetime.now(timezone.utc)
            user.updated_at = datetime.now(timezone.utc)

            # Persist the changes
            self._persist()

            return user


_auth_service_singleton: Optional[AuthService] = None
_auth_lock = threading.Lock()


def get_auth_service() -> AuthService:
    global _auth_service_singleton
    if _auth_service_singleton is not None:
        return _auth_service_singleton
    with _auth_lock:
        if _auth_service_singleton is None:
            _auth_service_singleton = AuthService()
        return _auth_service_singleton


# ----------------------
# Token management
# ----------------------


class TokenServiceError(Exception):
    """Base exception for token management failures."""


class InvalidTokenError(TokenServiceError):
    """Raised when a token is invalid or expired."""


class JWTService:
    """Handle JWT creation and validation for API authentication."""

    def __init__(
        self,
        secret_key: Optional[str] = None,
        algorithm: Optional[str] = None,
        access_token_ttl: Optional[timedelta] = None,
    ) -> None:
        env_secret = os.getenv("EINK_JWT_SECRET")
        derived_secret = secret_key or env_secret
        if not derived_secret:
            derived_secret = self._load_or_create_secret()
        self._secret_key = derived_secret
        env_algorithm = os.getenv("EINK_JWT_ALGORITHM", "HS256")
        self._algorithm = algorithm or env_algorithm
        env_ttl = os.getenv("EINK_JWT_EXPIRES_MINUTES")
        if access_token_ttl is not None:
            self._access_token_ttl = access_token_ttl
        elif env_ttl:
            try:
                self._access_token_ttl = timedelta(minutes=int(env_ttl))
            except ValueError as exc:
                raise TokenServiceError("EINK_JWT_EXPIRES_MINUTES must be an integer") from exc
        else:
            self._access_token_ttl = timedelta(days=30)

    def _load_or_create_secret(self) -> str:
        secret_file_env = os.getenv("EINK_JWT_SECRET_FILE")
        secret_path = Path(secret_file_env) if secret_file_env else Path("data/users/jwt_secret.txt")
        try:
            secret_path.parent.mkdir(parents=True, exist_ok=True)
            if secret_path.exists():
                existing = secret_path.read_text().strip()
                if existing:
                    return existing
            generated = secrets.token_urlsafe(64)
            secret_path.write_text(generated)
            return generated
        except OSError as exc:
            raise TokenServiceError(f"Unable to prepare JWT secret file: {exc}") from exc

    @property
    def secret_key(self) -> str:
        return self._secret_key

    @property
    def algorithm(self) -> str:
        return self._algorithm

    def create_access_token(self, subject: str, expires_delta: Optional[timedelta] = None) -> str:
        if not subject:
            raise TokenServiceError("Token subject cannot be empty")
        expire_at = datetime.now(timezone.utc) + (expires_delta or self._access_token_ttl)
        payload = {
            "sub": subject,
            "exp": int(expire_at.timestamp()),
        }
        try:
            return jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
        except Exception as exc:
            raise TokenServiceError(f"Failed to encode JWT: {exc}") from exc

    def decode_access_token(self, token: str) -> TokenPayload:
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
        except JWTError as exc:
            raise InvalidTokenError("Invalid or expired token") from exc
        sub = payload.get("sub")
        exp = payload.get("exp")
        if not sub or not exp:
            raise InvalidTokenError("Token payload missing required claims")
        return TokenPayload(sub=str(sub), exp=int(exp))

    def create_token_for_user(self, user: UserRecord) -> str:
        return self.create_access_token(user.id)


_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme = _oauth2_scheme
_jwt_service_singleton: Optional[JWTService] = None
_jwt_lock = threading.Lock()


def get_jwt_service() -> JWTService:
    global _jwt_service_singleton
    if _jwt_service_singleton is not None:
        return _jwt_service_singleton
    with _jwt_lock:
        if _jwt_service_singleton is None:
            _jwt_service_singleton = JWTService()
        return _jwt_service_singleton


def get_current_user(
    token: str = Depends(_oauth2_scheme),
) -> UserRecord:
    service = get_auth_service()
    jwt_service = get_jwt_service()
    try:
        payload = jwt_service.decode_access_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from exc
    try:
        user = service.get_user_by_id(payload.sub)
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from exc
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    return user


# ----------------------
# Email delivery
# ----------------------


class EmailServiceError(Exception):
    """Raised when email delivery cannot be completed."""


class EmailService:
    """Simple SMTP or file-backed email delivery service."""

    def __init__(
        self,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        from_address: Optional[str] = None,
        use_tls: Optional[bool] = None,
        output_dir: Optional[Path] = None,
    ) -> None:
        self.smtp_host = smtp_host or os.getenv("EINK_SMTP_HOST")
        port_env = os.getenv("EINK_SMTP_PORT")
        self.smtp_port = smtp_port or (int(port_env) if port_env else 587)
        self.smtp_username = smtp_username or os.getenv("EINK_SMTP_USERNAME")
        self.smtp_password = smtp_password or os.getenv("EINK_SMTP_PASSWORD")
        self.from_address = from_address or os.getenv("EINK_SMTP_FROM")
        use_tls_env = os.getenv("EINK_SMTP_USE_TLS", "true").lower()
        self.use_tls = use_tls if use_tls is not None else use_tls_env not in {"0", "false", "no"}
        dir_env = os.getenv("EINK_EMAIL_OUTPUT_DIR")
        self.output_dir = Path(output_dir) if output_dir else (Path(dir_env) if dir_env else None)
        if self.output_dir is not None:
            self.output_dir.mkdir(parents=True, exist_ok=True)

    def _build_message(self, to_address: EmailStr, subject: str, body: str) -> EmailMessage:
        message = EmailMessage()
        message["To"] = to_address
        if self.from_address:
            message["From"] = self.from_address
        message["Subject"] = subject
        message.set_content(body)
        return message

    def _deliver_via_smtp(self, message: EmailMessage) -> None:
        if not self.smtp_host or not self.from_address:
            raise EmailServiceError("SMTP configuration incomplete; set EINK_SMTP_* variables")
        context = ssl.create_default_context()
        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                if self.use_tls:
                    server.starttls(context=context)
                if self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                server.send_message(message)
        except (smtplib.SMTPException, OSError) as exc:
            raise EmailServiceError(f"SMTP delivery failed: {exc}") from exc

    def _deliver_to_file(self, message: EmailMessage) -> None:
        if self.output_dir is None:
            raise EmailServiceError("Email output directory is not configured")
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        slug = message["To"].replace("@", "_at_").replace("/", "_")
        target = self.output_dir / f"{timestamp}_{slug}.eml"
        target.write_text(message.as_string())

    def send_password_reset_email(self, to_address: EmailStr, reset_link: str, expires_at: datetime) -> None:
        if expires_at.tzinfo is None:
            raise EmailServiceError("expires_at must be timezone-aware")
        subject = "Reset your E-ink PDF account password"
        body = (
            "Hello,\n\n"
            "We received a request to reset the password for your E-ink PDF Templates account.\n"
            "If you made this request, click the link below to set a new password:\n\n"
            f"{reset_link}\n\n"
            f"This link will expire at {expires_at.isoformat()}.\n\n"
            "If you did not request a password reset, you can safely ignore this email."
        )
        message = self._build_message(to_address, subject, body)
        if self.smtp_host:
            self._deliver_via_smtp(message)
            return
        if self.output_dir is not None:
            self._deliver_to_file(message)
            return
        raise EmailServiceError(
            "Email delivery is not configured. Set SMTP variables or EINK_EMAIL_OUTPUT_DIR."
        )


# ----------------------
# Password reset tokens
# ----------------------


class PasswordResetServiceError(Exception):
    """Raised when password reset workflow fails."""


class PasswordResetTokenRecord(BaseModel):
    """Stored metadata for an issued password reset token."""

    token_hash: str
    user_id: str
    email: EmailStr
    created_at: datetime
    expires_at: datetime


class PasswordResetService:
    """Manages password reset tokens and password updates."""

    def __init__(
        self,
        auth_service: AuthService,
        email_service: EmailService,
        storage_root: Optional[Path] = None,
        token_ttl_minutes: Optional[int] = None,
        reset_base_url: Optional[str] = None,
    ) -> None:
        self._auth_service = auth_service
        self._email_service = email_service
        self.storage_root = storage_root or Path("data/users")
        self.storage_root.mkdir(parents=True, exist_ok=True)
        self._tokens_file = self.storage_root / "password_resets.json"
        ttl_env = os.getenv("EINK_PASSWORD_RESET_TTL_MINUTES")
        ttl_minutes = token_ttl_minutes if token_ttl_minutes is not None else int(ttl_env) if ttl_env else 60
        self._token_ttl = timedelta(minutes=ttl_minutes)
        self._reset_base_url = reset_base_url or os.getenv(
            "EINK_PASSWORD_RESET_URL", "http://localhost:5173/reset-password"
        )
        self._lock = threading.RLock()
        self._tokens: Dict[str, PasswordResetTokenRecord] = {}
        self._load_tokens()

    def _load_tokens(self) -> None:
        if not self._tokens_file.exists():
            self._tokens = {}
            return
        try:
            raw = json.loads(self._tokens_file.read_text())
        except json.JSONDecodeError as exc:
            raise PasswordResetServiceError(f"Failed to parse token store: {exc}") from exc
        tokens: Dict[str, PasswordResetTokenRecord] = {}
        for token_hash, payload in raw.items():
            try:
                tokens[token_hash] = PasswordResetTokenRecord.model_validate(payload)
            except ValidationError as exc:
                logger.error("Skipping invalid password reset token %s: %s", token_hash, exc)
        self._tokens = tokens

    def _persist(self) -> None:
        snapshot = {token_hash: record.model_dump(mode="json") for token_hash, record in self._tokens.items()}
        self._tokens_file.write_text(json.dumps(snapshot, indent=2))

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _purge_expired_tokens(self, now: datetime) -> None:
        expired = [token_hash for token_hash, record in self._tokens.items() if record.expires_at <= now]
        if expired:
            for token_hash in expired:
                del self._tokens[token_hash]
            self._persist()

    def _remove_tokens_for_user(self, user_id: str) -> None:
        stale = [token_hash for token_hash, record in self._tokens.items() if record.user_id == user_id]
        if stale:
            for token_hash in stale:
                del self._tokens[token_hash]
            self._persist()

    def _build_reset_link(self, token: str) -> str:
        parsed = urlparse(self._reset_base_url)
        query_params = dict(parse_qsl(parsed.query))
        query_params["token"] = token
        new_query = urlencode(query_params)
        return urlunparse(parsed._replace(query=new_query))

    @staticmethod
    def _validate_password(password: str) -> None:
        if len(password) < 8:
            raise PasswordResetServiceError("Password must be at least 8 characters long")
        if password.strip() == "":
            raise PasswordResetServiceError("Password cannot be blank")

    def initiate_reset(self, email: str) -> None:
        token_value: Optional[str] = None
        expires_at: Optional[datetime] = None
        recipient_email: Optional[str] = None
        with self._lock:
            now = datetime.now(timezone.utc)
            self._purge_expired_tokens(now)
            user = self._auth_service.get_user_by_email(email)
            if user is None or not user.is_active:
                logger.info("Password reset requested for unknown or inactive email %s", email)
                return
            self._remove_tokens_for_user(user.id)
            token_value = secrets.token_urlsafe(48)
            token_hash = self._hash_token(token_value)
            expires_at = now + self._token_ttl
            record = PasswordResetTokenRecord(
                token_hash=token_hash,
                user_id=user.id,
                email=user.email,
                created_at=now,
                expires_at=expires_at,
            )
            self._tokens[token_hash] = record
            self._persist()
            recipient_email = user.email
        if token_value is None or expires_at is None or recipient_email is None:
            return
        reset_link = self._build_reset_link(token_value)
        self._email_service.send_password_reset_email(recipient_email, reset_link, expires_at)

    def reset_password(self, token: str, new_password: str) -> None:
        token = token.strip()
        if not token:
            raise PasswordResetServiceError("Password reset token must be provided")
        self._validate_password(new_password)
        token_hash = self._hash_token(token)
        user_id: Optional[str] = None
        with self._lock:
            now = datetime.now(timezone.utc)
            self._purge_expired_tokens(now)
            record = self._tokens.get(token_hash)
            if record is None or record.expires_at <= now:
                if token_hash in self._tokens:
                    del self._tokens[token_hash]
                    self._persist()
                raise PasswordResetServiceError("Password reset token is invalid or has expired")
            user_id = record.user_id
            del self._tokens[token_hash]
            self._persist()
        if user_id is None:
            raise PasswordResetServiceError("Password reset token is invalid or has expired")
        try:
            self._auth_service.update_user_password(user_id, new_password)
        except AuthServiceError as exc:
            raise PasswordResetServiceError(str(exc)) from exc

