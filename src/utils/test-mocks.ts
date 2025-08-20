// Common test mocks and helpers
export const createMockVehicle = (overrides: any = {}) => ({
  id: 'test-vehicle-1',
  type: 'van',
  subType: 'pickup-van',
  capacity: {
    weight: 1000,
    volume: 5,
    maxDimensions: { length: 4, width: 2, height: 2 }
  },
  location: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
  status: 'available',
  compliance: {
    pollutionCertificate: true,
    pollutionLevel: 'BS6',
    permitValid: true,
    oddEvenCompliant: true,
    zoneRestrictions: [],
    timeRestrictions: []
  },
  vehicleSpecs: {
    plateNumber: 'DL01AB1234',
    fuelType: 'diesel',
    vehicleAge: 2,
    registrationState: 'DL',
    manufacturingYear: 2022
  },
  accessPrivileges: {
    residentialZones: true,
    commercialZones: true,
    industrialZones: true,
    restrictedHours: false,
    pollutionSensitiveZones: true,
    narrowLanes: true
  },
  driverInfo: {
    id: 'driver-1',
    name: 'Test Driver',
    licenseNumber: 'DL123456789',
    contactNumber: '+91-9876543210',
    workingHours: 8,
    maxWorkingHours: 12
  },
  lastUpdated: new Date(),
  ...overrides
});

export const createMockDelivery = (overrides: any = {}) => ({
  id: 'test-delivery-1',
  customerId: 'customer-1',
  pickupLocation: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
  deliveryLocation: { latitude: 28.7041, longitude: 77.1025, timestamp: new Date() },
  timeWindow: { earliest: new Date(), latest: new Date(Date.now() + 3600000) },
  shipment: {
    weight: 100,
    volume: 1,
    fragile: false,
    specialHandling: [],
    hazardous: false,
    temperatureControlled: false
  },
  priority: 'medium',
  serviceType: 'shared',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createMockHub = (overrides: any = {}) => ({
  id: 'test-hub-1',
  name: 'Test Hub',
  location: { latitude: 28.6139, longitude: 77.2090 },
  capacity: {
    maxVehicles: 50,
    currentVehicles: 10,
    storageArea: 1000,
    loadingBays: 5,
    bufferVehicleSlots: 10
  },
  bufferVehicles: [],
  operatingHours: {
    open: '06:00',
    close: '22:00',
    timezone: 'Asia/Kolkata'
  },
  facilities: ['loading_dock', 'fuel_station'],
  hubType: 'primary',
  status: 'active',
  contactInfo: {
    phone: '+91-9876543210',
    email: 'hub@test.com',
    manager: 'Test Manager'
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createMockRouteStop = (overrides: any = {}) => ({
  id: 'stop-1',
  location: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
  type: 'pickup',
  sequence: 1,
  estimatedArrivalTime: new Date(),
  estimatedDepartureTime: new Date(Date.now() + 1800000),
  duration: 30,
  status: 'planned',
  address: 'Test Address',
  ...overrides
});

export const createMockSearchCriteria = (overrides: any = {}) => ({
  pickupLocation: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
  deliveryLocation: { latitude: 28.7041, longitude: 77.1025, timestamp: new Date() },
  timeWindow: { start: new Date(), end: new Date(Date.now() + 3600000) },
  capacity: { weight: 100, volume: 1 },
  serviceType: 'shared',
  ...overrides
});

export const createMockRoutingConstraints = (overrides: any = {}) => ({
  vehicleCapacityConstraints: true,
  timeWindowConstraints: true,
  hubSequencing: true,
  vehicleClassRestrictions: [],
  timeWindowConstraints_delhi: [],
  zoneAccessRules: [],
  pollutionCompliance: [],
  oddEvenRules: [],
  weightDimensionLimits: [],
  ...overrides
});