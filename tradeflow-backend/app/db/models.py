from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey, Enum, DECIMAL
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class SubscriptionTier(str, enum.Enum):
    FREE = 'free'
    ESSENTIAL = 'essential'
    PLUS = 'plus'
    PREMIUM = 'premium'
    PRO = 'pro'

class AssetType(str, enum.Enum):
    FOREX = 'forex'
    CRYPTO = 'crypto'
    STOCKS = 'stocks'
    FUTURES = 'futures'
    COMMODITIES = 'commodities'

class AlertType(str, enum.Enum):
    PRICE = 'price'
    INDICATOR = 'indicator'
    PATTERN = 'pattern'
    ORDERFLOW = 'orderflow'

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.FREE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    preferences = Column(JSON, nullable=True)

    workspaces = relationship("Workspace", back_populates="user", cascade="all, delete-orphan")
    saved_charts = relationship("SavedChart", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")

class Symbol(Base):
    __tablename__ = "symbols"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    name = Column(String(255))
    exchange = Column(String(50))
    asset_type = Column(Enum(AssetType), nullable=False)
    tick_size = Column(DECIMAL(20, 8))
    is_active = Column(Boolean, default=True)

    saved_charts = relationship("SavedChart", back_populates="symbol_rel")
    alerts = relationship("Alert", back_populates="symbol_rel")

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    layout_config = Column(JSON, nullable=False)
    is_default = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="workspaces")

class SavedChart(Base):
    __tablename__ = "saved_charts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol_id = Column(Integer, ForeignKey("symbols.id"), nullable=False)
    timeframe = Column(String(10), nullable=False)
    chart_config = Column(JSON, nullable=False)
    indicators = Column(JSON)
    drawings = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="saved_charts")
    symbol_rel = relationship("Symbol", back_populates="saved_charts")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol_id = Column(Integer, ForeignKey("symbols.id"), nullable=False)
    alert_type = Column(Enum(AlertType), nullable=False)
    condition_config = Column(JSON, nullable=False)
    notification_channels = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="alerts")
    symbol_rel = relationship("Symbol", back_populates="alerts")
