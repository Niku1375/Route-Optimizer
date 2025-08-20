import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Logger from '../../utils/logger';
import { UnauthorizedError, ValidationError } from '../middleware/errorHandler';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organization?: string;
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
}

export interface LoginResult {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: string;
  organization?: string;
}

export class AuthService {
  private users: Map<string, User & { password: string }> = new Map();
  private refreshTokens: Set<string> = new Set();
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';
  private readonly ACCESS_TOKEN_EXPIRY = '1h';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  constructor() {
    // Initialize with default admin user for demo
    this.initializeDefaultUsers();
  }

  private initializeDefaultUsers(): void {
    const defaultUsers = [
      {
        id: 'admin-001',
        email: 'admin@logistics.com',
        password: bcrypt.hashSync('admin123', 10),
        name: 'System Administrator',
        role: 'admin',
        organization: 'Logistics Corp',
        permissions: ['*'],
        createdAt: new Date()
      },
      {
        id: 'fleet-001',
        email: 'fleet@logistics.com',
        password: bcrypt.hashSync('fleet123', 10),
        name: 'Fleet Manager',
        role: 'fleet_manager',
        organization: 'Logistics Corp',
        permissions: ['fleet:read', 'fleet:write', 'vehicles:read', 'vehicles:write', 'routes:read'],
        createdAt: new Date()
      },
      {
        id: 'customer-001',
        email: 'customer@example.com',
        password: bcrypt.hashSync('customer123', 10),
        name: 'Demo Customer',
        role: 'customer',
        organization: 'Demo Corp',
        permissions: ['vehicles:search', 'routes:request'],
        createdAt: new Date()
      }
    ];

    defaultUsers.forEach(user => {
      this.users.set(user.email, user);
    });

    Logger.info('Default users initialized', { 
      userCount: defaultUsers.length,
      roles: defaultUsers.map(u => u.role)
    });
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = this.users.get(email.toLowerCase());
    
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login
    user.lastLogin = new Date();

    const tokens = this.generateTokens(user);
    this.refreshTokens.add(tokens.refreshToken);

    Logger.info('User logged in', { userId: user.id, email: user.email, role: user.role });

    return {
      user: this.sanitizeUser(user),
      ...tokens
    };
  }

  async register(userData: RegisterData): Promise<LoginResult> {
    const existingUser = this.users.get(userData.email.toLowerCase());
    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newUser = {
      id: userId,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      name: userData.name,
      role: userData.role,
      organization: userData.organization,
      permissions: this.getPermissionsForRole(userData.role),
      createdAt: new Date(),
      lastLogin: new Date()
    };

    this.users.set(newUser.email, newUser);

    const tokens = this.generateTokens(newUser);
    this.refreshTokens.add(tokens.refreshToken);

    Logger.info('User registered', { userId: newUser.id, email: newUser.email, role: newUser.role });

    return {
      user: this.sanitizeUser(newUser),
      ...tokens
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    if (!this.refreshTokens.has(refreshToken)) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as any;
      const user = this.users.get(decoded.email);
      
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const accessToken = this.generateAccessToken(user);
      
      return {
        accessToken,
        expiresIn: 3600 // 1 hour
      };
    } catch (error) {
      this.refreshTokens.delete(refreshToken);
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    this.refreshTokens.delete(refreshToken);
    Logger.info('User logged out');
  }

  private generateTokens(user: User & { password: string }): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600 // 1 hour
    };
  }

  private generateAccessToken(user: User & { password: string }): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      },
      this.JWT_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  }

  private getPermissionsForRole(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      fleet_manager: [
        'fleet:read', 'fleet:write',
        'vehicles:read', 'vehicles:write',
        'routes:read', 'routes:write',
        'hubs:read', 'hubs:write'
      ],
      operator: [
        'vehicles:read',
        'routes:read',
        'fleet:read'
      ],
      customer: [
        'vehicles:search',
        'routes:request',
        'loyalty:read'
      ]
    };

    return rolePermissions[role] || ['vehicles:search'];
  }

  private sanitizeUser(user: User & { password: string }): Omit<User, 'password'> {
    const { ...sanitizedUser } = user;
    return sanitizedUser;
  }
}