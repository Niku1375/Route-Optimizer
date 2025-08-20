// Simple test to verify Mapbox integration
const { MapboxVisualizationClient } = require('./dist/services/external/MapboxVisualizationClient');

async function testMapboxIntegration() {
  try {
    const client = new MapboxVisualizationClient({
      accessToken: 'test-token'
    });

    // Test scenario generation
    const scenario = await client.generateDemoScenario('delhi_compliance');
    console.log('Delhi Compliance Scenario:', JSON.stringify(scenario, null, 2));

    // Test bounds calculation
    const bounds = client.calculateMapBounds([
      [77.2090, 28.6139],
      [77.2100, 28.6149]
    ]);
    console.log('Map Bounds:', bounds);

    console.log('✅ Mapbox integration test passed!');
  } catch (error) {
    console.error('❌ Mapbox integration test failed:', error.message);
  }
}

testMapboxIntegration();