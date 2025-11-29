# Phase 2: Services Layer Walkthrough

## Overview
In this phase, we implemented the core service layer of the TradeFlow Pro backend. This includes services for technical indicators, order flow analysis, volume profiles, alerts, and real-time WebSocket communication.

## Accomplishments

### 1. Indicator Service
- **File:** `app/services/indicator_service.py`
- **Endpoints:** `app/api/v1/indicators.py`
- **Features:**
    - SMA (Simple Moving Average)
    - EMA (Exponential Moving Average)
    - RSI (Relative Strength Index)
    - MACD (Moving Average Convergence Divergence)
    - Bollinger Bands
    - ATR (Average True Range)
- **Implementation:** Uses `pandas` and `numpy` for efficient vectorised calculations.

### 2. Order Flow Service
- **File:** `app/services/orderflow_service.py`
- **Endpoints:** `app/api/v1/orderflow.py`
- **Features:**
    - **CVD (Cumulative Volume Delta):** Calculates buying vs selling pressure over time.
    - **Footprint Data:** Aggregates volume at price per bar (using Volume Profile data).
    - **Imbalance Detection:** Identifies diagonal imbalances in the order book/footprint.

### 3. Volume Profile Service
- **File:** `app/services/volume_profile_service.py`
- **Endpoints:** `app/api/v1/volume_profile.py`
- **Features:**
    - **Session Profile:** Aggregates volume at price for a specific time range.
    - **Key Levels:** Calculates Point of Control (POC), Value Area High (VAH), and Value Area Low (VAL).

### 4. Alert Service
- **File:** `app/services/alert_service.py`
- **Endpoints:** `app/api/v1/alerts.py`
- **Features:**
    - **CRUD Operations:** Create, read, delete alerts.
    - **Condition Checking:** Logic to check if price crosses a threshold.
    - **Database Integration:** Stores alerts in MariaDB.

### 5. WebSocket Service
- **File:** `app/services/websocket_service.py`
- **Endpoints:** `app/api/v1/websocket.py`
- **Features:**
    - **Connection Management:** Handles client connections and disconnections.
    - **Pub/Sub:** Allows clients to subscribe to specific symbols.
    - **Broadcasting:** Efficiently broadcasts updates to subscribed clients.

### 6. Market Data Service Enhancements
- **File:** `app/services/market_data_service.py`
- **Updates:**
    - Implemented `update_volume_profile` to populate the `volume_profile` table.
    - Implemented `broadcast_tick` to push real-time updates via WebSocket.
    - Added placeholder for `aggregate_to_higher_timeframes`.

## Verification
You can verify the services by running the backend and testing the endpoints using Swagger UI at `http://localhost:8001/docs`.

### Example Tests
1.  **Indicators:** POST `/api/v1/indicators/sma` with symbol and timeframe.
2.  **Order Flow:** POST `/api/v1/orderflow/cvd` to see delta.
3.  **WebSocket:** Connect to `ws://localhost:8001/api/v1/ws/stream` and send `{"action": "subscribe", "symbols": ["BTCUSD"]}`.

## Next Steps
- **Phase 3: Frontend Architecture:** Initialize the React project and start building the UI.
