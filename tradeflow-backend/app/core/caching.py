from functools import wraps
import json
from typing import Callable, Any
from app.db.redis import redis_manager
from app.config import settings

def cache_key(*args, **kwargs) -> str:
    """Generate a cache key from arguments"""
    key_parts = [str(arg) for arg in args]
    key_parts.extend([f"{k}={v}" for k, v in sorted(kwargs.items())])
    return ":".join(key_parts)

def cached(ttl: int = 60, prefix: str = ""):
    """Decorator to cache function results in Redis"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate key
            key = f"{prefix}:{cache_key(*args, **kwargs)}" if prefix else cache_key(*args, **kwargs)
            
            # Check cache
            cached_value = await redis_manager.get(key)
            if cached_value:
                return json.loads(cached_value)
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            await redis_manager.set(key, json.dumps(result), expire=ttl)
            
            return result
        return wrapper
    return decorator
