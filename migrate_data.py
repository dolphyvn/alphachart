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

async def init_db(conn):
    logger.info("Initializing Target Database Schema...")
    # Create table
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS market_data (
            time TIMESTAMPTZ NOT NULL,
            symbol VARCHAR(50) NOT NULL,
            timeframe VARCHAR(10) NOT NULL,
            open DOUBLE PRECISION NOT NULL,
            high DOUBLE PRECISION NOT NULL,
            low DOUBLE PRECISION NOT NULL,
            close DOUBLE PRECISION NOT NULL,
            volume DOUBLE PRECISION NOT NULL,
            bid_volume DOUBLE PRECISION,
            ask_volume DOUBLE PRECISION,
            number_of_trades INTEGER,
            open_interest DOUBLE PRECISION,
            source VARCHAR(100) DEFAULT 'sierra_chart',
            collected_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (time, symbol, timeframe)
        );
    """)
    
    # Convert to hypertable (ignore error if already exists)
    try:
        await conn.execute("""
            SELECT create_hypertable('market_data', 'time', 
                chunk_time_interval => INTERVAL '1 day',
                if_not_exists => TRUE
            );
        """)
    except Exception as e:
        logger.warning(f"Hypertable creation warning (might already exist): {e}")

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
        
        # Initialize Schema
        await init_db(target_conn)
        
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
