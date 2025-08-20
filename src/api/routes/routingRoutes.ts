import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { RoutingService } from '../../services/RoutingService';



import { validateRequest, commonSchemas } from '../middleware/validation';
import { requirePermission } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Initialize services
const routingService = new RoutingService();




// Route optimization request schema
const routeOptimizationSchema = {
  body: Joi.object({
    vehicles: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        type: commonSchemas.vehicleType.required(),
        capacity: commonSchemas.capacity.required(),
        location: commonSchemas.geoLocation.required(),
        maxWorkingHours: Joi.number().min(1).max(12).default(8)
      })
    ).min(1).required(),
    deliveries: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        pickupLocation: commonSchemas.geoLocation.required(),
        deliveryLocation: commonSchemas.geoLocation.required(),
        timeWindow: Joi.object({
          earliest: Joi.date().required(),
          latest: Joi.date().required()
        }).required(),
        shipment: Joi.object({
          weight: Joi.number().min(0).required(),
          volume: Joi.number().min(0).required(),
          fragile: Joi.boolean().default(false),
          specialHandling: Joi.array().items(Joi.string()).default([])
        }).required(),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium')
      })
    ).min(1).required(),
    hubs: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        location: commonSchemas.geoLocation.required(),
        capacity: Joi.object({
          vehicles: Joi.number().min(0).required(),
          storage: Joi.number().min(0).required()
        }).required(),
        operatingHours: Joi.object({
          open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
          close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
        }).required()
      })
    ).optional(),
    constraints: Joi.object({
      maxRouteDistance: Joi.number().min(0).optional(),
      maxRouteDuration: Joi.number().min(0).optional(),
      enforceTimeWindows: Joi.boolean().default(true),
      allowLoadSplitting: Joi.boolean().default(true),
      prioritizeElectricVehicles: Joi.boolean().default(false)
    }).optional(),
    optimizationGoal: Joi.string().valid('minimize_distance', 'minimize_time', 'minimize_cost', 'maximize_efficiency').default('maximize_efficiency')
  })
};

// Route reoptimization schema
const reoptimizationSchema = {
  body: Joi.object({
    routeId: Joi.string().required(),
    updates: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('traffic_update', 'vehicle_breakdown', 'new_delivery', 'delivery_cancelled').required(),
        data: Joi.object().required(),
        timestamp: Joi.date().default(new Date())
      })
    ).min(1).required(),
    reoptimizationLevel: Joi.string().valid('minimal', 'moderate', 'full').default('moderate')
  })
};

// Route validation schema
const routeValidationSchema = {
  body: Joi.object({
    route: Joi.object({
      id: Joi.string().required(),
      vehicleId: Joi.string().required(),
      stops: Joi.array().items(
        Joi.object({
          id: Joi.string().required(),
          location: commonSchemas.geoLocation.required(),
          type: Joi.string().valid('pickup', 'delivery', 'hub').required(),
          timeWindow: commonSchemas.timeWindow.required(),
          estimatedArrival: Joi.date().optional(),
          estimatedDeparture: Joi.date().optional()
        })
      ).min(1).required(),
      estimatedDuration: Joi.number().min(0).required(),
      estimatedDistance: Joi.number().min(0).required()
    }).required()
  })
};

/**
 * @route POST /api/routing/optimize
 * @desc Optimize routes for given vehicles and deliveries
 * @access Private - requires routes:write permission
 */
router.post('/optimize',
  requirePermission('routes:write'),
  validateRequest(routeOptimizationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicles, deliveries, hubs, constraints, optimizationGoal } = req.body;

    const routingRequest = {
      vehicles,
      deliveries,
      hubs: hubs || [],
      constraints: {
        vehicleClassRestrictions: [],
        timeWindowConstraints: [],
        zoneAccessRules: [],
        pollutionCompliance: [],
        oddEvenRules: [],
        weightDimensionLimits: [],
        ...constraints
      },
      trafficData: {
        currentConditions: [],
        predictions: [],
        lastUpdated: new Date()
      },
      timeWindow: {
        earliest: new Date(),
        latest: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      },
      complianceRules: []
    };

    const result = await routingService.optimizeRoutes(routingRequest);

    res.json({
      success: true,
      data: result,
      meta: {
        optimizationGoal,
        requestTimestamp: new Date().toISOString(),
        vehicleCount: vehicles.length,
        deliveryCount: deliveries.length
      }
    });
  })
);

/**
 * @route POST /api/routing/reoptimize
 * @desc Reoptimize existing route based on real-time updates
 * @access Private - requires routes:write permission
 */
