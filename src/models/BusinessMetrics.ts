/**
 * Business metrics and KPI data models
 */

export interface RouteEfficiencyMetrics {
  routeId: string;
  timestamp: Date;
  totalDistance: number; // km
  optimizedDistance: number; // km
  distanceSavings: number; // km
  distanceSavingsPercentage: number; // %
  totalTime: number; // minutes
  optimizedTime: number; // minutes
  timeSavings: number; // minutes
  timeSavingsPercentage: number; // %
  baselineComparison: {
    unoptimizedDistance: number;
    unoptimizedTime: number;
    improvementPercentage: number;
  };
}

export interface FuelSavingsMetrics {
  routeId: string;
  vehicleId: string;
  timestamp: Date;
  fuelType: 'diesel' | 'petrol' | 'cng' | 'electric';
  baselineFuelConsumption: number; // liters or kWh
  optimizedFuelConsumption: number; // liters or kWh
  fuelSavings: number; // liters or kWh
  fuelSavingsPercentage: number; // %
  costSavings: number; // INR
  fuelEfficiencyKmPerLiter: number;
  vehicleCapacityUtilization: number; // %
}

export interface ComplianceMetrics {
  timestamp: Date;
  totalRoutes: number;
  compliantRoutes: number;
  complianceRate: number; // %
  violationsByType: {
    timeRestrictions: number;
    zoneRestrictions: number;
    pollutionViolations: number;
    oddEvenViolations: number;
    weightLimitViolations: number;
    capacityViolations: number;
  };
  violationDetails: ComplianceViolation[];
  complianceByVehicleType: Map<string, number>;
  complianceByZone: Map<string, number>;
}

export interface ComplianceViolation {
  id: string;
  routeId: string;
  vehicleId: string;
  violationType: 'time_restriction' | 'zone_restriction' | 'pollution_violation' | 'odd_even_violation' | 'weight_limit_violation' | 'capacity_violation';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  penaltyCost: number; // INR
  preventedBySystem: boolean;
}

export interface EnvironmentalImpactMetrics {
  timestamp: Date;
  co2Emissions: {
    totalEmissions: number; // kg CO2
    baselineEmissions: number; // kg CO2 without optimization
    co2Savings: number; // kg CO2
    co2SavingsPercentage: number; // %
    emissionsByFuelType: Map<string, number>;
    emissionsByVehicleType: Map<string, number>;
  };
  fuelConsumption: {
    totalFuelConsumed: number; // liters
    baselineFuelConsumption: number; // liters
    fuelSavings: number; // liters
    fuelSavingsPercentage: number; // %
    consumptionByFuelType: Map<string, number>;
    consumptionByVehicleType: Map<string, number>;
  };
  environmentalBenefits: {
    treesEquivalent: number; // CO2 savings expressed as trees planted
    airQualityImprovement: number; // AQI improvement estimate
    noiseReductionBenefit: number; // dB reduction estimate
  };
  sustainabilityScore: number; // 0-100 composite score
}

export interface BusinessKPIs {
  timestamp: Date;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  routeEfficiency: {
    averageEfficiencyImprovement: number; // %
    totalDistanceSaved: number; // km
    totalTimeSaved: number; // minutes
    routesOptimized: number;
    efficiencyTrend: number[]; // Last 30 days
  };
  costSavings: {
    totalFuelCostSavings: number; // INR
    totalOperationalSavings: number; // INR
    averageSavingsPerRoute: number; // INR
    savingsPerKm: number; // INR
    roi: number; // Return on Investment %
  };
  operationalMetrics: {
    totalDeliveries: number;
    onTimeDeliveryRate: number; // %
    vehicleUtilizationRate: number; // %
    hubEfficiencyRate: number; // %
    customerSatisfactionScore: number; // 1-10
  };
  complianceMetrics: {
    overallComplianceRate: number; // %
    violationReductionRate: number; // %
    penaltyCostSavings: number; // INR
    complianceTrend: number[]; // Last 30 days
  };
  environmentalMetrics: {
    totalCO2Saved: number; // kg
    totalFuelSaved: number; // liters
    sustainabilityScore: number; // 0-100
    environmentalTrend: number[]; // Last 30 days
  };
}

export interface MetricsCalculationConfig {
  baselineFuelConsumptionRates: {
    diesel: number; // liters per km
    petrol: number;
    cng: number;
    electric: number; // kWh per km
  };
  co2EmissionFactors: {
    diesel: number; // kg CO2 per liter
    petrol: number;
    cng: number;
    electric: number; // kg CO2 per kWh (grid factor)
  };
  fuelCosts: {
    diesel: number; // INR per liter
    petrol: number;
    cng: number;
    electric: number; // INR per kWh
  };
  compliancePenaltyCosts: {
    timeRestriction: number; // INR
    zoneRestriction: number;
    pollutionViolation: number;
    oddEvenViolation: number;
    weightLimitViolation: number;
    capacityViolation: number;
  };
  efficiencyTargets: {
    minimumEfficiencyImprovement: number; // % (20% as per requirements)
    targetComplianceRate: number; // % (100%)
    targetFuelSavings: number; // %
    targetCO2Reduction: number; // %
  };
}

export interface MetricsReport {
  id: string;
  title: string;
  period: {
    start: Date;
    end: Date;
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  };
  generatedAt: Date;
  summary: BusinessKPIs;
  detailedMetrics: {
    routeEfficiency: RouteEfficiencyMetrics[];
    fuelSavings: FuelSavingsMetrics[];
    compliance: ComplianceMetrics;
    environmentalImpact: EnvironmentalImpactMetrics;
  };
  insights: {
    topPerformingRoutes: string[];
    areasForImprovement: string[];
    complianceIssues: string[];
    costSavingOpportunities: string[];
    environmentalHighlights: string[];
  };
  recommendations: {
    operationalImprovements: string[];
    complianceActions: string[];
    sustainabilityInitiatives: string[];
    costOptimizations: string[];
  };
}

export interface MetricsAggregation {
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  aggregationType: 'sum' | 'average' | 'max' | 'min' | 'count';
  metricName: string;
  value: number;
  timestamp: Date;
}

export interface BenchmarkComparison {
  metric: string;
  currentValue: number;
  benchmarkValue: number;
  industryAverage: number;
  performanceRating: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  improvementPotential: number; // %
}