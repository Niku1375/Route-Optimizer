// Script to fix remaining test errors
const fs = require('fs');

// Fix all remaining issues in test files
function fixAllIssues(content) {
  // Fix Vehicle missing properties
  content = content.replace(
    /(const mockVehicle: Vehicle = {[^}]+})/gs,
    (match) => {
      if (!match.includes('subType:')) {
        match = match.replace('type: \'van\'', 'type: \'van\',\n    subType: \'pickup-van\'');
      }
      if (!match.includes('lastUpdated:')) {
        match = match.replace(/}$/, ',\n    lastUpdated: new Date()\n  }');
      }
      return match;
    }
  );

  // Fix Vehicle arrays missing properties
  content = content.replace(
    /(const mockVehicles: Vehicle\[\] = \[\{[^}]+}[^\]]*\])/gs,
    (match) => {
      if (!match.includes('lastUpdated:')) {
        match = match.replace(/}(\s*\])/g, ',\n        lastUpdated: new Date()\n      }$1');
      }
      return match;
    }
  );

  // Fix Hub missing properties
  content = content.replace(
    /(const mockHub: Hub = {[^}]+})/gs,
    (match) => {
      if (!match.includes('hubType:')) {
        match = match.replace(/facilities: \[[^\]]+\]/, 
          'facilities: [\'loading_dock\', \'fuel_station\'],\n        hubType: \'primary\' as const,\n        status: \'active\' as const,\n        contactInfo: {\n          managerName: \'Test Manager\',\n          phone: \'+91-9876543210\',\n          email: \'test@hub.com\',\n          emergencyContact: \'+91-9876543211\'\n        },\n        createdAt: new Date(),\n        updatedAt: new Date()');
      }
      return match;
    }
  );

  // Fix Hub arrays missing properties
  content = content.replace(
    /(const mockHubs: Hub\[\] = \[\{[^}]+}[^\]]*\])/gs,
    (match) => {
      if (!match.includes('hubType:')) {
        match = match.replace(/facilities: \[[^\]]+\]/g, 
          'facilities: [\'loading_dock\', \'fuel_station\'],\n        hubType: \'primary\' as const,\n        status: \'active\' as const,\n        contactInfo: {\n          managerName: \'Test Manager\',\n          phone: \'+91-9876543210\',\n          email: \'test@hub.com\',\n          emergencyContact: \'+91-9876543211\'\n        },\n        createdAt: new Date(),\n        updatedAt: new Date()');
      }
      return match;
    }
  );

  // Fix TrafficData source property
  content = content.replace(/source: 'mock'/g, 'source: \'cached\'');

  // Fix GeoArea structure
  content = content.replace(
    /area: { center: ([^,]+), radiusKm: \d+ }/g,
    'area: { id: \'test-area\', name: \'Test Area\', boundaries: [$1], zoneType: \'commercial\' }'
  );

  // Fix RouteStop address property (remove it as it doesn't exist)
  content = content.replace(/,?\s*address: '[^']*'/g, '');

  // Fix VehicleTrackingData estimatedArrivalTime
  content = content.replace(/estimatedArrivalTime:/g, 'estimatedArrival:');

  // Fix MapVisualizationConfig missing graphHopper
  content = content.replace(
    /(mockConfig.*=.*{[^}]*defaultZoom: \d+)/,
    '$1,\n      graphHopper: {\n        apiKey: \'test-key\',\n        baseUrl: \'https://graphhopper.com/api/1\',\n        timeout: 5000\n      }'
  );

  return content;
}

console.log('Fixing remaining test errors...');

const filesToFix = [
  'src/services/__tests__/MapVisualizationService.test.ts',
  'src/services/__tests__/RealTimeRouteOptimizer.test.ts',
  'src/services/__tests__/RealTimeRouteOptimizer.integration.test.ts'
];

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`Fixing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    content = fixAllIssues(content);
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
  }
});

console.log('Remaining error fixes completed!');