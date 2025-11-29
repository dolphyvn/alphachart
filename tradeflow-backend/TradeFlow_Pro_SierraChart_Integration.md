# TradeFlow Pro Sierra Chart Integration Guide

## Overview

This document provides a complete guide for integrating Sierra Chart with TradeFlow Pro backend. The integration enables real-time and historical market data collection from Sierra Chart to be stored in the TradeFlow Pro system.

## Features

### ✅ What's Included

1. **Real-time Data Collection**: Sends new bars as they close
2. **Historical Data Export**: Bulk export of historical bars
3. **Batch Processing**: Efficient batch sending of multiple bars
4. **API Key Authentication**: Secure API key-based authentication
5. **Error Handling**: Robust retry logic and error tracking
6. **Multiple Timeframes**: Supports all Sierra Chart timeframes
7. **Bid/Ask Volume**: Includes bid/ask volume when available
8. **Comprehensive Logging**: Detailed logging for monitoring and debugging

### 🎯 Key Improvements Over Original

- **TradeFlow Format**: Uses TradeFlow Pro's JSON data format
- **API Compatibility**: Fully compatible with TradeFlow Pro backend endpoints
- **Optimized Batch Sizes**: Larger batch sizes (50-100 bars) for better performance
- **Enhanced Error Handling**: Better retry logic and state management
- **Real-time Validation**: Prevents duplicate data sending
- **Production Ready**: Includes API key authentication and proper timeouts

## Installation

### 1. Copy the Study Files

1. Copy `TradeFlow_Pro_Data_Collector.cpp` to your Sierra Chart study files
2. Copy `TradeFlow_Pro_Data_Collector.cpp` to your Sierra Chart installation directory
3. Compile the study using Sierra Chart's development environment

### 2. Configuration

The study includes the following configurable inputs:

- **API Endpoint**: TradeFlow Pro backend URL (default: `http://ns3366383.ip-37-187-77.eu:8001/api/v1/market-data`)
- **API Key**: TradeFlow Pro API key (default: `tradeflow-api-key-2024`)
- **Send Mode**: Real-time / Batch / Historical
- **Batch Size**: Number of bars per batch (default: 50)
- **Historical Bars**: Number of historical bars to export (default: 1000)
- **Request Timeout**: HTTP request timeout in seconds (default: 60)
- **Retry Limit**: Maximum retry attempts (default: 3)

### 3. Enable the Study

1. Open Sierra Chart
2. Add the "TradeFlow Pro Data Collector" study to your chart
3. Configure the inputs as needed
4. Enable the study by setting "Enable Data Collection" to Yes

## API Endpoints

### Single Bar Data (Real-time Mode)

```
POST /api/v1/market-data
Content-Type: application/json
X-API-Key: your-api-key

{
  "timestamp": "2025-11-29 23:45:00",
  "open": 4064.37,
  "high": 4065.20,
  "low": 4063.87,
  "close": 4064.75,
  "volume": 454.0,
  "bid_volume": 244.0,
  "ask_volume": 210.0,
  "number_of_trades": 1,
  "open_interest": null,
  "symbol": "XAUUSD",
  "timeframe": "1s",
  "source": "sierra_chart",
  "chart_number": 1,
  "collected_at": "2025-11-29T23:45:05Z"
}
```

### Batch Data (Historical Mode)

```
POST /api/v1/market-data/batch
Content-Type: application/json
X-API-Key: your-api-key

{
  "data": [
    {
      "timestamp": "2025-11-29 23:44:00",
      "open": 4064.37,
      "high": 4065.20,
      "low": 4063.87,
      "close": 4064.75,
      "volume": 454.0,
      // ... other fields
    }
    // ... more bars
  ],
  "metadata": {
    "source": "sierra_chart_historical",
    "collected_at": "2025-11-29T23:45:05Z",
    "total_bars": 100
  }
}
```

## Send Modes

### 1. Real-time Mode (Recommended for Live Trading)

- **Purpose**: Send new bars as they close
- **Use Case**: Live data feeding into TradeFlow Pro
- **Behavior**: Sends one bar at a time when a bar closes
- **Latency**: Minimal delay after bar close
- **Data Volume**: Low to moderate

**Configuration:**
- Set "Send Mode" to "Real-time"
- Enable "Enable Data Collection"
- Keep "Send Immediately" disabled unless testing

### 2. Batch Mode (For Periodic Updates)

- **Purpose**: Send groups of bars periodically
- **Use Case**: Periodic bulk updates
- **Behavior**: Sends configurable batch sizes when accumulated
- **Latency**: Delay until batch is full
- **Data Volume**: Moderate

**Configuration:**
- Set "Send Mode" to "Batch"
- Configure "Batch Size" (default: 50)
- Enable "Enable Data Collection"

### 3. Historical Mode (For Backfilling)

- **Purpose**: Export all historical data
- **Use Case**: Initial setup, backfilling historical data
- **Behavior**: Processes all bars from oldest to newest
- **Latency**: Slower due to large volume
- **Data Volume**: High

