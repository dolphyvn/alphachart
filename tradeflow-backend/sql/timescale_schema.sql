-- Connect to the database (assumes it exists or run this in the DB)
-- CREATE DATABASE market_data_db;
-- \c market_data_db;

-- Install TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Market data table (OHLCV + Order Flow)
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

-- Convert to hypertable (TimescaleDB magic!)
SELECT create_hypertable('market_data', 'time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Enable compression (saves 90%+ storage)
ALTER TABLE market_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol,timeframe',
    timescaledb.compress_orderby = 'time DESC'
);

-- Auto-compress data older than 7 days
SELECT add_compression_policy('market_data', INTERVAL '7 days');

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_time ON market_data (symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_timeframe ON market_data (timeframe, time DESC);

-- Continuous aggregates (pre-computed timeframes)
CREATE MATERIALIZED VIEW market_data_1min
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 minute', time) AS bucket,
    symbol,
    FIRST(open, time) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, time) AS close,
    SUM(volume) AS volume,
    SUM(bid_volume) AS bid_volume,
    SUM(ask_volume) AS ask_volume,
    SUM(number_of_trades) AS number_of_trades,
    LAST(open_interest, time) AS open_interest
FROM market_data
WHERE timeframe = '1s'
GROUP BY bucket, symbol;

-- Auto-refresh policy
SELECT add_continuous_aggregate_policy('market_data_1min',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

-- Volume Profile table
CREATE TABLE IF NOT EXISTS volume_profile (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    session_start TIMESTAMPTZ NOT NULL,
    price_level DOUBLE PRECISION NOT NULL,
    volume DOUBLE PRECISION NOT NULL,
    bid_volume DOUBLE PRECISION,
    ask_volume DOUBLE PRECISION,
    PRIMARY KEY (time, symbol, session_start, price_level)
);

SELECT create_hypertable('volume_profile', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Market Profile (TPO) table
CREATE TABLE IF NOT EXISTS market_profile (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    session_start TIMESTAMPTZ NOT NULL,
    price_level DOUBLE PRECISION NOT NULL,
    tpo_count INTEGER NOT NULL,
    tpo_letters VARCHAR(100),
    PRIMARY KEY (time, symbol, session_start, price_level)
);

SELECT create_hypertable('market_profile', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Retention policies
SELECT add_retention_policy('market_data', INTERVAL '2 years');
SELECT add_retention_policy('volume_profile', INTERVAL '6 months');
