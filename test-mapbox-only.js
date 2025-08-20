// Simple test to verify Mapbox integration works
const { MapboxVisualizationClient } = require('./dist/services/external/MapboxVisualizationClient');

async function testMapboxIntegration() {
  try {
    console.log('Testing Mapbox integration...');
    
    const client = new MapboxVisualizationClient({
      accessToken: 'test-token',
      baseUrl: 'https://api.mapbox.com',
      timeout: 5000
    });

    // Test demo scenario generation
    const scenario = await client.generateDemoScenario('delhi_compliance');
    console.log('✓ Demo scenario generated successfully');
    console.log(`  - Name: ${scenario.name}`);
    console.log(`  - Vehicles: ${scenario.vehicles.length}`);
    console.log(`  - Hubs: ${scenario.hubs.length}`);

    // Test bounds calculation
    const bounds = client.calculateMapBounds([
      [77.2090, 28.6139],
      [77.2100, 28.6149]
    ]);
    console.log('✓ Map bounds calculated successfully');
    console.log(`  - Southwest: [${bounds.southwest.join(', ')}]`);
    console.log(`  - Northeast: [${bounds.northeast.join(', ')}]`);

    console.log('\n✅ Mapbox integration test completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Mapbox integration test failed:', error.message);
    return false;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testMapboxIntegration().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testMapboxIntegration };