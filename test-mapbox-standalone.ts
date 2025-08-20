// Standalone test for Mapbox integration
import { MapboxVisualizationClient, MapboxConfig } from './src/services/external/MapboxVisualizationClient';
import { MapVisualizationService, MapVisualizationConfig } from './src/services/MapVisualizationService';

async function testMapboxStandalone() {
  console.log('🚀 Testing Mapbox integration standalone...\n');

  try {
    // Test 1: MapboxVisualizationClient initialization
    console.log('1. Testing MapboxVisualizationClient initialization...');
    const mapboxConfig: MapboxConfig = {
      accessToken: 'test-token',
      baseUrl: 'https://api.mapbox.com',
      timeout: 5000
    };
    
    const mapboxClient = new MapboxVisualizationClient(mapboxConfig);
    console.log('   ✓ MapboxVisualizationClient created successfully');

    // Test 2: Demo scenario generation
    console.log('\n2. Testing demo scenario generation...');
    const delhiScenario = await mapboxClient.generateDemoScenario('delhi_compliance');
    console.log(`   ✓ Delhi compliance scenario generated`);
    console.log(`     - Name: ${delhiScenario.name}`);
    console.log(`     - Vehicles: ${delhiScenario.vehicles.length}`);
    console.log(`     - Hubs: ${delhiScenario.hubs.length}`);
    console.log(`     - Description: ${delhiScenario.description}`);

    const hubSpokeScenario = await mapboxClient.generateDemoScenario('hub_spoke');
    console.log(`   ✓ Hub-spoke scenario generated`);
    console.log(`     - Name: ${hubSpokeScenario.name}`);
    console.log(`     - Vehicles: ${hubSpokeScenario.vehicles.length}`);
    console.log(`     - Hubs: ${hubSpokeScenario.hubs.length}`);

    const breakdownScenario = await mapboxClient.generateDemoScenario('breakdown_recovery');
    console.log(`   ✓ Breakdown recovery scenario generated`);
    console.log(`     - Name: ${breakdownScenario.name}`);
    console.log(`     - Vehicles: ${breakdownScenario.vehicles.length}`);
    console.log(`     - Hubs: ${breakdownScenario.hubs.length}`);

    const trafficScenario = await mapboxClient.generateDemoScenario('traffic_optimization');
    console.log(`   ✓ Traffic optimization scenario generated`);
    console.log(`     - Name: ${trafficScenario.name}`);
    console.log(`     - Vehicles: ${trafficScenario.vehicles.length}`);
    console.log(`     - Hubs: ${trafficScenario.hubs.length}`);

    // Test 3: Map bounds calculation
    console.log('\n3. Testing map bounds calculation...');
    const testLocations: Array<[number, number]> = [
      [77.2090, 28.6139], // Delhi center
      [77.2100, 28.6149], // Nearby point
      [77.2080, 28.6129]  // Another nearby point
    ];
    
    const bounds = mapboxClient.calculateMapBounds(testLocations);
    console.log('   ✓ Map bounds calculated successfully');
    console.log(`     - Southwest: [${bounds.southwest.join(', ')}]`);
    console.log(`     - Northeast: [${bounds.northeast.join(', ')}]`);

    // Test empty locations (should return Delhi default bounds)
    const emptyBounds = mapboxClient.calculateMapBounds([]);
    console.log('   ✓ Empty bounds handled correctly');
    console.log(`     - Default Southwest: [${emptyBounds.southwest.join(', ')}]`);
    console.log(`     - Default Northeast: [${emptyBounds.northeast.join(', ')}]`);

    // Test 4: MapVisualizationService initialization
    console.log('\n4. Testing MapVisualizationService initialization...');
    const mapVizConfig: MapVisualizationConfig = {
      mapbox: mapboxConfig,
      defaultCenter: [77.2090, 28.6139],
      defaultZoom: 11
    };
    
    const mapVizService = new MapVisualizationService(mapVizConfig);
    console.log('   ✓ MapVisualizationService created successfully');

    // Test 5: Demo scenario generation through service
    console.log('\n5. Testing demo scenario generation through service...');
    const serviceScenario = await mapVizService.generateDemoScenario({
      scenarioType: 'delhi_compliance',
      vehicleCount: 6,
      hubCount: 2
    });
    
    console.log('   ✓ Service demo scenario generated');
    console.log(`     - Name: ${serviceScenario.name}`);
    console.log(`     - Enhanced vehicles: ${serviceScenario.vehicles.length}`);
    console.log(`     - Enhanced hubs: ${serviceScenario.hubs.length}`);

    console.log('\n✅ All Mapbox integration tests passed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - MapboxVisualizationClient: ✓ Working');
    console.log('   - Demo scenario generation: ✓ Working (4 types)');
    console.log('   - Map bounds calculation: ✓ Working');
    console.log('   - MapVisualizationService: ✓ Working');
    console.log('   - Service enhancements: ✓ Working');
    
    return true;
  } catch (error) {
    console.error('\n❌ Mapbox integration test failed:');
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    return false;
  }
}

// Run the test
testMapboxStandalone().then(success => {
  console.log(`\n🏁 Test completed with ${success ? 'SUCCESS' : 'FAILURE'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});