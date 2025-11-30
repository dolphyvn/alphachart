// Test script to verify CVD API works
const fetch = require('node-fetch');

async function testCVD() {
  try {
    const response = await fetch('http://ns3366383.ip-37-187-77.eu:8001/api/v1/orderflow/cvd/XAUUSD?timeframe=1m&limit=5');
    const data = await response.json();

    console.log('API Status:', response.status);
    console.log('Data Type:', typeof data);
    console.log('Is Array:', Array.isArray(data));
    console.log('Data Length:', data.length);
    console.log('First item:', data[0]);

    // Simulate the frontend transformation
    const orderFlowData = { cvd: data };
    console.log('Transformed orderFlowData:', {
      cvdLength: orderFlowData.cvd.length,
      firstCVDItem: orderFlowData.cvd[0]
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

testCVD();