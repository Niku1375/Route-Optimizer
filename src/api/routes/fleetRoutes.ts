import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { FleetService } from '../../services/FleetService';
import { validateRequest, commonSchemas } from '../middleware/validation';
import { requirePermission } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const fleetService: FleetService = new FleetService();

// Vehicle registration schema
const vehicleRegistrationSchema = {
  body: Joi.object({
    id: Joi.string().required(),
    type: commonSchemas.vehicleType.required(),
    subType: Joi.string().valid(
      'heavy-truck', 'light-truck', 'mini-truck', 
      'tempo-traveller', 'pickup-van', 
      'auto-rickshaw', 'e-rickshaw'
    ).required(),
    capacity: commonSchemas.capacity.required(),
    location: commonSchemas.geoLocation.required(),
    vehicleSpecs: Joi.object({
      plateNumber: Joi.string().pattern(/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/).required(),
      fuelType: Joi.string().valid('diesel', 'petrol', 'cng', 'electric').required(),
      vehicleAge: Joi.number().min(0).max(20).required(),
      registrationState: Joi.string().length(2).required()
    }).required(),
    compliance: Joi.object({
      pollutionCertificate: Joi.boolean().default(true),
      pollutionLevel: Joi.string().valid('BS6', 'BS4', 'BS3', 'electric').required(),
      permitValid: Joi.boolean().default(true)
    }).required(),
    driverInfo: Joi.object({
      id: Joi.string().required(),
      name: Joi.string().min(2).max(100).required(),
      licenseNumber: Joi.string().required(),
      contactNumber: Joi.string().pattern(/^[0-9]{10}$/).required()
    }).required()
  })
};

// Vehicle status update schema
const statusUpdateSchema = {
  body: Joi.object({
    status: Joi.string().valid('available', 'in-transit', 'loading', 'maintenance', 'breakdown').required(),
    location: commonSchemas.geoLocation.optional(),
    reason: Joi.string().optional(),
    estimatedAvailableAt: Joi.date().optional()
  })
};

// Location update schema
const locationUpdateSchema = {
  body: Joi.object({
    location: commonSchemas.geoLocation.required(),
    timestamp: Joi.date().default(new Date()),
    speed: Joi.number().min(0).max(120).optional(),
    heading: Joi.number().min(0).max(360).optional()
  })
};

/**
 * @route POST /api/fleet/vehicles
 * @desc Register a new vehicle in the fleet
 * @access Private - requires fleet:write permission
 */
router.post('/vehicles',
  requirePermission('fleet:write'),
  validateRequest(vehicleRegistrationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const vehicleData = req.body;

    await fleetService.registerVehicle(vehicleData);

    res.status(201).json({
      success: true,
      data: vehicleData,
      message: `Vehicle ${vehicleData.id} registered successfully`
    });
  })
);

/**
 * @route GET /api/fleet/vehicles
 * @desc Get all vehicles in the fleet with optional filtering
 * @access Private - requires fleet:read permission
 */
router.get('/vehicles',
  requirePermission('fleet:read'),
  validateRequest({
    query: Joi.object({
      status: Joi.string().valid('available', 'in-transit', 'loading', 'maintenance', 'breakdown').optional(),
      type: commonSchemas.vehicleType.optional(),
      hubId: Joi.string().optional(),
      location: Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required(),
        radius: Joi.number().min(1).max(100).default(10)
      }).optional(),
      ...commonSchemas.pagination
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, type, location, page, limit } = req.query;

    const searchCriteria = {
      pickupLocation: { latitude: 28.6139, longitude: 77.2090 }, // Default Delhi center
      deliveryLocation: { latitude: 28.6139, longitude: 77.2090 },
      timeWindow: { start: '00:00', end: '23:59' },
      capacity: { weight: 0, volume: 0 },
      serviceType: 'shared' as const
    };

    const result = await fleetService.getAvailableVehicles(searchCriteria);
    
    // Apply filters
    let filteredVehicles = result;
    if (status) {
      filteredVehicles = filteredVehicles.filter(vehicle => vehicle.status === status);
    }
    if (type) {
      filteredVehicles = filteredVehicles.filter(vehicle => vehicle.type === type);
    }

    // Apply location filter if provided
    if (location) {
      filteredVehicles = filteredVehicles.filter(vehicle => {
        const loc = location as any; // Cast to any to access properties
        const distance = calculateDistance(
          Number(loc.latitude), Number(loc.longitude),
          vehicle.location.latitude, vehicle.location.longitude
        );
        return distance <= Number(loc.radius);
      });
    }

    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedVehicles = filteredVehicles.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        vehicles: paginatedVehicles,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filteredVehicles.length,
          totalPages: Math.ceil(filteredVehicles.length / Number(limit))
        }
      }
    });
  })
);

/**
 * @route GET /api/fleet/vehicles/:vehicleId
 * @desc Get specific vehicle details
 * @access Private - requires fleet:read permission
 */
router.get('/vehicles/:vehicleId',
  requirePermission('fleet:read'),
  validateRequest({
    params: Joi.object({
      vehicleId: Joi.string().required()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId } = req.params;

    // Mock vehicle data - in real implementation, this would fetch from database
    const vehicle = {
      id: vehicleId,
      type: 'van',
      subType: 'pickup-van',
      capacity: { weight: 1000, volume: 5 },
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
        registrationState: 'DL'
      },
      driverInfo: {
        id: 'driver-001',
        name: 'Rajesh Kumar',
        licenseNumber: 'DL123456789',
        contactNumber: '9876543210'
      },
      lastUpdated: new Date(),
      createdAt: new Date()
    };

    res.json({
      success: true,
      data: vehicle
    });
  })
);

