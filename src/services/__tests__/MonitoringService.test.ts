/**
 * Unit tests for MonitoringService
 */

import { MonitoringService } from '../MonitoringService';
import {
  MonitoringConfig,
  AlertSeverity,
  SystemFailure,
  PerformanceMetric
} from '../../models/Monitoring';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockConfig: MonitoringConfig;

  beforeEach(() => {
    mockConfig = {
      healthCheckInterval: 30,
      metricsRetentionPeriod: 7,
      alertingEnabled: true,
      notificationChannels: {
        email: ['admin@example.com'],
        slack: 'https://hooks.slack.com/test',
        webhook: 'https://webhook.example.com'
      },
      thresholds: {
        apiResponseTime: 5000,
        cpuUsage: 80,
        memoryUsage: 85,
        diskUsage: 90,
        errorRate: 5,
        orToolsSolveTime: 10
      }
    };

    monitoringService = new MonitoringService(mockConfig);
  });

  afterEach(() => {
    monitoringService.stop();
  });

  describe('Initialization', () => {
    it('should initialize with default system health metrics', () => {
      const systemHealth = monitoringService.getSystemHealth();
      
      expect(systemHealth).toBeDefined();
      expect(systemHealth.apiResponseTimes).toBeDefined();
      expect(systemHealth.systemPerformance).toBeDefined();
      expect(systemHealth.externalApiStatus).toBeDefined();
      expect(systemHealth.orToolsPerformance).toBeDefined();
      expect(systemHealth.databasePerformance).toBeDefined();
      expect(systemHealth.cachePerformance).toBeDefined();
    });

    it('should initialize default alert rules', () => {
      const dashboardMetrics = monitoringService.getDashboardMetrics();
      
      // Should have initialized without any active alerts initially
      expect(dashboardMetrics.activeAlerts).toHaveLength(0);
    });
  });

  describe('Metric Recording', () => {
    it('should record performance metrics correctly', () => {
      const metricName = 'test.metric';
      const value = 100;
      const unit = 'ms';
      const tags = { service: 'test' };

      monitoringService.recordMetric(metricName, value, unit, tags);

      const metrics = monitoringService.getMetrics(metricName);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe(metricName);
      expect(metrics[0].value).toBe(value);
      expect(metrics[0].unit).toBe(unit);
      expect(metrics[0].tags).toEqual(tags);
    });

    it('should record API response times', () => {
      const endpoint = 'vehicleSearch';
      const responseTime = 1500;

      monitoringService.recordApiResponseTime(endpoint, responseTime);

      const metrics = monitoringService.getMetrics(`api.${endpoint}.response_time`);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(responseTime);
      expect(metrics[0].unit).toBe('ms');
    });

    it('should record OR-Tools performance metrics', () => {
      const solveTime = 5.5;
      const success = true;
      const usedFallback = false;

      monitoringService.recordOrToolsPerformance(solveTime, success, usedFallback);

      const solveTimeMetrics = monitoringService.getMetrics('ortools.solve_time');
      const successMetrics = monitoringService.getMetrics('ortools.success');
      const fallbackMetrics = monitoringService.getMetrics('ortools.fallback_used');

      expect(solveTimeMetrics).toHaveLength(1);
      expect(solveTimeMetrics[0].value).toBe(solveTime);
      expect(successMetrics[0].value).toBe(1);
      expect(fallbackMetrics[0].value).toBe(0);
    });

    it('should limit metric history to 1000 entries', () => {
      const metricName = 'test.overflow';
      
      // Add 1100 metrics
      for (let i = 0; i < 1100; i++) {
        monitoringService.recordMetric(metricName, i, 'count');
      }

      const metrics = monitoringService.getMetrics(metricName, 2000);
      expect(metrics.length).toBeLessThanOrEqual(1000);
      
      // Should keep the most recent metrics
      expect(metrics[metrics.length - 1].value).toBe(1099);
    });
  });

  describe('System Failure Recording', () => {
    it('should record system failures correctly', () => {
      const failureData = {
        component: 'RoutingService',
        type: 'solver_failure' as const,
        severity: 'high' as AlertSeverity,
        message: 'OR-Tools solver timeout',
        impact: {
          affectedServices: ['routing', 'optimization'],
          estimatedDowntime: 300,
          userImpact: 'medium' as const
        }
      };

      monitoringService.recordSystemFailure(failureData);

      const failures = monitoringService.getSystemFailures(false);
      expect(failures).toHaveLength(1);
      expect(failures[0].component).toBe(failureData.component);
      expect(failures[0].type).toBe(failureData.type);
      expect(failures[0].severity).toBe(failureData.severity);
      expect(failures[0].resolved).toBe(false);
    });

    it('should resolve system failures', () => {
      const failureData = {
        component: 'DatabaseService',
        type: 'database_failure' as const,
        severity: 'critical' as AlertSeverity,
        message: 'Connection pool exhausted',
        impact: {
          affectedServices: ['all'],
          estimatedDowntime: 600,
          userImpact: 'high' as const
        }
      };

      monitoringService.recordSystemFailure(failureData);
      const failures = monitoringService.getSystemFailures(false);
      const failureId = failures[0].id;

      monitoringService.resolveSystemFailure(failureId);

      const unresolvedFailures = monitoringService.getSystemFailures(false);
      const resolvedFailures = monitoringService.getSystemFailures(true);

      expect(unresolvedFailures).toHaveLength(0);
      expect(resolvedFailures).toHaveLength(1);
      expect(resolvedFailures[0].resolved).toBe(true);
      expect(resolvedFailures[0].resolvedAt).toBeDefined();
    });

    it('should limit system failures to 100 entries', () => {
      // Add 110 failures
      for (let i = 0; i < 110; i++) {
        monitoringService.recordSystemFailure({
          component: `Service${i}`,
          type: 'api_failure',
          severity: 'low',
          message: `Failure ${i}`,
          impact: {
            affectedServices: [`service${i}`],
            estimatedDowntime: 60,
            userImpact: 'low'
          }
        });
      }

      const allFailures = monitoringService.getSystemFailures(false);
      expect(allFailures.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Alert Management', () => {
    it('should create alerts when thresholds are exceeded', (done) => {
      // Listen for alert events
      monitoringService.on('alert', (alert: any) => {
        expect(alert.severity).toBe('high');
        expect(alert.metric).toBe('api.response_time');
        expect(alert.status).toBe('active');
        done();
      });

      // Record metrics that exceed threshold
      for (let i = 0; i < 10; i++) {
        monitoringService.recordMetric('api.response_time', 6000, 'ms'); // Above 5000ms threshold
      }

      // Trigger health check to evaluate rules
      setTimeout(() => {
        (monitoringService as any).evaluateAlertRules();
      }, 100);
    });

    it('should acknowledge alerts', () => {
      // Create an alert by exceeding threshold
      for (let i = 0; i < 10; i++) {
        monitoringService.recordMetric('system.cpu_usage', 90, '%'); // Above 80% threshold
      }

      (monitoringService as any).evaluateAlertRules();

      const activeAlerts = monitoringService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const alertId = activeAlerts[0].id;
      monitoringService.acknowledgeAlert(alertId, 'admin@example.com');

      // Find the acknowledged alert
      const acknowledgedAlert = activeAlerts.find((alert: any) => alert.id === alertId);
      if (acknowledgedAlert) {
        expect(acknowledgedAlert.status).toBe('acknowledged');
        expect(acknowledgedAlert.acknowledgedBy).toBe('admin@example.com');
        expect(acknowledgedAlert.acknowledgedAt).toBeDefined();
      }
    });

    it('should add and remove custom alert rules', () => {
      const customRule = {
        id: 'custom-rule',
        name: 'Custom Test Rule',
        description: 'Test custom alert rule',
        metric: 'custom.metric',
        condition: {
          operator: 'gt' as const,
          duration: 5,
          aggregation: 'avg' as const
        },
        threshold: 100,
        severity: 'medium' as AlertSeverity,
        enabled: true,
        cooldownPeriod: 10,
        notificationChannels: ['email']
      };

      monitoringService.addAlertRule(customRule);

      // Test that rule was added by triggering it
      for (let i = 0; i < 10; i++) {
        monitoringService.recordMetric('custom.metric', 150, 'units');
      }

      (monitoringService as any).evaluateAlertRules();

      let activeAlerts = monitoringService.getActiveAlerts();
      const customAlert = activeAlerts.find((alert: any) => alert.ruleId === 'custom-rule');
      expect(customAlert).toBeDefined();

      // Remove the rule
      monitoringService.removeAlertRule('custom-rule');

      activeAlerts = monitoringService.getActiveAlerts();
      const removedAlert = activeAlerts.find((alert: any) => alert.ruleId === 'custom-rule');
      expect(removedAlert).toBeUndefined();
    });
  });

  describe('Dashboard Metrics', () => {
    it('should provide comprehensive dashboard metrics', () => {
      // Record some test metrics
      monitoringService.recordMetric('api.response_time', 1000, 'ms');
      monitoringService.recordMetric('system.error_rate', 2, '%');

      const dashboardMetrics = monitoringService.getDashboardMetrics();

      expect(dashboardMetrics.systemOverview).toBeDefined();
      expect(dashboardMetrics.systemOverview.uptime).toBeGreaterThan(0);
      expect(dashboardMetrics.systemOverview.totalRequests).toBeGreaterThanOrEqual(0);
      expect(dashboardMetrics.systemOverview.errorRate).toBeGreaterThanOrEqual(0);
      expect(dashboardMetrics.systemOverview.averageResponseTime).toBeGreaterThanOrEqual(0);

      expect(dashboardMetrics.serviceHealth).toBeDefined();
      expect(dashboardMetrics.serviceHealth.vehicleSearch).toBeDefined();
      expect(dashboardMetrics.serviceHealth.routeOptimization).toBeDefined();
      expect(dashboardMetrics.serviceHealth.fleetManagement).toBeDefined();
      expect(dashboardMetrics.serviceHealth.trafficPrediction).toBeDefined();

      expect(dashboardMetrics.externalDependencies).toBeDefined();
      expect(dashboardMetrics.activeAlerts).toBeDefined();
      expect(dashboardMetrics.recentFailures).toBeDefined();
    });

    it('should calculate service health status correctly', () => {
      // Record good metrics
      monitoringService.recordApiResponseTime('vehicleSearch', 500);
      monitoringService.recordMetric('api.vehicleSearch.error_rate', 1, '%');

      const dashboardMetrics = monitoringService.getDashboardMetrics();
      expect(dashboardMetrics.serviceHealth.vehicleSearch.status).toBe('healthy');

      // Record degraded metrics
      monitoringService.recordApiResponseTime('routeOptimization', 3000);
      monitoringService.recordMetric('api.routeOptimization.error_rate', 7, '%');

      const updatedMetrics = monitoringService.getDashboardMetrics();
      expect(updatedMetrics.serviceHealth.routeOptimization.status).toBe('degraded');

      // Record unhealthy metrics
      monitoringService.recordApiResponseTime('fleetManagement', 8000);
      monitoringService.recordMetric('api.fleetManagement.error_rate', 15, '%');

      const finalMetrics = monitoringService.getDashboardMetrics();
      expect(finalMetrics.serviceHealth.fleetManagement.status).toBe('unhealthy');
    });
  });

  describe('Event Emission', () => {
    it('should emit metric events when recording metrics', (done) => {
      monitoringService.on('metric', (metric: PerformanceMetric) => {
        expect(metric.name).toBe('test.event');
        expect(metric.value).toBe(42);
        done();
      });

      monitoringService.recordMetric('test.event', 42, 'units');
    });

    it('should emit system failure events', (done) => {
      monitoringService.on('systemFailure', (failure: SystemFailure) => {
        expect(failure.component).toBe('TestService');
        expect(failure.type).toBe('api_failure');
        done();
      });

      monitoringService.recordSystemFailure({
        component: 'TestService',
        type: 'api_failure',
        severity: 'medium',
        message: 'Test failure',
        impact: {
          affectedServices: ['test'],
          estimatedDowntime: 120,
          userImpact: 'low'
        }
      });
    });

    it('should emit health check events', (done) => {
      monitoringService.on('healthCheck', (health: any) => {
        expect(health.timestamp).toBeDefined();
        expect(health.systemPerformance).toBeDefined();
        done();
      });

      // Trigger a health check manually
      (monitoringService as any).performHealthCheck();
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should clean up old metrics based on retention period', () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date();

      // Manually add old metrics (simulating passage of time)
      const oldMetric: PerformanceMetric = {
        name: 'test.old',
        value: 100,
        unit: 'ms',
        timestamp: oldDate,
        tags: {}
      };

      const recentMetric: PerformanceMetric = {
        name: 'test.old',
        value: 200,
        unit: 'ms',
        timestamp: recentDate,
        tags: {}
      };

      // Add metrics directly to the internal map
      (monitoringService as any).metrics.set('test.old', [oldMetric, recentMetric]);

      // Clean up old metrics
      monitoringService.cleanupOldMetrics();

      const remainingMetrics = monitoringService.getMetrics('test.old');
      expect(remainingMetrics).toHaveLength(1);
      expect(remainingMetrics[0].timestamp).toEqual(recentDate);
    });

    it('should stop monitoring service cleanly', () => {
      const stopSpy = jest.spyOn(monitoringService, 'stop');
      
      monitoringService.stop();
      
      expect(stopSpy).toHaveBeenCalled();
      
      // Verify that health check interval is cleared
      expect((monitoringService as any).healthCheckInterval).toBeUndefined();
    });
  });

  describe('Alert Rule Evaluation', () => {
    it('should evaluate different aggregation types correctly', () => {
      // Test average aggregation
      const avgRule = {
        id: 'avg-test',
        name: 'Average Test',
        description: 'Test average aggregation',
        metric: 'test.avg',
        condition: {
          operator: 'gt' as const,
          duration: 1,
          aggregation: 'avg' as const
        },
        threshold: 50,
        severity: 'medium' as AlertSeverity,
        enabled: true,
        cooldownPeriod: 5,
        notificationChannels: ['email']
      };

      monitoringService.addAlertRule(avgRule);

      // Add metrics with average > 50
      monitoringService.recordMetric('test.avg', 40, 'units');
      monitoringService.recordMetric('test.avg', 60, 'units');
      monitoringService.recordMetric('test.avg', 70, 'units'); // Average = 56.67

      (monitoringService as any).evaluateAlertRules();

      const activeAlerts = monitoringService.getActiveAlerts();
      const avgAlert = activeAlerts.find((alert: any) => alert.ruleId === 'avg-test');
      expect(avgAlert).toBeDefined();
    });

    it('should evaluate different operators correctly', () => {
      // Test less than operator
      const ltRule = {
        id: 'lt-test',
        name: 'Less Than Test',
        description: 'Test less than operator',
        metric: 'test.lt',
        condition: {
          operator: 'lt' as const,
          duration: 1,
          aggregation: 'max' as const
        },
        threshold: 100,
        severity: 'low' as AlertSeverity,
        enabled: true,
        cooldownPeriod: 5,
        notificationChannels: ['email']
      };

      monitoringService.addAlertRule(ltRule);

      // Add metrics with max < 100
      monitoringService.recordMetric('test.lt', 50, 'units');
      monitoringService.recordMetric('test.lt', 75, 'units');
      monitoringService.recordMetric('test.lt', 80, 'units'); // Max = 80

      (monitoringService as any).evaluateAlertRules();

      const activeAlerts = monitoringService.getActiveAlerts();
      const ltAlert = activeAlerts.find((alert: any) => alert.ruleId === 'lt-test');
      expect(ltAlert).toBeDefined();
    });
  });
});