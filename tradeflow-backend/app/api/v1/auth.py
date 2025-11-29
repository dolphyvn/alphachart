from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta

from app.core.security import create_access_token, get_password_hash, verify_password
from app.config import settings
from app.db.mariadb import mariadb_manager
from app.db.models import User # We need to define models first!

router = APIRouter()

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/register", response_model=Token)
async def register(user: UserCreate, session: AsyncSession = Depends(mariadb_manager.get_session)):
    # Check if user exists
    result = await session.execute(select(User).where((User.email == user.email) | (User.username == user.username)))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered"
        )
    
    # Create new user
    db_user = User(
        email=user.email,
        username=user.username,
        password_hash=get_password_hash(user.password)
    )
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=db_user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session: AsyncSession = Depends(mariadb_manager.get_session)):
    # Find user
    result = await session.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
