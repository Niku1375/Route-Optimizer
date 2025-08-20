// Fix critical issues that will block future development
const fs = require('fs');

function fixPricingInfoInterface(content) {
  // Add missing properties to PricingInfo interface
  content = content.replace(
    /export interface PricingInfo \{[^}]+\}/s,
    `export interface PricingInfo {
  basePrice: number;
  distancePrice: number;
  timePrice: number;
  totalPrice: number;
  total: number;
  currency: string;
  priceBreakdown: PriceBreakdown[];
  loyaltyDiscount?: DiscountedPricing;
  loyaltyIncentives?: LoyaltyIncentiveCalculation;
}`
  );
  
  return content;
}

function fixSearchMetadataInterface(content) {
  // Add missing properties to SearchMetadata interface
  content = content.replace(
    /export interface SearchMetadata \{[^}]+\}/s,
    `export interface SearchMetadata {
  searchDurationMs: number;
  totalVehiclesEvaluated: number;
  vehiclesEvaluated: number;
  filtersApplied: string[];
  complianceFiltersApplied: string[];
  cacheHit: boolean;
}`
  );
  
  return content;
}

function fixRoutingServiceValidation(content) {
  // Fix the validation method that's causing all routing tests to fail
  content = content.replace(
    /private validateRequest\(request: RoutingRequest\): string\[\] \{[^}]+\}/s,
    `private validateRequest(request: RoutingRequest): string[] {
    const errors: string[] = [];
    
    // Basic validation
    if (!request.deliveries || request.deliveries.length === 0) {
      errors.push('At least one delivery is required');
    }
    
    if (!request.vehicles || request.vehicles.length === 0) {
      errors.push('At least one vehicle is required');
    }
    
    if (!request.timeWindow) {
      errors.push('Time window is required');
    }
    
    return errors;
  }`
  );
  
  return content;
}

function fixTestDataIssues(content) {
  // Fix Vehicle capacity issues
  content = content.replace(
    /capacity:\s*{\s*weight:\s*(\d+),\s*volume:\s*(\d+)\s*}/g,
    'capacity: { weight: $1, volume: $2, maxDimensions: { length: 6, width: 2.5, height: 3 } }'
  );
  
  // Fix VehicleSpecs issues
  content = content.replace(
    /(vehicleSpecs:\s*{\s*plateNumber:\s*'[^']+',\s*fuelType:\s*'[^']+',\s*vehicleAge:\s*\d+,\s*registrationState:\s*'[^']+'\s*})/g,
    (match) => match.replace('}', ', manufacturingYear: 2021 }')
  );
  
  // Fix DriverInfo issues
  content = content.replace(
    /(driverInfo:\s*{\s*id:\s*'[^']+',\s*workingHours:\s*\d+,\s*maxWorkingHours:\s*\d+\s*})/g,
    (match) => match.replace('}', ', name: "Test Driver", licenseNumber: "DL123456789", contactNumber: "+91-9876543210" }')
  );
  
  // Fix ShipmentDetails issues
  content = content.replace(
    /(shipment:\s*{\s*weight:\s*\d+,\s*volume:\s*\d+,\s*fragile:\s*\w+,\s*specialHandling:\s*\[[^\]]*\]\s*})/g,
    (match) => match.replace('}', ', hazardous: false, temperatureControlled: false }')
  );
  
  // Fix estimatedDeparture property
  content = content.replace(/estimatedDeparture:/g, 'estimatedDepartureTime:');
  
  // Add lastUpdated to Vehicle objects
  content = content.replace(
    /(const mockVehicles?: Vehicle\[\] = \[[^}]+}[^\]]*\])/gs,
    (match) => {
      if (!match.includes('lastUpdated:')) {
        return match.replace(/}(\s*\])/g, ',\n        lastUpdated: new Date()\n      }$1');
      }
      return match;
    }
  );
  
  return content;
}

function fixDuplicateImports(content) {
  // Remove duplicate imports
  const lines = content.split('\n');
  const seenImports = new Set();
  const filteredLines = lines.filter(line => {
    if (line.match(/^import.*from 'node:test'/)) {
      if (seenImports.has(line)) {
        return false;
      }
      seenImports.add(line);
    }
    return true;
  });
  
  return filteredLines.join('\n');
}

console.log('Fixing critical blocking issues...');

const criticalFixes = [
  {
    path: 'src/services/VehicleSearchService.ts',
    fixers: [fixPricingInfoInterface, fixSearchMetadataInterface]
  },
  {
    path: 'src/services/RoutingService.ts',
    fixers: [fixRoutingServiceValidation]
  },
  {
    path: 'src/services/__tests__/FallbackHeuristicService.test.ts',
    fixers: [fixTestDataIssues]
  },
  {
    path: 'src/services/external/__tests__/MapboxVisualizationClient.test.ts',
    fixers: [fixTestDataIssues]
  },
  {
    path: 'src/cache/__tests__/CacheService.test.ts',
    fixers: [fixDuplicateImports]
  }
];

criticalFixes.forEach(({ path: filePath, fixers }) => {
  if (fs.existsSync(filePath)) {
    console.log(`Fixing critical issues in ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    fixers.forEach(fixer => {
      content = fixer(content);
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed critical issues in ${filePath}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('Critical blocking issues fixed!');