// The top of every source code file must include this line
#include "sierrachart.h"

// TradeFlow Pro Data Collector for Sierra Chart
// Sends real-time and historical market data to TradeFlow Pro backend
SCDLLName("TradeFlow Pro Data Collector")

// Data collection state structure
struct s_DataCollectionState
{
    int RequestState = 0;  // 0 = idle, 1 = request made, 2 = response received
    SCDateTime LastBarDateTime;
    int LastSentIndex = -1;
    SCString LastAPIResponse;
    int FailedRequests = 0;
    int TotalBarsSent = 0;
    int HistoricalExportIndex = 0;  // Track progress of historical export
    bool HistoricalExportTriggered = false;
    SCDateTime LastExportTime;     // Track time for periodic exports
    bool ManualExportTriggered = false;  // Manual trigger flag

    void Reset()
    {
        RequestState = 0;
        LastBarDateTime.Clear();
        LastSentIndex = -1;
        LastAPIResponse.Clear();
        FailedRequests = 0;
        TotalBarsSent = 0;
        HistoricalExportIndex = 0;
        HistoricalExportTriggered = false;
        LastExportTime.Clear();
        ManualExportTriggered = false;
    }
};

// Function to create JSON string for single bar data (TradeFlow format)
SCString CreateTradeFlowBarJSON(SCStudyInterfaceRef sc, int Index)
{
    SCString json;
    json += "{";

    // Timestamp (ISO format for TradeFlow)
    json += "\"timestamp\":\"";
    json += sc.FormatDateTime(sc.BaseDateTimeIn[Index]).GetChars();
    json += "\",";

    // Basic OHLCV data
    json += "\"open\":";
    json += SCString().Format("%f", sc.BaseDataIn[SC_OPEN][Index]);
    json += ",";

    json += "\"high\":";
    json += SCString().Format("%f", sc.BaseDataIn[SC_HIGH][Index]);
    json += ",";

    json += "\"low\":";
    json += SCString().Format("%f", sc.BaseDataIn[SC_LOW][Index]);
    json += ",";

    json += "\"close\":";
    json += SCString().Format("%f", sc.BaseDataIn[SC_LAST][Index]);
    json += ",";

    json += "\"volume\":";
    json += SCString().Format("%.0f", sc.BaseDataIn[SC_VOLUME][Index]);
    json += ",";

    // Bid/Ask volume data - check if arrays are populated
    bool hasBidVolume = sc.BaseDataIn[SC_BIDVOL].GetArraySize() > 0 && sc.BaseDataIn[SC_BIDVOL][Index] != 0;
    bool hasAskVolume = sc.BaseDataIn[SC_ASKVOL].GetArraySize() > 0 && sc.BaseDataIn[SC_ASKVOL][Index] != 0;

    if (hasBidVolume)
    {
        json += "\"bid_volume\":";
        json += SCString().Format("%.0f", sc.BaseDataIn[SC_BIDVOL][Index]);
        json += ",";
    }
    else
    {
        json += "\"bid_volume\":0.0,";
    }

    if (hasAskVolume)
    {
        json += "\"ask_volume\":";
        json += SCString().Format("%.0f", sc.BaseDataIn[SC_ASKVOL][Index]);
        json += ",";
    }
    else
    {
        json += "\"ask_volume\":0.0,";
    }

    // Number of trades if available
    if (sc.NumberOfTrades.GetArraySize() > 0 && sc.NumberOfTrades[Index] != 0)
    {
        json += "\"number_of_trades\":";
        json += SCString().Format("%d", sc.NumberOfTrades[Index]);
        json += ",";
    }
    else
    {
        json += "\"number_of_trades\":0,";
    }

    // Open interest if available
    if (sc.BaseDataIn[SC_OPEN_INTEREST].GetArraySize() > 0 && sc.BaseDataIn[SC_OPEN_INTEREST][Index] != 0)
    {
        json += "\"open_interest\":";
        json += SCString().Format("%.0f", sc.BaseDataIn[SC_OPEN_INTEREST][Index]);
        json += ",";
    }
    else
    {
        json += "\"open_interest\":null,";
    }

    // Chart info (Nested object to match Pydantic model)
    json += "\"chart_info\":{";
    
    json += "\"symbol\":\"";
    json += sc.Symbol.GetChars();
    json += "\",";

    json += "\"chart_number\":";
    json += SCString().Format("%d", sc.ChartNumber);
    json += ",";

    json += "\"seconds_per_bar\":";
    json += SCString().Format("%d", sc.SecondsPerBar);
    
    json += "}"; // End chart_info

    // Data source metadata (Root level)
    json += ",\"source\":\"sierra_chart\"";
    json += ",\"collected_at\":\"";
    json += sc.FormatDateTime(sc.CurrentSystemDateTime).GetChars();
    json += "\"";

    json += "}";
    return json;
}

