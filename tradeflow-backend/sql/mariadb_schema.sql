CREATE DATABASE IF NOT EXISTS tradeflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tradeflow_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    subscription_tier ENUM('free', 'essential', 'plus', 'premium', 'pro') DEFAULT 'free',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    preferences JSON,
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB;

-- Symbols table
CREATE TABLE IF NOT EXISTS symbols (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    exchange VARCHAR(50),
    asset_type ENUM('forex', 'crypto', 'stocks', 'futures', 'commodities') NOT NULL,
    tick_size DECIMAL(20,8),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE KEY unique_symbol_exchange (symbol, exchange),
    INDEX idx_symbol (symbol),
    INDEX idx_type (asset_type, is_active)
) ENGINE=InnoDB;

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    layout_config JSON NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_workspaces (user_id, created_at DESC)
) ENGINE=InnoDB;

-- Saved charts table
CREATE TABLE IF NOT EXISTS saved_charts (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    symbol_id INT UNSIGNED NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    chart_config JSON NOT NULL,
    indicators JSON,
    drawings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id),
    INDEX idx_user_charts (user_id, created_at DESC)
) ENGINE=InnoDB;

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    symbol_id INT UNSIGNED NOT NULL,
    alert_type ENUM('price', 'indicator', 'pattern', 'orderflow') NOT NULL,
    condition_config JSON NOT NULL,
    notification_channels JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id),
    INDEX idx_user_active_alerts (user_id, is_active),
    INDEX idx_symbol_alerts (symbol_id, is_active)
) ENGINE=InnoDB;
