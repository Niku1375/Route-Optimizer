/**
 * Monitoring and alerting data models
 */

export interface SystemHealthMetrics {
  timestamp: Date;
  apiResponseTimes: {
    vehicleSearch: number;
    routeOptimization: number;
    fleetManagement: number;
    trafficPrediction: number;
  };
  systemPerformance: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
  externalApiStatus: {
    googleMaps: ApiHealthStatus;
    delhiTrafficPolice: ApiHealthStatus;
    imdWeather: ApiHealthStatus;
    ambeeAirQuality: ApiHealthStatus;
    mapbox: ApiHealthStatus;
    graphHopper: ApiHealthStatus;
  };
  orToolsPerformance: {
    averageSolveTime: number;
    successRate: number;
    fallbackUsage: number;
    constraintViolations: number;
  };
  databasePerformance: {
    connectionPoolSize: number;
    queryResponseTime: number;
    transactionSuccessRate: number;
  };
  cachePerformance: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    responseTime: number;
  };
}

export interface ApiHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastChecked: Date;
  errorRate: number;
  uptime: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownPeriod: number; // minutes
  notificationChannels: string[];
}

export interface AlertCondition {
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  duration: number; // minutes - how long condition must persist
  aggregation: 'avg' | 'max' | 'min' | 'sum' | 'count';
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved' | 'acknowledged';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface SystemFailure {
  id: string;
  component: string;
  type: 'api_failure' | 'solver_failure' | 'database_failure' | 'cache_failure' | 'external_api_failure';
  severity: AlertSeverity;
  message: string;
  stackTrace?: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  impact: {
    affectedServices: string[];
    estimatedDowntime: number;
    userImpact: 'none' | 'low' | 'medium' | 'high';
  };
}

export interface MonitoringConfig {
  healthCheckInterval: number; // seconds
  metricsRetentionPeriod: number; // days
  alertingEnabled: boolean;
  notificationChannels: {
    email: string[];
    slack?: string;
    webhook?: string;
  };
  thresholds: {
    apiResponseTime: number; // ms
    cpuUsage: number; // percentage
    memoryUsage: number; // percentage
    diskUsage: number; // percentage
    errorRate: number; // percentage
    orToolsSolveTime: number; // seconds
  };
}

export interface DashboardMetrics {
  systemOverview: {
    uptime: number;
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
  serviceHealth: {
    vehicleSearch: ServiceHealthSummary;
    routeOptimization: ServiceHealthSummary;
    fleetManagement: ServiceHealthSummary;
    trafficPrediction: ServiceHealthSummary;
  };
  externalDependencies: {
    [key: string]: ApiHealthStatus;
  };
  activeAlerts: Alert[];
  recentFailures: SystemFailure[];
}

export interface ServiceHealthSummary {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  throughput: number;
  lastIncident?: Date;
}