/**
 * @route PUT /api/fleet/vehicles/:vehicleId/status
 * @desc Update vehicle status
 * @access Private - requires fleet:write permission
 */
router.put('/vehicles/:vehicleId/status',
  requirePermission('fleet:write'),
  validateRequest({
    params: Joi.object({
      vehicleId: Joi.string().required()
    }),
    ...statusUpdateSchema
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId } = req.params;
    const statusUpdate = req.body;

    await (fleetService.updateVehicleStatus as any)(vehicleId, statusUpdate.status);

    res.json({
      success: true,
      data: {
        vehicleId,
        ...statusUpdate,
        updatedAt: new Date()
      },
      message: `Vehicle ${vehicleId} status updated to ${statusUpdate.status}`
    });
  })
);

/**
 * @route PUT /api/fleet/vehicles/:vehicleId/location
 * @desc Update vehicle location (GPS tracking)
 * @access Private - requires fleet:write permission
 */
router.put('/vehicles/:vehicleId/location',
  requirePermission('fleet:write'),
  validateRequest({
    params: Joi.object({
      vehicleId: Joi.string().required()
    }),
    ...locationUpdateSchema
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId } = req.params;
    const locationUpdate = req.body;

    // Mock location update - in real implementation, this would update database and trigger WebSocket events
    const updatedVehicle = {
      vehicleId,
      location: locationUpdate.location,
      timestamp: locationUpdate.timestamp,
      speed: locationUpdate.speed,
      heading: locationUpdate.heading
    };

    res.json({
      success: true,
      data: updatedVehicle,
      message: `Vehicle ${vehicleId} location updated`
    });
  })
);

/**
 * @route POST /api/fleet/vehicles/:vehicleId/breakdown
 * @desc Report vehicle breakdown and trigger buffer allocation
 * @access Private - requires fleet:write permission
 */
router.post('/vehicles/:vehicleId/breakdown',
  requirePermission('fleet:write'),
  validateRequest({
    params: Joi.object({
      vehicleId: Joi.string().required()
    }),
    body: Joi.object({
      location: commonSchemas.geoLocation.required(),
      description: Joi.string().min(10).max(500).required(),
      severity: Joi.string().valid('minor', 'major', 'critical').required(),
      estimatedRepairTime: Joi.number().min(0).optional(), // in minutes
      requiresReplacement: Joi.boolean().default(false)
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId } = req.params;
    const breakdownData = req.body;

    // Update vehicle status to breakdown
    await fleetService.updateVehicleStatus(vehicleId, 'breakdown');

    // Allocate buffer vehicle if replacement is required
    let bufferVehicle = null;
    if (breakdownData.requiresReplacement) {
      try {
        bufferVehicle = await fleetService.allocateBufferVehicle('hub-nearest');
      } catch (error) {
        // Log error but don't fail the breakdown report
        console.error('Failed to allocate buffer vehicle:', error);
      }
    }

    res.json({
      success: true,
      data: {
        vehicleId,
        breakdownReported: true,
        breakdownData,
        bufferVehicle,
        timestamp: new Date()
      },
      message: `Breakdown reported for vehicle ${vehicleId}${bufferVehicle ? '. Buffer vehicle allocated.' : ''}`
    });
  })
);

/**
 * @route GET /api/fleet/hubs/:hubId/buffer-vehicles
 * @desc Get buffer vehicles available at a specific hub
 * @access Private - requires fleet:read permission
 */
router.get('/hubs/:hubId/buffer-vehicles',
  requirePermission('fleet:read'),
  validateRequest({
    params: Joi.object({
      hubId: Joi.string().required()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { hubId } = req.params;

    // Mock buffer vehicles data
    const bufferVehicles = [
      {
        id: 'buffer-001',
        type: 'van',
        capacity: { weight: 1000, volume: 5 },
        status: 'available',
        location: { latitude: 28.6139, longitude: 77.2090 },
        hubId,
        lastMaintenance: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'buffer-002',
        type: 'tempo',
        capacity: { weight: 1500, volume: 8 },
        status: 'available',
        location: { latitude: 28.6139, longitude: 77.2090 },
        hubId,
        lastMaintenance: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    ];

    res.json({
      success: true,
      data: {
        hubId,
        bufferVehicles,
        totalAvailable: bufferVehicles.filter(v => v.status === 'available').length,
        totalCapacity: bufferVehicles.length
      }
    });
  })
);

/**
 * @route GET /api/fleet/metrics
 * @desc Get fleet performance metrics
 * @access Private - requires fleet:read permission
 */
router.get('/metrics',
  requirePermission('fleet:read'),
  validateRequest({
    query: Joi.object({
      period: Joi.string().valid('today', 'week', 'month', 'quarter').default('today'),
      hubId: Joi.string().optional()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { period, hubId } = req.query;

    // Mock metrics data
    const metrics = {
      period,
      hubId,
      fleet: {
        totalVehicles: 150,
        availableVehicles: 120,
        inTransitVehicles: 25,
        maintenanceVehicles: 3,
        breakdownVehicles: 2
      },
      utilization: {
        averageUtilization: 78.5,
        peakUtilization: 95.2,
        lowUtilization: 45.8
      },
      efficiency: {
        averageRouteEfficiency: 82.3,
        fuelSavingsPercentage: 15.7,
        co2ReductionKg: 1250.5
      },
      compliance: {
        overallComplianceRate: 98.2,
        timeRestrictionViolations: 3,
        pollutionViolations: 1,
        oddEvenViolations: 0
      },
      bufferVehicles: {
        totalBuffer: 15,
        availableBuffer: 12,
        utilizationRate: 20.0
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  })
);

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export { router as fleetRoutes };