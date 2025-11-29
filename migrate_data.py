import asyncio
import aiomysql
import asyncpg
import logging
import os
from datetime import datetime
from typing import List, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Source Database Configuration (MariaDB on Host)
SOURCE_DB_CONFIG = {
    'unix_socket': '/var/run/mysqld/mysqld.sock',
    'user': 'root',
    'password': '1qaz@WSX123', # CAUTION: Hardcoded password. Use env vars in production.
    'db': 'market_data',
    'autocommit': True
}

# Target Database Configuration (TimescaleDB in Docker)
# Since we are running this script on the host, we access TimescaleDB via the mapped port (5433)
TARGET_DB_DSN = "postgresql://tradeflow:tradeflow@127.0.0.1:5433/market_data_db"

BATCH_SIZE = 5000

async def fetch_data_batch(pool, offset: int, limit: int) -> List[Tuple]:
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            query = f"""
                SELECT 
                    timestamp, symbol, seconds_per_bar, 
                    open, high, low, close, 
                    volume, bid_volume, ask_volume, 
                    number_of_trades, open_interest
                FROM market_data 
                ORDER BY id ASC 
                LIMIT {limit} OFFSET {offset}
            """
            await cur.execute(query)
            return await cur.fetchall()

async def insert_data_batch(conn, batch: List[Tuple]):
    # Transform data for TimescaleDB schema
    # Source: timestamp, symbol, seconds_per_bar, open, high, low, close, volume, bid_volume, ask_volume, number_of_trades, open_interest
    # Target: time, symbol, timeframe, open, high, low, close, volume, bid_volume, ask_volume, number_of_trades, open_interest
    
    transformed_data = []
    for row in batch:
        timestamp, symbol, seconds_per_bar, open_val, high, low, close, volume, bid_vol, ask_vol, num_trades, open_int = row
        
        # Convert seconds_per_bar to timeframe string (e.g., "60s")
        timeframe = f"{seconds_per_bar}s"
        
        transformed_data.append((
            timestamp, symbol, timeframe, 
            open_val, high, low, close, 
            volume, bid_vol, ask_vol, 
            num_trades, open_int
        ))

    query = """
        INSERT INTO market_data (
            time, symbol, timeframe, open, high, low, close,
            volume, bid_volume, ask_volume, number_of_trades, open_interest
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (time, symbol, timeframe) DO NOTHING
    """
    
    await conn.executemany(query, transformed_data)

async def migrate():
    logger.info("Starting migration...")
    
    # Connect to Source (MariaDB)
    try:
        source_pool = await aiomysql.create_pool(**SOURCE_DB_CONFIG)
        logger.info("Connected to Source Database (MariaDB)")
    except Exception as e:
        logger.error(f"Failed to connect to Source Database: {e}")
        return

    # Connect to Target (TimescaleDB)
    try:
        target_conn = await asyncpg.connect(TARGET_DB_DSN)
        logger.info("Connected to Target Database (TimescaleDB)")
    except Exception as e:
        logger.error(f"Failed to connect to Target Database: {e}")
        source_pool.close()
        await source_pool.wait_closed()
        return

    offset = 0
    total_migrated = 0
    
    try:
        while True:
            batch = await fetch_data_batch(source_pool, offset, BATCH_SIZE)
            if not batch:
                break
            
            await insert_data_batch(target_conn, batch)
            
            count = len(batch)
            total_migrated += count
            offset += count
            logger.info(f"Migrated {count} rows. Total: {total_migrated}")
            
    except Exception as e:
        logger.error(f"Error during migration: {e}")
    finally:
        source_pool.close()
        await source_pool.wait_closed()
        await target_conn.close()
        logger.info("Migration finished.")

if __name__ == "__main__":
    asyncio.run(migrate())
