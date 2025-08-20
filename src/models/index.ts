// Core data models for the logistics routing system
export * from './Vehicle';
export * from './Delivery';
export * from './Hub';
export { Route, RouteStop, TrafficFactor, OptimizationMetadata, RouteComplianceValidation, ComplianceViolation, ComplianceWarning, ComplianceExemption, RouteEfficiencyMetrics, RouteOptimizationSuggestion, RouteModel } from './Route';
export * from './GeoLocation';
export * from './Common';
export * from './Traffic';
export * from './TrafficML';
export * from './BusinessMetrics';

// Re-export TrafficPrediction from TrafficML to resolve ambiguity
export type { TrafficPrediction } from './TrafficML';