// Function to create JSON array for multiple bars (TradeFlow batch format)
SCString CreateTradeFlowBatchJSON(SCStudyInterfaceRef sc, int StartIndex, int EndIndex, const char* DataSource = "sierra_chart_historical")
{
    SCString json;
    json += "{\"data\":[";

    for (int i = StartIndex; i <= EndIndex; i++)
    {
        if (i > StartIndex)
            json += ",";
        json += CreateTradeFlowBarJSON(sc, i);
    }

    json += "],";
    json += "\"metadata\":{";
    json += "\"source\":\"";
    json += DataSource;
    json += "\",";
    json += "\"collected_at\":\"";
    json += sc.FormatDateTime(sc.CurrentSystemDateTime).GetChars();
    json += "\",";
    json += "\"total_bars\":";
    json += SCString().Format("%d", (EndIndex - StartIndex + 1));
    json += "\"}}";

    return json;
}

/*============================================================================
    Main TradeFlow Pro Data Collector Study Function
----------------------------------------------------------------------------*/
SCSFExport scsf_TradeFlowProDataCollector(SCStudyInterfaceRef sc)
{

    // Input references
    SCInputRef Input_APIEndpoint = sc.Input[0];
    SCInputRef Input_Enabled = sc.Input[1];
    SCInputRef Input_SendMode = sc.Input[2];  // 0 = real-time, 1 = batch, 2 = historical
    SCInputRef Input_BatchSize = sc.Input[3];
    SCInputRef Input_APIKey = sc.Input[4];
    SCInputRef Input_IncludeBidAsk = sc.Input[5];
    SCInputRef Input_RetryLimit = sc.Input[6];
    SCInputRef Input_RequestTimeout = sc.Input[7];
    SCInputRef Input_SendImmediately = sc.Input[8];
    SCInputRef Input_HistoricalBarsCount = sc.Input[9];
    SCInputRef Input_ManualExportTrigger = sc.Input[10];

    // Subgraph references
    SCSubgraphRef Subgraph_Status = sc.Subgraph[0];
    SCSubgraphRef Subgraph_SentCount = sc.Subgraph[1];

    // Get custom study state
    s_DataCollectionState* p_State = (s_DataCollectionState*)sc.GetPersistentPointer(0);

    // Set configuration and defaults
    if (sc.SetDefaults)
    {
        sc.GraphName = "TradeFlow Pro Data Collector";
        sc.StudyDescription = "Collects chart data and sends it to TradeFlow Pro backend API";
        sc.GraphRegion = 0;  // Display in main chart region
        sc.ValueFormat = VALUEFORMAT_INHERITED;
        sc.AutoLoop = 1;  // Enable automatic looping
        sc.FreeDLL = 0;   // Keep DLL loaded
        sc.ScaleRangeType = SCALE_INDEPENDENT; // Prevent chart squeezing

        // Default inputs
        Input_APIEndpoint.Name = "TradeFlow API Endpoint";
        Input_APIEndpoint.SetString("http://ns3366383.ip-37-187-77.eu:8001/api/v1/market-data/");

        Input_Enabled.Name = "Enable Data Collection";
        Input_Enabled.SetYesNo(0);  // Disabled by default

        Input_SendMode.Name = "Send Mode";
        Input_SendMode.SetCustomInputIndex(0);
        Input_SendMode.SetCustomInputStrings("Real-time;Batch;Historical");

        Input_BatchSize.Name = "Batch Size";
        Input_BatchSize.SetInt(50);  // TradeFlow optimized batch size
        Input_BatchSize.SetIntLimits(10, 200);

        Input_APIKey.Name = "API Key (optional)";
        Input_APIKey.SetString("tradeflow-api-key-2024");

        Input_IncludeBidAsk.Name = "Include Bid/Ask Volume";
        Input_IncludeBidAsk.SetYesNo(1);

        Input_RetryLimit.Name = "Retry Limit";
        Input_RetryLimit.SetInt(3);
        Input_RetryLimit.SetIntLimits(0, 10);

        Input_RequestTimeout.Name = "Request Timeout (seconds)";
        Input_RequestTimeout.SetInt(60);
        Input_RequestTimeout.SetIntLimits(10, 300);

        Input_SendImmediately.Name = "Send Immediately (Test Mode)";
        Input_SendImmediately.SetYesNo(0);  // Disabled by default

        Input_HistoricalBarsCount.Name = "Historical Bars to Export";
        Input_HistoricalBarsCount.SetInt(1000);  // Larger default for TradeFlow
        Input_HistoricalBarsCount.SetIntLimits(100, 10000);

        Input_ManualExportTrigger.Name = "Manual Export Trigger";
        Input_ManualExportTrigger.SetYesNo(0);  // Disabled by default

        // Subgraph configuration
        Subgraph_Status.Name = "Status";
        Subgraph_Status.DrawStyle = DRAWSTYLE_HIDDEN;
        Subgraph_Status.PrimaryColor = RGB(0, 255, 0);

        Subgraph_SentCount.Name = "Sent Count";
        Subgraph_SentCount.DrawStyle = DRAWSTYLE_LINE;
        Subgraph_SentCount.LineWidth = 2;
        Subgraph_SentCount.PrimaryColor = RGB(0, 100, 255);

        return;
    }

    // Initialize state on first run
    if (p_State == nullptr)
    {
        p_State = new s_DataCollectionState();
        sc.SetPersistentPointer(0, p_State);

        // Initialize to current most recent bar to prevent sending historical data
        if (sc.ArraySize > 0)
        {
            p_State->LastSentIndex = sc.ArraySize - 1;  // Start with the most recent bar
            p_State->LastBarDateTime = sc.BaseDateTimeIn[sc.ArraySize - 1];  // Set to most recent bar time
            sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Initialized - LastSentIndex set to %d (most recent bar)",
                p_State->LastSentIndex), 0);
        }
    }

    // Handle mode switching - reset conflicting state variables
    int CurrentSendMode = Input_SendMode.GetIndex();

    if (CurrentSendMode == 0)  // Real-time mode
    {
        // Force cleanup of ALL historical mode state when switching to real-time
        if (p_State->HistoricalExportTriggered || p_State->ManualExportTriggered || p_State->HistoricalExportIndex != 0)
        {
            sc.AddMessageToLog("TradeFlow Pro: MODE SWITCH to Real-time - Clearing ALL Historical state", 0);
            p_State->HistoricalExportTriggered = false;
            p_State->ManualExportTriggered = false;
            p_State->HistoricalExportIndex = 0;
            p_State->LastExportTime.Clear();

            // Re-initialize real-time tracking to prevent sending historical data
            if (sc.ArraySize > 0)
            {
                p_State->LastSentIndex = sc.ArraySize - 1;  // Reset to most recent bar
                p_State->LastBarDateTime = sc.BaseDateTimeIn[sc.ArraySize - 1];
                sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Real-time mode reset - LastSentIndex: %d", p_State->LastSentIndex), 0);
            }
        }
    }
    else if (CurrentSendMode == 2)  // Historical mode
    {
        // Reset real-time state when switching to Historical mode
        if (p_State->LastSentIndex != -1)
        {
            sc.AddMessageToLog("TradeFlow Pro: MODE SWITCH to Historical - Clearing Real-time state", 0);
            p_State->LastSentIndex = -1;
            p_State->LastBarDateTime.Clear();
        }
    }

    // Reset state if study is disabled
    if (!Input_Enabled.GetYesNo())
    {
        if (sc.HTTPRequestID != 0 || p_State->RequestState != 0)
        {
            sc.HTTPRequestID = 0;
            p_State->RequestState = 0;
            sc.AddMessageToLog("TradeFlow Pro: Disabled - cleared HTTP request state", 0);
        }

        if (p_State->RequestState != 0)
        {
            sc.AddMessageToLog("TradeFlow Pro: Disabled - stopping data collection", 1);
            p_State->Reset();
        }

        Subgraph_Status[sc.Index] = 0;  // Status = disabled
        return;
    }

    // Check for HTTP response
    if (p_State->RequestState == 1)
    {
        if (sc.HTTPRequestID != 0)
        {
            p_State->RequestState = 2;  // Response received
            p_State->LastAPIResponse = sc.HTTPResponse;

            // Log response
            if (sc.HTTPResponse.GetLength() > 0)
            {
                sc.AddMessageToLog(SCString().Format("TradeFlow Pro: API Response: %s", sc.HTTPResponse.GetChars()), 0);
                p_State->FailedRequests = 0;

                // Move historical export index FORWARD if in historical mode
                if (Input_SendMode.GetIndex() == 2 && (p_State->HistoricalExportTriggered || p_State->ManualExportTriggered))
                {
                    int BatchSize = 100;  // TradeFlow optimized batch size
                    int NextIndex = p_State->HistoricalExportIndex + BatchSize;

                    sc.AddMessageToLog(SCString().Format("TradeFlow Pro: BATCH ADVANCEMENT - Current: %d, Next: %d, Total Sent: %d, Target: %d",
                        p_State->HistoricalExportIndex, NextIndex, p_State->TotalBarsSent, Input_HistoricalBarsCount.GetInt()), 0);

                    // Check if we are done
                    if (NextIndex < sc.ArraySize && p_State->TotalBarsSent < Input_HistoricalBarsCount.GetInt())
                    {
                        p_State->HistoricalExportIndex = NextIndex;
                        sc.AddMessageToLog(SCString().Format("TradeFlow Pro: INDEX MOVED FORWARD to %d", p_State->HistoricalExportIndex), 0);
                    }
                    else
                    {
                        sc.AddMessageToLog("TradeFlow Pro: EXPORT COMPLETE", 0);
                        p_State->HistoricalExportTriggered = false;
                        p_State->ManualExportTriggered = false;
                        p_State->HistoricalExportIndex = 0;
                    }
                }
            }
            else
            {
                p_State->FailedRequests++;
                sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Empty API response. Failed attempts: %d", p_State->FailedRequests), 1);
            }

            sc.HTTPRequestID = 0;  // Reset request ID
        }
        else
        {
            // Request timed out or failed
            p_State->RequestState = 0;
            p_State->FailedRequests++;
            sc.AddMessageToLog(SCString().Format("TradeFlow Pro: HTTP request timed out. Failed attempts: %d", p_State->FailedRequests), 1);
        }
    }
    else if (p_State->RequestState == 2)
    {
        // Reset state if we've been stuck in response state
        sc.AddMessageToLog("TradeFlow Pro: Resetting stuck request state", 1);
        p_State->RequestState = 0;
        sc.HTTPRequestID = 0;
    }

    // Data collection logic
    Subgraph_Status[sc.Index] = 1;  // Status = active

    // Determine send mode and logic
    int SendMode = Input_SendMode.GetIndex();

    if (SendMode == 0)  // Real-time mode - send new bars only
    {
        bool NewBar = false;
        bool ForceSend = Input_SendImmediately.GetYesNo();
        int BarStatus = sc.GetBarHasClosedStatus();

        // Enhanced debugging
        sc.AddMessageToLog(SCString().Format("TradeFlow Pro: REAL-TIME MODE DEBUG - Index: %d, BarStatus: %d, LastSent: %d, HistoricalTrigger: %d, ManualTrigger: %d, Force: %d",
            sc.Index, BarStatus, p_State->LastSentIndex, p_State->HistoricalExportTriggered, p_State->ManualExportTriggered, ForceSend), 1);

        if (ForceSend)
        {
            // Force send for testing - but only if we haven't sent this bar already
            if (p_State->LastSentIndex != sc.Index)
            {
                NewBar = true;
                sc.AddMessageToLog("TradeFlow Pro: Force sending current bar for testing", 0);
            }
        }
        else
        {
            // Normal real-time mode - send when a bar closes
            SCDateTime CurrentBarTime = sc.BaseDateTimeIn[sc.Index];

            // Send the bar that just closed (previous index)
            int MostRecentIndex = sc.ArraySize - 1;
            int PreviouslyClosedIndex = MostRecentIndex - 1;

            // When we're on the current most recent bar and need to send the bar that just closed
            if (sc.Index == MostRecentIndex &&
                PreviouslyClosedIndex >= 0 &&
                p_State->LastSentIndex < PreviouslyClosedIndex)
            {
                // Send the bar that just closed
                sc.Index = PreviouslyClosedIndex;
                NewBar = true;
                p_State->LastBarDateTime = sc.BaseDateTimeIn[PreviouslyClosedIndex];
                p_State->LastSentIndex = PreviouslyClosedIndex;

                sc.AddMessageToLog(SCString().Format("TradeFlow Pro: SENDING just-closed bar at index %d, time: %s (current bar: %d)",
                    PreviouslyClosedIndex, sc.FormatDateTime(p_State->LastBarDateTime).GetChars(), MostRecentIndex), 0);
            }
            else if (BarStatus == BHCS_BAR_HAS_CLOSED &&
                     sc.Index < MostRecentIndex &&
                     p_State->LastSentIndex < sc.Index)
            {
                // Send when we're on the bar that just closed
                NewBar = true;
                p_State->LastBarDateTime = CurrentBarTime;
                p_State->LastSentIndex = sc.Index;

                sc.AddMessageToLog(SCString().Format("TradeFlow Pro: SENDING closed bar at index %d, time: %s",
                    sc.Index, sc.FormatDateTime(CurrentBarTime).GetChars()), 0);
            }
        }

        // Send data if we have a new bar and no pending request
        if (NewBar && p_State->RequestState == 0)
        {
            SCString jsonData = CreateTradeFlowBarJSON(sc, sc.Index);
            SCString apiURL = Input_APIEndpoint.GetString();
            SCString apiKey = Input_APIKey.GetString();

            // Prepare headers
            n_ACSIL::s_HTTPHeader headers[2];
            int numHeaders = 0;

            if (apiKey.GetLength() > 0)
            {
                headers[0].Name = "X-API-Key";
                headers[0].Value = apiKey;
                numHeaders++;
            }

            headers[numHeaders].Name = "Content-Type";
            headers[numHeaders].Value = "application/json";
            numHeaders++;

            sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Sending data to URL: %s", apiURL.GetChars()), 0);
            sc.AddMessageToLog(SCString().Format("TradeFlow Pro: JSON data: %s", jsonData.GetChars()), 1);

            // Make HTTP POST request to TradeFlow single bar endpoint
            int result = sc.MakeHTTPPOSTRequest(apiURL, jsonData, headers, numHeaders);

            sc.AddMessageToLog(SCString().Format("TradeFlow Pro: HTTP request result: %d", result), 0);

            if (result > 0)
            {
                p_State->RequestState = 1;  // Request made
                p_State->TotalBarsSent++;
                sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Sent bar %d. Total bars sent: %d", sc.Index, p_State->TotalBarsSent), 0);
            }
            else
            {
                p_State->FailedRequests++;
                sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Failed to send data. Error code: %d", result), 1);
                // Reset the tracking on failure so we can retry this bar later
                if (ForceSend)
                {
                    p_State->LastSentIndex = -1;
                }
            }
        }
    }
    else if (SendMode == 1)  // Batch mode - send multiple bars at once
    {
        if (p_State->RequestState == 0)  // No pending request
        {
            int BatchSize = Input_BatchSize.GetInt();
            int StartIndex = max(0, sc.Index - BatchSize + 1);

            // Send batch if we have enough new bars
            if (sc.Index - p_State->LastSentIndex >= BatchSize)
            {
                SCString jsonData = CreateTradeFlowBatchJSON(sc, StartIndex, sc.Index, "sierra_chart_batch");
                SCString apiURL = Input_APIEndpoint.GetString();
                SCString apiKey = Input_APIKey.GetString();

                // Add batch to the URL for TradeFlow batch endpoint
                // Remove trailing slash to avoid double slash
                SCString baseURL = Input_APIEndpoint.GetString();
                if (baseURL.GetLength() > 0 && baseURL[baseURL.GetLength() - 1] == '/') {
                    baseURL = baseURL.Left(baseURL.GetLength() - 1);
                }
                apiURL = baseURL + "/batch";

                // Prepare headers
                n_ACSIL::s_HTTPHeader headers[2];
                int numHeaders = 0;

                if (apiKey.GetLength() > 0)
                {
                    headers[0].Name = "X-API-Key";
                    headers[0].Value = apiKey;
                    numHeaders++;
                }

                headers[numHeaders].Name = "Content-Type";
                headers[numHeaders].Value = "application/json";
                numHeaders++;

                // Make HTTP POST request
                int result = sc.MakeHTTPPOSTRequest(apiURL, jsonData, headers, numHeaders);

                if (result > 0)
                {
                    p_State->RequestState = 1;  // Request made
                    p_State->LastSentIndex = sc.Index;
                    p_State->TotalBarsSent += (sc.Index - StartIndex + 1);
                    sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Sent batch of %d bars. Total bars sent: %d",
                        (sc.Index - StartIndex + 1), p_State->TotalBarsSent), 0);
                }
                else
                {
                    p_State->FailedRequests++;
                    sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Failed to send batch data. Error code: %d", result), 1);
                }
            }
        }
    }
    else if (SendMode == 2)  // Historical mode - export historical data
    {
        int HistoricalBarsCount = Input_HistoricalBarsCount.GetInt();
        bool ManualTrigger = Input_ManualExportTrigger.GetYesNo();

        // Check for manual trigger or auto-trigger
        bool ShouldTrigger = false;

        // Auto-advance if stuck with too many failures
        if (p_State->FailedRequests > 5 && (p_State->HistoricalExportTriggered || p_State->ManualExportTriggered))
        {
            int OldIndex = p_State->HistoricalExportIndex;
            p_State->HistoricalExportIndex = min(sc.ArraySize - 1, OldIndex + 100);  // Skip forward
            p_State->FailedRequests = 0;
            p_State->RequestState = 0;
            sc.AddMessageToLog(SCString().Format("TradeFlow Pro: AUTO-ADVANCE - Forced to next batch %d -> %d", OldIndex, p_State->HistoricalExportIndex), 0);
        }

        sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Historical mode check - Manual: %d, Auto: %d, State: %d, Failures: %d",
            ManualTrigger, p_State->HistoricalExportTriggered, p_State->RequestState, p_State->FailedRequests), 1);

        if (ManualTrigger && !p_State->ManualExportTriggered)
        {
            ShouldTrigger = true;
            p_State->ManualExportTriggered = true;
            p_State->HistoricalExportTriggered = false;
            sc.AddMessageToLog("TradeFlow Pro: Manual export triggered", 0);
        }
        else if (!p_State->HistoricalExportTriggered && !ManualTrigger)
        {
            // Auto-trigger on first load
            ShouldTrigger = true;
            p_State->HistoricalExportTriggered = true;
            sc.AddMessageToLog("TradeFlow Pro: Auto-triggering historical export", 0);
        }

        // Reset manual trigger after processing
        if (ManualTrigger && ShouldTrigger)
        {
            Input_ManualExportTrigger.SetYesNo(0);
        }

        // Start export if triggered
        if (ShouldTrigger)
        {
            int TotalBarsAvailable = sc.ArraySize;

            // Calculate starting index (Oldest data first)
            int StartIndex = max(0, TotalBarsAvailable - HistoricalBarsCount);
            p_State->HistoricalExportIndex = StartIndex;
            p_State->LastExportTime = sc.CurrentSystemDateTime;
            p_State->TotalBarsSent = 0;

            sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Starting export - Target: %d, Available: %d, Starting Index: %d",
                HistoricalBarsCount, TotalBarsAvailable, p_State->HistoricalExportIndex), 0);
        }

        // Continue export if in progress and no pending request
        if (p_State->RequestState == 0 &&
            (p_State->HistoricalExportTriggered || p_State->ManualExportTriggered))
        {
            int TotalBarsAvailable = sc.ArraySize;

            // Check if we have reached the end
            if (p_State->HistoricalExportIndex < TotalBarsAvailable)
            {
                // Determine batch size for historical export
                int BatchSize = 100;  // TradeFlow optimized
                int EndIndex = min(p_State->HistoricalExportIndex + BatchSize - 1, TotalBarsAvailable - 1);

                // Create batch JSON for historical data
                SCString sourceType = p_State->ManualExportTriggered ?
                    "sierra_chart_manual_historical_export" : "sierra_chart_historical_export";
                SCString historicalData = CreateTradeFlowBatchJSON(sc, p_State->HistoricalExportIndex, EndIndex, sourceType.GetChars());

                sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Exporting batch bars %d to %d",
                    p_State->HistoricalExportIndex, EndIndex), 0);

                SCString apiURL = Input_APIEndpoint.GetString();
                SCString apiKey = Input_APIKey.GetString();

                // Add batch to the URL
                // Remove trailing slash to avoid double slash
                SCString baseURL = Input_APIEndpoint.GetString();
                if (baseURL.GetLength() > 0 && baseURL[baseURL.GetLength() - 1] == '/') {
                    baseURL = baseURL.Left(baseURL.GetLength() - 1);
                }
                apiURL = baseURL + "/batch";

                // Prepare headers
                n_ACSIL::s_HTTPHeader headers[2];
                int numHeaders = 0;

                if (apiKey.GetLength() > 0)
                {
                    headers[0].Name = "X-API-Key";
                    headers[0].Value = apiKey;
                    numHeaders++;
                }

                headers[numHeaders].Name = "Content-Type";
                headers[numHeaders].Value = "application/json";
                numHeaders++;

                // Make HTTP POST request
                int result = sc.MakeHTTPPOSTRequest(apiURL, historicalData, headers, numHeaders);

                if (result > 0)
                {
                    p_State->RequestState = 1;  // Request made
                    p_State->TotalBarsSent += (EndIndex - p_State->HistoricalExportIndex + 1);
                    p_State->LastExportTime = sc.CurrentSystemDateTime;
                    sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Sent historical batch of %d bars. Total sent: %d",
                        (EndIndex - p_State->HistoricalExportIndex + 1), p_State->TotalBarsSent), 0);
                }
                else
                {
                    p_State->FailedRequests++;
                    sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Failed to send historical batch. Error: %d (Total failures: %d)", result, p_State->FailedRequests), 1);
                }
            }
            else
            {
                // Historical export complete
                sc.AddMessageToLog(SCString().Format("TradeFlow Pro: Historical export complete. Total bars exported: %d", p_State->TotalBarsSent), 0);

                // Reset states for next export
                p_State->HistoricalExportTriggered = false;
                p_State->ManualExportTriggered = false;
                p_State->HistoricalExportIndex = 0;
            }
        }
    }

    // Update sent count subgraph
    Subgraph_SentCount[sc.Index] = (float)p_State->TotalBarsSent;

    // Display status in study name
    SCString StatusText;
    if (p_State->RequestState == 1)
        StatusText = " (Sending...)";
    else if (p_State->FailedRequests > 0)
        StatusText = SCString().Format(" (Failed: %d)", p_State->FailedRequests);
    else if (p_State->TotalBarsSent > 0)
        StatusText = SCString().Format(" (Sent: %d)", p_State->TotalBarsSent);
    else
        StatusText = " (Active)";

    sc.GraphName = SCString().Format("TradeFlow Pro%s", StatusText.GetChars());
}