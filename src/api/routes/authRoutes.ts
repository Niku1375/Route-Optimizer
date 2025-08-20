import { Router } from 'express';
import Joi from 'joi';
import { AuthService } from '../services/AuthService';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const authService = new AuthService();

// Login schema
const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  })
};

// Register schema
const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('admin', 'fleet_manager', 'operator', 'customer').default('customer'),
    name: Joi.string().min(2).max(100).required(),
    organization: Joi.string().max(200).optional()
  })
};

// Refresh token schema
const refreshSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required()
  })
};

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and return JWT tokens
 * @access Public
 */
router.post('/login', 
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    const result = await authService.login(email, password);
    
    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      }
    });
  })
);

/**
 * @route POST /api/auth/register
 * @desc Register new user
 * @access Public
 */
router.post('/register',
  validateRequest(registerSchema),
  asyncHandler(async (req, res) => {
    const userData = req.body;
    
    const result = await authService.register(userData);
    
    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      }
    });
  })
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh',
  validateRequest(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    const result = await authService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn
      }
    });
  })
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user and invalidate tokens
 * @access Public
 */
router.post('/logout',
  validateRequest({
    body: Joi.object({
      refreshToken: Joi.string().required()
    })
  }),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    await authService.logout(refreshToken);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  })
);

export { router as authRoutes };