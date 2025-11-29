from fastapi.testclient import TestClient
from app.main import app

def test_read_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_imports():
    from app.config import settings
    from app.db.mariadb import mariadb_manager
    from app.db.timescale import timescale_manager
    from app.db.redis import redis_manager
    from app.core.security import verify_password
    from app.api.v1.auth import router as auth_router
    from app.api.v1.market_data import router as market_data_router
    
    assert settings.APP_NAME == "TradeFlow Pro"
    assert mariadb_manager is not None
    assert timescale_manager is not None
    assert redis_manager is not None
