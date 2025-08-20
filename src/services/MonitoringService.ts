/**
 * System monitoring service for API response times, system health, and alerting
 */

import { EventEmitter } from 'events';
import {
  SystemHealthMetrics,
  ApiHealthStatus,
  Alert,
  AlertRule,
  SystemFailure,
  PerformanceMetric,
  MonitoringConfig,
  DashboardMetrics,
  ServiceHealthSummary
} from '../models/Monitoring';
import Logger from '../utils/logger';

export class MonitoringService extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private systemFailures: SystemFailure[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private config: MonitoringConfig;
  private systemHealth: SystemHealthMetrics;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.systemHealth = this.initializeSystemHealth();
    this.initializeDefaultAlertRules();
    this.startHealthChecks();
  }

  /**
   * Initialize system health metrics with default values
   */
  private initializeSystemHealth(): SystemHealthMetrics {
    return {
      timestamp: new Date(),
      apiResponseTimes: {
        vehicleSearch: 0,
        routeOptimization: 0,
        fleetManagement: 0,
        trafficPrediction: 0
      },
      systemPerformance: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkLatency: 0
      },
      externalApiStatus: {
        googleMaps: this.createDefaultApiStatus(),
        mapmyindia: this.createDefaultApiStatus(),
        openWeatherMap: this.createDefaultApiStatus(),
        ambeeAirQuality: this.createDefaultApiStatus(),
        mapbox: this.createDefaultApiStatus(),
        graphHopper: this.createDefaultApiStatus()
      },
      orToolsPerformance: {
        averageSolveTime: 0,
        successRate: 100,
        fallbackUsage: 0,
        constraintViolations: 0
      },
      databasePerformance: {
        connectionPoolSize: 0,
        queryResponseTime: 0,
        transactionSuccessRate: 100
      },
      cachePerformance: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        responseTime: 0
      }
    };
  }

  /**
   * Create default API health status
   */
  private createDefaultApiStatus(): ApiHealthStatus {
    return {
      status: 'unknown',
      responseTime: 0,
      lastChecked: new Date(),
      errorRate: 0,
      uptime: 100
    };
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'api-response-time-high',
        name: 'High API Response Time',
        description: 'API response time exceeds threshold',
        metric: 'api.response_time',
        condition: {
          operator: 'gt',
          duration: 5,
          aggregation: 'avg'
        },
        threshold: this.config.thresholds.apiResponseTime,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 10,
        notificationChannels: ['email']
      },
      {
        id: 'cpu-usage-high',
        name: 'High CPU Usage',
        description: 'System CPU usage is critically high',
        metric: 'system.cpu_usage',
        condition: {
          operator: 'gt',
          duration: 3,
          aggregation: 'avg'
        },
        threshold: this.config.thresholds.cpuUsage,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5,
        notificationChannels: ['email', 'slack']
      },
      {
        id: 'memory-usage-high',
        name: 'High Memory Usage',
        description: 'System memory usage is critically high',
        metric: 'system.memory_usage',
        condition: {
          operator: 'gt',
          duration: 3,
          aggregation: 'avg'
        },
        threshold: this.config.thresholds.memoryUsage,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5,
        notificationChannels: ['email', 'slack']
      },
      {
        id: 'ortools-solve-time-high',
        name: 'OR-Tools Solve Time High',
        description: 'OR-Tools solver taking too long',
        metric: 'ortools.solve_time',
        condition: {
          operator: 'gt',
          duration: 2,
          aggregation: 'avg'
        },
        threshold: this.config.thresholds.orToolsSolveTime,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 15,
        notificationChannels: ['email']
      },
      {
        id: 'error-rate-high',
        name: 'High Error Rate',
        description: 'System error rate is above acceptable threshold',
        metric: 'system.error_rate',
        condition: {
          operator: 'gt',
          duration: 5,
          aggregation: 'avg'
        },
        threshold: this.config.thresholds.errorRate,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 10,
        notificationChannels: ['email', 'slack']
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    Logger.info('Initialized default alert rules', { count: defaultRules.length });
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        Logger.error('Health check failed', error as Error);
      }
    }, this.config.healthCheckInterval * 1000);

    Logger.info('Started health check monitoring', { 
      interval: this.config.healthCheckInterval 
    });
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    this.systemHealth.timestamp = new Date();
    
    // Update system performance metrics
    await this.updateSystemPerformance();
    
    // Check external API health
    await this.checkExternalApiHealth();
    
    // Evaluate alert rules
    this.evaluateAlertRules();
    
    // Emit health check event
    this.emit('healthCheck', this.systemHealth);
  }

  /**
   * Update system performance metrics
   */
  private async updateSystemPerformance(): Promise<void> {
    try {
      // Get system metrics (simplified implementation)
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.systemHealth.systemPerformance = {
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage approximation
        memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        diskUsage: 0, // Would need additional library for disk usage
        networkLatency: 0 // Would need network ping implementation
      };

      // Record metrics
      this.recordMetric('system.cpu_usage', this.systemHealth.systemPerformance.cpuUsage, '%');
      this.recordMetric('system.memory_usage', this.systemHealth.systemPerformance.memoryUsage, '%');
      
    } catch (error) {
      Logger.error('Failed to update system performance metrics', error as Error);
    }
  }

  /**
   * Check external API health
   */
  private async checkExternalApiHealth(): Promise<void> {
    const apis = Object.keys(this.systemHealth.externalApiStatus);
    
    for (const apiName of apis) {
      try {
        // Simulate API health check (in real implementation, would make actual HTTP calls)
        const isHealthy = Math.random() > 0.1; // 90% uptime simulation
        const responseTime = Math.random() * 1000 + 100; // 100-1100ms
        
        const status: ApiHealthStatus = {
          status: isHealthy ? 'healthy' : 'degraded',
          responseTime,
          lastChecked: new Date(),
          errorRate: isHealthy ? 0 : Math.random() * 10,
          uptime: isHealthy ? 100 : 95
        };

        this.systemHealth.externalApiStatus[apiName as keyof typeof this.systemHealth.externalApiStatus] = status;
        
        // Record API response time metric
        this.recordMetric(`api.${apiName}.response_time`, responseTime, 'ms');
        
      } catch (error) {
        Logger.error(`Failed to check health for API: ${apiName}`, error as Error);
        
        this.systemHealth.externalApiStatus[apiName as keyof typeof this.systemHealth.externalApiStatus] = {
          status: 'unhealthy',
          responseTime: 0,
          lastChecked: new Date(),
          errorRate: 100,
          uptime: 0
        };
      }
    }
  }

  /**
   * Record a performance metric
   */
  public recordMetric(name: string, value: number, unit: string, tags: Record<string, string> = {}): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only recent metrics (last 1000 entries)
    if (metricHistory.length > 1000) {
      metricHistory.shift();
    }

    // Emit metric event
    this.emit('metric', metric);
  }

  /**
   * Record API response time
   */
  public recordApiResponseTime(endpoint: string, responseTime: number): void {
    this.recordMetric(`api.${endpoint}.response_time`, responseTime, 'ms');
    
    // Update system health
    if (endpoint in this.systemHealth.apiResponseTimes) {
      (this.systemHealth.apiResponseTimes as any)[endpoint] = responseTime;
    }
  }

  /**
   * Record OR-Tools solver performance
   */
  public recordOrToolsPerformance(solveTime: number, success: boolean, usedFallback: boolean): void {
    this.recordMetric('ortools.solve_time', solveTime, 'seconds');
    this.recordMetric('ortools.success', success ? 1 : 0, 'boolean');
    this.recordMetric('ortools.fallback_used', usedFallback ? 1 : 0, 'boolean');

    // Update aggregated metrics
    const recentMetrics = this.getRecentMetrics('ortools.solve_time', 10);
    if (recentMetrics.length > 0) {
      this.systemHealth.orToolsPerformance.averageSolveTime = 
        recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
    }

    const successMetrics = this.getRecentMetrics('ortools.success', 100);
    if (successMetrics.length > 0) {
      this.systemHealth.orToolsPerformance.successRate = 
        (successMetrics.reduce((sum, m) => sum + m.value, 0) / successMetrics.length) * 100;
    }
  }

  /**
   * Record system failure
   */
  public recordSystemFailure(failure: Omit<SystemFailure, 'id' | 'timestamp' | 'resolved'>): void {
    const systemFailure: SystemFailure = {
      ...failure,
      id: `failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false
    };

    this.systemFailures.push(systemFailure);

    // Keep only recent failures (last 100)
    if (this.systemFailures.length > 100) {
      this.systemFailures.shift();
    }

    Logger.error('System failure recorded', undefined, { failure: systemFailure });

    // Create alert for system failure
    this.createAlert({
      ruleId: 'system-failure',
      severity: failure.severity,
      title: `System Failure: ${failure.component}`,
      description: failure.message,
      metric: 'system.failure',
      currentValue: 1,
      threshold: 0
    });

    this.emit('systemFailure', systemFailure);
  }

  /**
   * Evaluate alert rules against current metrics
   */
  private evaluateAlertRules(): void {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = this.evaluateAlertRule(rule);
        
        if (shouldAlert && !this.alerts.has(ruleId)) {
          // Create new alert
          const currentValue = this.getCurrentMetricValue(rule.metric);
          this.createAlert({
            ruleId: rule.id,
            severity: rule.severity,
            title: rule.name,
            description: rule.description,
            metric: rule.metric,
            currentValue,
            threshold: rule.threshold
          });
        } else if (!shouldAlert && this.alerts.has(ruleId)) {
          // Resolve existing alert
          this.resolveAlert(ruleId);
        }
      } catch (error) {
        Logger.error(`Failed to evaluate alert rule: ${rule.name}`, error as Error);
      }
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private evaluateAlertRule(rule: AlertRule): boolean {
    const recentMetrics = this.getRecentMetrics(rule.metric, rule.condition.duration * 60); // Convert minutes to seconds
    
    if (recentMetrics.length === 0) return false;

    let aggregatedValue: number;
    
    switch (rule.condition.aggregation) {
      case 'avg':
        aggregatedValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
        break;
      case 'max':
        aggregatedValue = Math.max(...recentMetrics.map(m => m.value));
        break;
      case 'min':
        aggregatedValue = Math.min(...recentMetrics.map(m => m.value));
        break;
      case 'sum':
        aggregatedValue = recentMetrics.reduce((sum, m) => sum + m.value, 0);
        break;
      case 'count':
        aggregatedValue = recentMetrics.length;
        break;
      default:
        aggregatedValue = recentMetrics[recentMetrics.length - 1].value;
    }

    switch (rule.condition.operator) {
      case 'gt':
        return aggregatedValue > rule.threshold;
      case 'gte':
        return aggregatedValue >= rule.threshold;
      case 'lt':
        return aggregatedValue < rule.threshold;
      case 'lte':
        return aggregatedValue <= rule.threshold;
      case 'eq':
        return aggregatedValue === rule.threshold;
      default:
        return false;
    }
  }

  /**
   * Get recent metrics for a given metric name
   */
  private getRecentMetrics(metricName: string, durationSeconds: number): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName) || [];
    const cutoffTime = new Date(Date.now() - durationSeconds * 1000);
    
    return metrics.filter(metric => metric.timestamp >= cutoffTime);
  }

  /**
   * Get current value for a metric
   */
  private getCurrentMetricValue(metricName: string): number {
    const metrics = this.metrics.get(metricName) || [];
    return metrics.length > 0 ? metrics[metrics.length - 1].value : 0;
  }

  /**
   * Create a new alert
   */
  private createAlert(alertData: Omit<Alert, 'id' | 'triggeredAt' | 'status'>): void {
    const alert: Alert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      triggeredAt: new Date(),
      status: 'active'
    };

    this.alerts.set(alertData.ruleId, alert);

    Logger.warn('Alert triggered', undefined, { alert });

    // Send notifications
    this.sendAlertNotifications(alert);

    this.emit('alert', alert);
  }

  /**
   * Resolve an alert
   */
  private resolveAlert(ruleId: string): void {
    const alert = this.alerts.get(ruleId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();

      Logger.info('Alert resolved', undefined, { alertId: alert.id });

      this.emit('alertResolved', alert);
    }
  }

  /**
   * Send alert notifications
   */
  private sendAlertNotifications(alert: Alert): void {
    const rule = this.alertRules.get(alert.ruleId);
    if (!rule) return;

    // In a real implementation, this would send actual notifications
    // For now, just log the notification
    Logger.info('Alert notification sent', undefined, {
      alert: alert.id,
      channels: rule.notificationChannels,
      severity: alert.severity
    });
  }

  /**
   * Get current system health metrics
   */
  public getSystemHealth(): SystemHealthMetrics {
    return { ...this.systemHealth };
  }

  /**
   * Get dashboard metrics
   */
  public getDashboardMetrics(): DashboardMetrics {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Calculate system overview metrics
    const recentApiMetrics = this.getMetricsSince('api.response_time', oneHourAgo);
    const recentErrorMetrics = this.getMetricsSince('system.error_rate', oneHourAgo);

    const systemOverview = {
      uptime: this.calculateUptime(),
      totalRequests: recentApiMetrics.length,
      errorRate: recentErrorMetrics.length > 0 ? 
        recentErrorMetrics.reduce((sum, m) => sum + m.value, 0) / recentErrorMetrics.length : 0,
      averageResponseTime: recentApiMetrics.length > 0 ?
        recentApiMetrics.reduce((sum, m) => sum + m.value, 0) / recentApiMetrics.length : 0
    };

    // Get service health summaries
    const serviceHealth = {
      vehicleSearch: this.getServiceHealthSummary('vehicleSearch'),
      routeOptimization: this.getServiceHealthSummary('routeOptimization'),
      fleetManagement: this.getServiceHealthSummary('fleetManagement'),
      trafficPrediction: this.getServiceHealthSummary('trafficPrediction')
    };

    return {
      systemOverview,
      serviceHealth,
      externalDependencies: this.systemHealth.externalApiStatus,
      activeAlerts: Array.from(this.alerts.values()).filter(alert => alert.status === 'active'),
      recentFailures: this.systemFailures.filter(failure => !failure.resolved).slice(-10)
    };
  }

  /**
   * Get metrics since a specific date
   */
  private getMetricsSince(metricName: string, since: Date): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName) || [];
    return metrics.filter(metric => metric.timestamp >= since);
  }

  /**
   * Calculate system uptime percentage
   */
  private calculateUptime(): number {
    // Simplified uptime calculation
    const recentFailures = this.systemFailures.filter(
      failure => failure.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    return Math.max(0, 100 - (recentFailures * 5)); // Each failure reduces uptime by 5%
  }

  /**
   * Get service health summary
   */
  private getServiceHealthSummary(serviceName: string): ServiceHealthSummary {
    const responseTimeMetrics = this.getRecentMetrics(`api.${serviceName}.response_time`, 3600);
    const errorMetrics = this.getRecentMetrics(`api.${serviceName}.error_rate`, 3600);

    const avgResponseTime = responseTimeMetrics.length > 0 ?
      responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length : 0;

    const errorRate = errorMetrics.length > 0 ?
      errorMetrics.reduce((sum, m) => sum + m.value, 0) / errorMetrics.length : 0;

    const throughput = responseTimeMetrics.length; // Simplified throughput calculation

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 10 || avgResponseTime > 5000) {
      status = 'unhealthy';
    } else if (errorRate > 5 || avgResponseTime > 2000) {
      status = 'degraded';
    }

    return {
      status,
      responseTime: avgResponseTime,
      errorRate,
      throughput,
      lastIncident: this.getLastIncidentDate(serviceName)
    };
  }

  /**
   * Get last incident date for a service
   */
  private getLastIncidentDate(serviceName: string): Date | undefined {
    const serviceFailures = this.systemFailures.filter(
      failure => failure.component.toLowerCase().includes(serviceName.toLowerCase())
    );

    return serviceFailures.length > 0 ? 
      serviceFailures[serviceFailures.length - 1].timestamp : undefined;
  }

  /**
   * Add custom alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    Logger.info('Alert rule added', undefined, { ruleId: rule.id, name: rule.name });
  }

  /**
   * Remove alert rule
   */
  public removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    
    // Resolve any active alerts for this rule
    if (this.alerts.has(ruleId)) {
      this.resolveAlert(ruleId);
      this.alerts.delete(ruleId);
    }

    Logger.info('Alert rule removed', undefined, { ruleId });
  }

  /**
   * Get all active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.status === 'active');
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    for (const alert of this.alerts.values()) {
      if (alert.id === alertId) {
        alert.status = 'acknowledged';
        alert.acknowledgedBy = acknowledgedBy;
        alert.acknowledgedAt = new Date();

        Logger.info('Alert acknowledged', undefined, { 
          alertId, 
          acknowledgedBy 
        });

        this.emit('alertAcknowledged', alert);
        break;
      }
    }
  }

  /**
   * Get system failures
   */
  public getSystemFailures(resolved: boolean = false): SystemFailure[] {
    return this.systemFailures.filter(failure => failure.resolved === resolved);
  }

  /**
   * Mark system failure as resolved
   */
  public resolveSystemFailure(failureId: string): void {
    const failure = this.systemFailures.find(f => f.id === failureId);
    if (failure) {
      failure.resolved = true;
      failure.resolvedAt = new Date();

      Logger.info('System failure resolved', undefined, { failureId });

      this.emit('systemFailureResolved', failure);
    }
  }

  /**
   * Stop monitoring service
   */
  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    Logger.info('Monitoring service stopped');
  }

  /**
   * Get metrics for a specific metric name
   */
  public getMetrics(metricName: string, limit: number = 100): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName) || [];
    return metrics.slice(-limit);
  }

  /**
   * Clear old metrics based on retention period
   */
  public cleanupOldMetrics(): void {
    const cutoffDate = new Date(Date.now() - this.config.metricsRetentionPeriod * 24 * 60 * 60 * 1000);
    
    for (const [metricName, metrics] of this.metrics) {
      const filteredMetrics = metrics.filter(metric => metric.timestamp >= cutoffDate);
      this.metrics.set(metricName, filteredMetrics);
    }

    // Clean up old system failures
    this.systemFailures = this.systemFailures.filter(failure => failure.timestamp >= cutoffDate);

    Logger.info('Old metrics cleaned up', undefined, { cutoffDate });
  }
}