**Configuration:**
- Set "Send Mode" to "Historical"
- Configure "Historical Bars to Export" (default: 1000)
- Enable "Enable Data Collection"
- Can use "Manual Export Trigger" for immediate export

## Timeframe Support

The study automatically converts Sierra Chart timeframes to TradeFlow format:

| Sierra Chart (seconds) | TradeFlow Format | Notes |
|---------------------|------------------|-------|
| 1, 5, 10, 30 | "1s", "5s", "10s", "30s" | Second-level timeframes |
| 60, 300, 900, 1800 | "1m", "5m", "15m", "30m" | Minute-level timeframes |
| 3600, 14400 | "1h", "4h" | Hour-level timeframes |
| 86400 | "1D" | Daily timeframe |
| 604800 | "1W" | Weekly timeframe |

## Data Fields

### Core OHLCV Data
- `timestamp`: ISO timestamp string
- `open`: Opening price
- `high`: Highest price
- `low`: Lowest price
- `close`: Closing price
- `volume`: Volume

### Optional Market Data
- `bid_volume`: Bid volume (0.0 if not available)
- `ask_volume`: Ask volume (0.0 if not available)
- `number_of_trades`: Number of trades (0 if not available)
- `open_interest`: Open interest (null if not available)

### Chart Metadata
- `symbol`: Symbol name (e.g., "XAUUSD")
- `timeframe`: Timeframe in TradeFlow format
- `source`: Data source identifier
- `chart_number`: Sierra Chart number
- `collected_at`: Collection timestamp (ISO format)

## Error Handling

### Retry Logic

- **Default Retry Limit**: 3 attempts
- **Timeout Handling**: Configurable timeout (default: 60 seconds)
- **State Recovery**: Automatic recovery from stuck states
- **Failure Tracking**: Monitors failed attempts

### Logging

The study provides comprehensive logging:

```
TradeFlow Pro: Sending data to URL: http://api.example.com/market-data
TradeFlow Pro: JSON data: {"timestamp":"2025-11-29...", ...}
TradeFlow Pro: HTTP request result: 200
TradeFlow Pro: API Response: {"status":"success", ...}
```

### Error Recovery

- **Automatic Retries**: Failed requests are automatically retried
- **State Reset**: Stuck states are automatically detected and reset
- **Manual Override**: Force send option for testing and recovery
- **Batch Advancement**: Skips problematic batches in historical mode

## Monitoring and Debugging

### Study Status

The study displays its current status in the chart name:

- `TradeFlow Pro (Active)`: Enabled and ready
- `TradeFlow Pro (Sending...)`: Currently sending data
- `TradeFlow Pro (Sent: 1234)`: Total bars sent
- `TradeFlow Pro (Failed: 2)`: Number of failed attempts

### Subgraphs

- **Status**: Hidden subgraph for internal state tracking
- **Sent Count**: Line graph showing cumulative bars sent

### Log Messages

Check Sierra Chart Message Log for detailed information:

1. **Enable Message Log**: `Analysis → Message Log`
2. **Filter Messages**: Search for "TradeFlow Pro"
3. **Monitor Activity**: Watch for send/receive events

## Security Considerations

### API Key Authentication

The TradeFlow Pro API uses X-API-Key header authentication:

1. **Default Key**: `tradeflow-api-key-2024` (for development)
2. **Production**: Use a secure, unique API key
3. **Environment**: Store API key in environment variables

### Network Security

- **HTTPS Required**: Production environments require HTTPS
- **Firewall**: Ensure port 8001 is open for API access
- **Rate Limiting**: Backend includes rate limiting to prevent abuse

## Performance Considerations

### Batch Sizes

- **Real-time**: Single bar (minimal latency)
- **Batch Mode**: 50 bars (balanced performance)
- **Historical**: 100 bars (optimized for bulk transfer)

### Network Optimization

- **Compression**: JSON data is sent uncompressed
- **Connection Reuse**: Reuses HTTP connections when possible
- **Timeouts**: Configurable to prevent hanging

### Resource Usage

- **Memory**: Minimal memory footprint
- **CPU**: Low CPU usage during normal operation
- **Network**: Proportional to data volume

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check API endpoint URL
   - Verify TradeFlow backend is running
   - Confirm network connectivity

2. **Authentication Failed**
   - Verify API key is correct
   - Check X-API-Key header format
   - Confirm API key is active

3. **Timeout Errors**
   - Increase request timeout
   - Check network stability
   - Reduce batch size

4. **Missing Data**
   - Verify Sierra Chart data availability
   - Check bid/ask volume settings
   - Confirm timeframe compatibility

### Debug Mode

Enable detailed logging for troubleshooting:

1. Set "Send Immediately" to Yes for testing
2. Use small batch sizes for initial testing
3. Monitor Sierra Chart Message Log
4. Check TradeFlow backend logs

## Support

### Documentation
- TradeFlow Pro API documentation
- Sierra Chart development resources
- Network configuration guides

### Community
- TradeFlow Pro support channels
- Sierra Chart user communities
- Trading system integration forums

### Updates

This integration is actively maintained and updated to support:
- New API features
- Additional data fields
- Performance optimizations
- Security enhancements