router.post('/reoptimize',
  requirePermission('routes:write'),
  validateRequest(reoptimizationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { routeId, updates, reoptimizationLevel } = req.body;

    // Mock reoptimization result - in real implementation, this would use the actual service
    const result = {
      success: true,
      triggerId: `reopt_${Date.now()}`,
      originalRoutes: [{ id: routeId, status: 'active' }],
      optimizedRoutes: [{ id: routeId, status: 'active', optimized: true }],
      improvements: [
        { type: 'time_saved', value: 15, unit: 'minutes' },
        { type: 'distance_reduced', value: 5.2, unit: 'km' }
      ],
      processingTime: 2500,
      message: 'Route successfully reoptimized'
    };

    res.json({
      success: true,
      data: result,
      meta: {
        originalRouteId: routeId,
        updateCount: updates.length,
        reoptimizationLevel,
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * @route POST /api/routing/validate
 * @desc Validate route compliance and feasibility
 * @access Private - requires routes:read permission
 */
router.post('/validate',
  requirePermission('routes:read'),
  validateRequest(routeValidationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { route } = req.body;

    const validationResult = await routingService.validateRoute(route);

    res.json({
      success: true,
      data: validationResult
    });
  })
);

/**
 * @route GET /api/routing/routes/:routeId
 * @desc Get route details by ID
 * @access Private - requires routes:read permission
 */
router.get('/routes/:routeId',
  requirePermission('routes:read'),
  validateRequest({
    params: Joi.object({
      routeId: Joi.string().required()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { routeId } = req.params;

    // Mock route retrieval - in real implementation, this would fetch from database
    const route = {
      id: routeId,
      vehicleId: 'V001',
      status: 'active',
      stops: [
        {
          id: 'stop-1',
          location: { latitude: 28.6139, longitude: 77.2090 },
          type: 'pickup',
          timeWindow: { start: '09:00', end: '10:00' },
          estimatedArrival: new Date(),
          completed: false
        }
      ],
      estimatedDuration: 120,
      estimatedDistance: 25.5,
      actualDuration: null,
      actualDistance: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.json({
      success: true,
      data: route
    });
  })
);

/**
 * @route GET /api/routing/routes
 * @desc Get all routes with optional filtering
 * @access Private - requires routes:read permission
 */
router.get('/routes',
  requirePermission('routes:read'),
  validateRequest({
    query: Joi.object({
      status: Joi.string().valid('planned', 'active', 'completed', 'cancelled').optional(),
      vehicleId: Joi.string().optional(),
      dateFrom: Joi.date().optional(),
      dateTo: Joi.date().optional(),
      ...commonSchemas.pagination
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, vehicleId, page, limit } = req.query;

    // Mock routes data - in real implementation, this would query database
    const mockRoutes = [
      {
        id: 'route-001',
        vehicleId: 'V001',
        status: 'active',
        stopCount: 5,
        estimatedDuration: 180,
        estimatedDistance: 45.2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'route-002',
        vehicleId: 'V002',
        status: 'completed',
        stopCount: 3,
        estimatedDuration: 120,
        estimatedDistance: 28.7,
        actualDuration: 115,
        actualDistance: 26.3,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }
    ];

    // Apply filters
    let filteredRoutes = mockRoutes;
    if (status) {
      filteredRoutes = filteredRoutes.filter(route => route.status === status);
    }
    if (vehicleId) {
      filteredRoutes = filteredRoutes.filter(route => route.vehicleId === vehicleId);
    }

    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedRoutes = filteredRoutes.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        routes: paginatedRoutes,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filteredRoutes.length,
          totalPages: Math.ceil(filteredRoutes.length / Number(limit))
        }
      }
    });
  })
);

/**
 * @route PUT /api/routing/routes/:routeId/status
 * @desc Update route status
 * @access Private - requires routes:write permission
 */
router.put('/routes/:routeId/status',
  requirePermission('routes:write'),
  validateRequest({
    params: Joi.object({
      routeId: Joi.string().required()
    }),
    body: Joi.object({
      status: Joi.string().valid('planned', 'active', 'completed', 'cancelled').required(),
      reason: Joi.string().optional(),
      timestamp: Joi.date().default(new Date())
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { routeId } = req.params;
    const { status, reason, timestamp } = req.body;

    // Mock status update - in real implementation, this would update database
    const updatedRoute = {
      id: routeId,
      status,
      statusUpdatedAt: timestamp,
      statusReason: reason,
      updatedAt: new Date()
    };

    res.json({
      success: true,
      data: updatedRoute,
      message: `Route ${routeId} status updated to ${status}`
    });
  })
);

export { router as routingRoutes };