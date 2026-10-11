"""Authentication & authorization primitives.

Password hashing, JWT issuing/validation and FastAPI dependencies used to
guard routes. Nothing here contains hard-coded secrets.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models
from .config import settings
from .database import get_db

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Minimum allowed password length for registration and password changes.
MIN_PASSWORD_LENGTH = 8


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    to_encode.update(
        {
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        }
    )
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: Optional[str] = payload.get("sub")
        if not username:
            raise _credentials_exception()
    except HTTPException:
        raise
    except Exception:
        raise _credentials_exception()

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise _credentials_exception()
    return user


def require_manager(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can perform this action.")
    return current_user


def require_driver(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Only Drivers can perform this action.")
    return current_user


def get_current_driver(
    current_user: models.User = Depends(require_driver),
    db: Session = Depends(get_db),
) -> models.Driver:
    driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    return driver
