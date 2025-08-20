import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { VehicleSearchService } from '../../services/VehicleSearchService';
import { FleetService } from '../../services/FleetService';
import { DelhiComplianceService } from '../../services/DelhiComplianceService';
import { CustomerLoyaltyService } from '../../services/CustomerLoyaltyService';
import { validateRequest, commonSchemas } from '../middleware/validation';
import { requirePermission } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

// Initialize services
const fleetService = new FleetService();
const complianceService = new DelhiComplianceService();
const loyaltyService = new CustomerLoyaltyService();
const vehicleSearchService = new VehicleSearchService(fleetService, complianceService, loyaltyService);

// Vehicle search schema
const vehicleSearchSchema = {
  body: Joi.object({
    pickupLocation: commonSchemas.geoLocation.required(),
    deliveryLocation: commonSchemas.geoLocation.required(),
    timeWindow: commonSchemas.timeWindow.required(),
    capacity: commonSchemas.capacity.required(),
    serviceType: commonSchemas.serviceType.default('shared'),
    vehicleTypePreference: Joi.array().items(commonSchemas.vehicleType).optional(),
    customerId: Joi.string().optional()
  })
};

// Vehicle availability query schema
const availabilityQuerySchema = {
  query: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().min(1).max(50).default(10), // km
    vehicleType: commonSchemas.vehicleType.optional(),
    minCapacityWeight: Joi.number().min(0).optional(),
    minCapacityVolume: Joi.number().min(0).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

// Premium pricing schema
const premiumPricingSchema = {
  body: Joi.object({
    vehicleId: Joi.string().required(),
    serviceLevel: Joi.string().valid('standard', 'priority', 'urgent').default('standard'),
    pickupLocation: commonSchemas.geoLocation.required(),
    deliveryLocation: commonSchemas.geoLocation.required(),
    timeWindow: commonSchemas.timeWindow.required()
  })
};

/**
 * @route POST /api/vehicles/search
 * @desc Search for available vehicles based on criteria
 * @access Private - requires vehicles:search permission
 */
router.post('/search',
  requirePermission('vehicles:search'),
  validateRequest(vehicleSearchSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const searchCriteria = {
      ...req.body,
      customerId: req.body.customerId || req.user?.id
    };

    const result = await vehicleSearchService.searchAvailableVehicles(searchCriteria);

    res.json({
      success: true,
      data: result,
      meta: {
        searchCriteria,
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * @route GET /api/vehicles/available
 * @desc Get available vehicles in a specific area
 * @access Private - requires vehicles:read permission
 */
router.get('/available',
  requirePermission('vehicles:read'),
  validateRequest(availabilityQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { latitude, longitude, radius, vehicleType, minCapacityWeight, minCapacityVolume, page, limit } = req.query;

    const searchCriteria = {
      pickupLocation: { latitude: Number(latitude), longitude: Number(longitude) },
      deliveryLocation: { latitude: Number(latitude), longitude: Number(longitude) }, // Same for availability check
      timeWindow: { 
        earliest: new Date(), 
        latest: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      },
      capacity: { 
        weight: Number(minCapacityWeight) || 0, 
        volume: Number(minCapacityVolume) || 0 
      },
      serviceType: 'shared' as const,
      ...(vehicleType && { vehicleTypePreference: [vehicleType as any] })
    };

    const result = await vehicleSearchService.searchAvailableVehicles(searchCriteria);

    // Filter by radius - using mock location data since VehicleAvailabilityInfo doesn't have location
    const filteredVehicles = result.availableVehicles.filter(_vehicle => {
      // Mock location for filtering - in real implementation, this would come from the vehicle data
      const mockLocation = { latitude: 28.6139, longitude: 77.2090 };
      const distance = calculateDistance(
        Number(latitude), Number(longitude),
        mockLocation.latitude, mockLocation.longitude
      );
      return distance <= Number(radius);
    });

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
 * @route POST /api/vehicles/premium/pricing
 * @desc Calculate premium service pricing
 * @access Private - requires vehicles:search permission
 */
router.post('/premium/pricing',
  requirePermission('vehicles:search'),
  validateRequest(premiumPricingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId, serviceLevel, pickupLocation, deliveryLocation, timeWindow } = req.body;

    // Mock vehicle for pricing calculation
    

    // Mock premium pricing calculation
    const pricing = {
      basePrice: 1000,
      premiumMultiplier: serviceLevel === 'urgent' ? 2.0 : serviceLevel === 'priority' ? 1.5 : 1.2,
      totalPrice: 0,
      exclusivityFee: 200
    };
    pricing.totalPrice = pricing.basePrice * pricing.premiumMultiplier + pricing.exclusivityFee;

    res.json({
      success: true,
      data: {
        vehicleId,
        serviceLevel,
        pricing,
        route: {
          pickup: pickupLocation,
          delivery: deliveryLocation,
          timeWindow
        }
      }
    });
  })
);

/**
 * @route GET /api/vehicles/loyalty/incentives
 * @desc Get loyalty incentives for customer
 * @access Private - requires loyalty:read permission
 */
router.get('/loyalty/incentives',
  requirePermission('loyalty:read'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const customerId = req.user?.id;
    if (!customerId) {
      res.status(400).json({ error: 'Customer ID required' });
      return;
    }

    // Mock loyalty incentives calculation
    const incentives = {
      baseDiscount: 10,
      tierBonus: 5,
      poolingFrequencyBonus: 3,
      msmeBonus: 0,
      totalDiscountPercentage: 18,
      bonusCreditsEarned: 50,
      environmentalImpact: {
        co2SavedThisBooking: 2.5,
        cumulativeCo2Saved: 125.0
      }
    };

    res.json({
      success: true,
      data: incentives
    });
  })
);

/**
 * @route POST /api/vehicles/compliance/validate
 * @desc Validate vehicle compliance for a specific route
 * @access Private - requires vehicles:read permission
 */
router.post('/compliance/validate',
  requirePermission('vehicles:read'),
  validateRequest({
    body: Joi.object({
      vehicleId: Joi.string().required(),
      route: Joi.object({
        stops: Joi.array().items(
          Joi.object({
            location: commonSchemas.geoLocation.required(),
            timeWindow: commonSchemas.timeWindow.required(),
            type: Joi.string().valid('pickup', 'delivery', 'hub').required()
          })
        ).min(1).required()
      }).required()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId, route } = req.body;

    const complianceResult = await vehicleSearchService.validateCompliance(vehicleId, route);

    res.json({
      success: true,
      data: complianceResult
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

export { router as vehicleRoutes };