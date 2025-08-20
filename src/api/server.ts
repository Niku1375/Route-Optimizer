import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import Logger from '../utils/logger';
import { createAuthMiddleware } from './middleware/authMiddleware';
import { SecurityService } from '../services/SecurityService';
import { DatabaseService } from '../database/DatabaseService';
import { errorHandler } from './middleware/errorHandler';
import { vehicleRoutes } from './routes/vehicleRoutes';
import { routingRoutes } from './routes/routingRoutes';
import { fleetRoutes } from './routes/fleetRoutes';
import { authRoutes } from './routes/authRoutes';
import { WebSocketHandler } from './websocket/WebSocketHandler';

export class APIServer {
  private app: express.Application;
  private server: any;
  private wss?: WebSocketServer;
  private wsHandler?: WebSocketHandler;
  private securityService: SecurityService;

  constructor() {
    this.app = express();
    const databaseService = new DatabaseService();
    this.securityService = new SecurityService(databaseService);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging
    this.app.use((req, res, next) => {
      Logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/vehicles', createAuthMiddleware(this.securityService), vehicleRoutes);
    this.app.use('/api/routing', createAuthMiddleware(this.securityService), routingRoutes);
    this.app.use('/api/fleet', createAuthMiddleware(this.securityService), fleetRoutes);
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public start(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);
        
        // Setup WebSocket server
        this.wss = new WebSocketServer({ server: this.server });
        this.wsHandler = new WebSocketHandler(this.wss);

        this.server.listen(port, () => {
          Logger.info(`API Server started on port ${port}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          Logger.error('Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          Logger.info('API Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}