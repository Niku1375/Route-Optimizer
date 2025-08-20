import request from 'supertest';
import { APIServer } from '../server';


describe('API Server Integration Tests', () => {
  let server: APIServer;
  let app: any;

  beforeAll(async () => {
    server = new APIServer();
    app = server.getApp();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Authentication', () => {
    let authToken: string;

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@logistics.com',
          password: 'admin123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toHaveProperty('email', 'admin@logistics.com');
      
      authToken = response.body.data.accessToken;
    });

    it('should reject invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@logistics.com',
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should register new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          name: 'New User',
          role: 'customer'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('email', 'newuser@test.com');
    });

    it('should refresh access token', async () => {
      // First login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@logistics.com',
          password: 'admin123'
        });

      const refreshToken = loginResponse.body.data.refreshToken;

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    // Store token for subsequent tests
    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@logistics.com',
          password: 'admin123'
        });
      authToken = response.body.data.accessToken;
    });

    describe('Protected Routes', () => {
      it('should reject requests without token', async () => {
        await request(app)
          .get('/api/vehicles/available')
          .expect(401);
      });

      it('should accept requests with valid token', async () => {
        await request(app)
          .get('/api/vehicles/available?latitude=28.6139&longitude=77.2090')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      });
    });
  });

  describe('Vehicle Search API', () => {
    let authToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@logistics.com',
          password: 'admin123'
        });
      authToken = response.body.data.accessToken;
    });

    it('should search for available vehicles', async () => {
      const response = await request(app)
        .post('/api/vehicles/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
          deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
          timeWindow: { start: '09:00', end: '17:00' },
          capacity: { weight: 500, volume: 2 },
          serviceType: 'shared'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('availableVehicles');
      expect(response.body.data).toHaveProperty('alternatives');
    });

    it('should get available vehicles in area', async () => {
      const response = await request(app)
        .get('/api/vehicles/available')
        .query({
          latitude: 28.6139,
          longitude: 77.2090,
          radius: 10,
          page: 1,
          limit: 10
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('vehicles');
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should calculate premium pricing', async () => {
      const response = await request(app)
        .post('/api/vehicles/premium/pricing')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vehicleId: 'V001',
          serviceLevel: 'priority',
          pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
          deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
          timeWindow: { start: '09:00', end: '17:00' }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pricing');
      expect(response.body.data.pricing).toHaveProperty('basePrice');
      expect(response.body.data.pricing).toHaveProperty('premiumMultiplier');
    });

    it('should validate vehicle compliance', async () => {
      const response = await request(app)
        .post('/api/vehicles/compliance/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vehicleId: 'V001',
          route: {
            stops: [
              {
                location: { latitude: 28.6139, longitude: 77.2090 },
                timeWindow: { start: '09:00', end: '10:00' },
                type: 'pickup'
              },
              {
                location: { latitude: 28.7041, longitude: 77.1025 },
                timeWindow: { start: '11:00', end: '12:00' },
                type: 'delivery'
              }
            ]
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isCompliant');
    });

    it('should validate request data', async () => {
      await request(app)
        .post('/api/vehicles/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pickupLocation: { latitude: 'invalid', longitude: 77.2090 },
          deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
          timeWindow: { start: '09:00', end: '17:00' },
          capacity: { weight: 500, volume: 2 }
        })
        .expect(400);
    });
  });

  describe('Routing API', () => {
    let authToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@logistics.com',
          password: 'admin123'
        });
      authToken = response.body.data.accessToken;
    });

    it('should optimize routes', async () => {
      const response = await request(app)
        .post('/api/routing/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vehicles: [
            {
              id: 'V001',
              type: 'van',
              capacity: { weight: 1000, volume: 5 },
              location: { latitude: 28.6139, longitude: 77.2090 }
            }
          ],
          deliveries: [
            {
              id: 'D001',
              pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
              deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
              timeWindow: {
                earliest: new Date().toISOString(),
                latest: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
              },
              shipment: { weight: 500, volume: 2, fragile: false, specialHandling: [] },
              priority: 'medium'
            }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('routes');
      expect(response.body.data).toHaveProperty('totalDistance');
      expect(response.body.data).toHaveProperty('totalDuration');
    });

    it('should validate route', async () => {
      const response = await request(app)
        .post('/api/routing/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          route: {
            id: 'R001',
            vehicleId: 'V001',
            stops: [
              {
                id: 'stop-1',
                location: { latitude: 28.6139, longitude: 77.2090 },
                type: 'pickup',
                timeWindow: { start: '09:00', end: '10:00' }
              }
            ],
            estimatedDuration: 120,
            estimatedDistance: 25.5
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isValid');
    });

    it('should get route by ID', async () => {
      const response = await request(app)
        .get('/api/routing/routes/R001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', 'R001');
    });

    it('should get all routes with pagination', async () => {
      const response = await request(app)
        .get('/api/routing/routes')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('routes');
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should update route status', async () => {
      const response = await request(app)
        .put('/api/routing/routes/R001/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'active',
          reason: 'Route started'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'active');
    });
  });

  describe('Fleet Management API', () => {
    let authToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@logistics.com',
          password: 'admin123'
        });
      authToken = response.body.data.accessToken;
    });

    it('should register new vehicle', async () => {
      const response = await request(app)
        .post('/api/fleet/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          id: 'V999',
          type: 'van',
          subType: 'pickup-van',
          capacity: { weight: 1000, volume: 5 },
          location: { latitude: 28.6139, longitude: 77.2090 },
          vehicleSpecs: {
            plateNumber: 'DL01AB9999',
            fuelType: 'diesel',
            vehicleAge: 2,
            registrationState: 'DL'
          },
          compliance: {
            pollutionCertificate: true,
            pollutionLevel: 'BS6',
            permitValid: true
          },
          driverInfo: {
            id: 'driver-999',
            name: 'Test Driver',
            licenseNumber: 'DL999999999',
            contactNumber: '9999999999'
          }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', 'V999');
    });

    it('should get all vehicles', async () => {
      const response = await request(app)
        .get('/api/fleet/vehicles')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('vehicles');
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should get vehicle by ID', async () => {
      const response = await request(app)
        .get('/api/fleet/vehicles/V001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', 'V001');
    });

    it('should update vehicle status', async () => {
      const response = await request(app)
        .put('/api/fleet/vehicles/V001/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'in-transit',
          reason: 'Started delivery route'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'in-transit');
    });

    it('should update vehicle location', async () => {
      const response = await request(app)
        .put('/api/fleet/vehicles/V001/location')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          location: { latitude: 28.7041, longitude: 77.1025 },
          speed: 45,
          heading: 90
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('location');
      expect(response.body.data.location).toHaveProperty('latitude', 28.7041);
    });

    it('should report vehicle breakdown', async () => {
      const response = await request(app)
        .post('/api/fleet/vehicles/V001/breakdown')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          location: { latitude: 28.6500, longitude: 77.2000 },
          description: 'Engine overheating',
          severity: 'major',
          requiresReplacement: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('breakdownReported', true);
    });

    it('should get buffer vehicles for hub', async () => {
      const response = await request(app)
        .get('/api/fleet/hubs/hub-001/buffer-vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('bufferVehicles');
      expect(response.body.data).toHaveProperty('totalAvailable');
    });

    it('should get fleet metrics', async () => {
      const response = await request(app)
        .get('/api/fleet/metrics')
        .query({ period: 'today' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('fleet');
      expect(response.body.data).toHaveProperty('utilization');
      expect(response.body.data).toHaveProperty('efficiency');
      expect(response.body.data).toHaveProperty('compliance');
    });
  });

  describe('Error Handling', () => {
    let authToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@logistics.com',
          password: 'admin123'
        });
      authToken = response.body.data.accessToken;
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/vehicles/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pickupLocation: { latitude: 'invalid' },
          deliveryLocation: { latitude: 28.7041, longitude: 77.1025 }
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should handle not found errors', async () => {
      await request(app)
        .get('/api/nonexistent-endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle unauthorized access', async () => {
      await request(app)
        .get('/api/vehicles/available?latitude=28.6139&longitude=77.2090')
        .expect(401);
    });

    it('should handle forbidden access', async () => {
      // Login as customer (limited permissions)
      const customerResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'customer@example.com',
          password: 'customer123'
        });

      const customerToken = customerResponse.body.data.accessToken;

      // Try to access fleet management (requires fleet:write permission)
      await request(app)
        .post('/api/fleet/vehicles')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          id: 'V888',
          type: 'van',
          subType: 'pickup-van',
          capacity: { weight: 1000, volume: 5 },
          location: { latitude: 28.6139, longitude: 77.2090 },
          vehicleSpecs: {
            plateNumber: 'DL01AB8888',
            fuelType: 'diesel',
            vehicleAge: 2,
            registrationState: 'DL'
          },
          compliance: {
            pollutionCertificate: true,
            pollutionLevel: 'BS6',
            permitValid: true
          },
          driverInfo: {
            id: 'driver-888',
            name: 'Test Driver',
            licenseNumber: 'DL888888888',
            contactNumber: '8888888888'
          }
        })
        .expect(403);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const promises = Array.from({ length: 110 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });
});