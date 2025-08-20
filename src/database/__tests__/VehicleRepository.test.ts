import { VehicleRepository } from '../repositories/VehicleRepository';
import { Vehicle } from '../../models/Vehicle';

// Mock the database connection
jest.mock('../connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

import { db } from '../connection';

describe('VehicleRepository', () => {
  let vehicleRepository: VehicleRepository;
  let mockQuery: jest.MockedFunction<typeof db.query>;

  beforeEach(() => {
    vehicleRepository = new VehicleRepository();
    mockQuery = db.query as jest.MockedFunction<typeof db.query>;
    jest.clearAllMocks();
  });

  const mockVehicle: Vehicle = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    type: 'truck',
    subType: 'heavy-truck',
    plateNumber: 'DL01AB1234',
    fuelType: 'diesel',
    capacity: {
      weight: 5000,
      volume: 20,
      maxDimensions: { length: 6, width: 2.5, height: 3 },
    },
    location: {
      latitude: 28.6139,
      longitude: 77.2090,
      timestamp: new Date(),
    },
    status: 'available',
    compliance: {
      pollutionCertificate: true,
      pollutionLevel: 'BS6',
      permitValid: true,
      oddEvenCompliant: true,
      zoneRestrictions: [],
      timeRestrictions: [],
    },
    vehicleSpecs: {
      plateNumber: 'DL01AB1234',
      fuelType: 'diesel',
      vehicleAge: 2,
      registrationState: 'DL',
    },
    accessPrivileges: {
      residentialZones: false,
      commercialZones: true,
      industrialZones: true,
      restrictedHours: false,
      pollutionSensitiveZones: false,
      narrowLanes: false,
    },
    driverInfo: {
      id: '456e7890-e89b-12d3-a456-426614174001',
      workingHours: 4,
      maxWorkingHours: 8,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  };

  describe('findByPlateNumber', () => {
    it('should find vehicle by plate number', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockVehicle],
        rowCount: 1,
      });

      const result = await vehicleRepository.findByPlateNumber('DL01AB1234');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM vehicles WHERE plate_number = $1',
        ['DL01AB1234']
      );
      expect(result).toEqual(mockVehicle);
    });

    it('should return null when vehicle not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await vehicleRepository.findByPlateNumber('NOTFOUND');

      expect(result).toBeNull();
    });
  });

  describe('findByStatus', () => {
    it('should find vehicles by status', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockVehicle],
        rowCount: 1,
      });

      const result = await vehicleRepository.findByStatus('available');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM vehicles WHERE status = $1 AND is_active = true',
        ['available']
      );
      expect(result).toEqual([mockVehicle]);
    });
  });

  describe('findAvailableVehicles', () => {
    it('should find available vehicles without filters', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockVehicle],
        rowCount: 1,
      });

      const result = await vehicleRepository.findAvailableVehicles();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'available' AND is_active = true"),
        []
      );
      expect(result).toEqual([mockVehicle]);
    });

    it('should find available vehicles with filters', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockVehicle],
        rowCount: 1,
      });

      const filters = {
        vehicleType: 'truck',
        fuelType: 'diesel',
        minWeightCapacity: 3000,
        minVolumeCapacity: 15,
      };

      const result = await vehicleRepository.findAvailableVehicles(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND vehicle_type = $1'),
        ['truck', 'diesel', 3000, 15]
      );
      expect(result).toEqual([mockVehicle]);
    });

    it('should find vehicles near location', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockVehicle],
        rowCount: 1,
      });

      const filters = {
        nearLatitude: 28.6139,
        nearLongitude: 77.2090,
        radiusKm: 10,
      };

      const result = await vehicleRepository.findAvailableVehicles(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('6371 * acos'),
        [28.6139, 77.2090, 10]
      );
      expect(result).toEqual([mockVehicle]);
    });
  });

  describe('updateLocation', () => {
    it('should update vehicle location', async () => {
      const updatedVehicle = { ...mockVehicle, location: { latitude: 28.7041, longitude: 77.1025, timestamp: new Date() } };
      mockQuery.mockResolvedValue({
        rows: [updatedVehicle],
        rowCount: 1,
      });

      const locationUpdate = {
        latitude: 28.7041,
        longitude: 77.1025,
      };

      const result = await vehicleRepository.updateLocation(mockVehicle.id, locationUpdate);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE vehicles SET'),
        expect.arrayContaining([mockVehicle.id, 28.7041, 77.1025])
      );
      expect(result).toEqual(updatedVehicle);
    });
  });

  describe('updateStatus', () => {
    it('should update vehicle status', async () => {
      const updatedVehicle = { ...mockVehicle, status: 'in-transit' };
      mockQuery.mockResolvedValue({
        rows: [updatedVehicle],
        rowCount: 1,
      });

      const result = await vehicleRepository.updateStatus(mockVehicle.id, 'in-transit');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE vehicles SET status = $2'),
        [mockVehicle.id, 'in-transit']
      );
      expect(result).toEqual(updatedVehicle);
    });
  });

  describe('findVehiclesNearLocation', () => {
    it('should find vehicles near location with distance calculation', async () => {
      const vehicleWithDistance = { ...mockVehicle, distance_km: 5.2 };
      mockQuery.mockResolvedValue({
        rows: [vehicleWithDistance],
        rowCount: 1,
      });

      const result = await vehicleRepository.findVehiclesNearLocation(28.6139, 77.2090, 10);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('6371 * acos'),
        [28.6139, 77.2090, 10]
      );
      expect(result).toEqual([vehicleWithDistance]);
    });
  });

  describe('findComplianceViolations', () => {
    it('should find vehicles with compliance violations', async () => {
      const violatingVehicle = { ...mockVehicle, compliance: { ...mockVehicle.compliance, pollutionCertificate: false } };
      mockQuery.mockResolvedValue({
        rows: [violatingVehicle],
        rowCount: 1,
      });

      const result = await vehicleRepository.findComplianceViolations();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('pollution_certificate_valid = false OR permit_valid = false'),
        undefined
      );
      expect(result).toEqual([violatingVehicle]);
    });
  });

  describe('getVehicleUtilizationStats', () => {
    it('should return vehicle utilization statistics', async () => {
      const mockStats = [
        {
          vehicle_type: 'truck',
          status: 'available',
          count: 5,
          avg_working_hours: 4.5,
          avg_weight_capacity: 4500,
          avg_volume_capacity: 18,
        },
      ];

      mockQuery.mockResolvedValue({
        rows: mockStats,
        rowCount: 1,
      });

      const result = await vehicleRepository.getVehicleUtilizationStats();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY vehicle_type, status'),
        undefined
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe('error handling', () => {
    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      mockQuery.mockRejectedValue(error);

      await expect(vehicleRepository.findByPlateNumber('DL01AB1234')).rejects.toThrow('Database connection failed');
    });
  });
});