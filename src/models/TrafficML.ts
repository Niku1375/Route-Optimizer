/**
 * Traditional ML models for traffic prediction
 */

import { GeoArea } from './GeoLocation';



export interface TrafficMLModels {
  arima: ARIMAModel;
  regression: RegressionModel;
  patternAnalysis: TrafficPatternAnalyzer;
}

export interface ARIMAModel {
  predict(historicalData: TrafficDataPoint[], forecastHours: number): Promise<TrafficPrediction[]>;
  train(trainingData: TrafficDataPoint[]): Promise<ARIMAModelParams>;
  getModelAccuracy(): ModelAccuracy;
}

export interface RegressionModel {
  predict(features: TrafficFeatures): Promise<TrafficPrediction>;
  trainLinearRegression(trainingData: TrafficRegressionData[]): Promise<RegressionModelParams>;
  trainPolynomialRegression(trainingData: TrafficRegressionData[], degree: number): Promise<RegressionModelParams>;
  getModelAccuracy(): ModelAccuracy;
}

export interface TrafficPatternAnalyzer {
  analyzeHourlyPatterns(historicalData: TrafficDataPoint[]): HourlyTrafficPattern[];
  analyzeDayOfWeekPatterns(historicalData: TrafficDataPoint[]): DayOfWeekPattern[];
  analyzeSeasonalPatterns(historicalData: TrafficDataPoint[]): SeasonalPattern[];
  detectCongestionPatterns(historicalData: TrafficDataPoint[]): CongestionPattern[];
  predictBasedOnPatterns(area: GeoArea, targetTime: Date): TrafficPrediction;
}

export interface TrafficPrediction {
  timestamp: Date;
  congestionLevel: 'low' | 'moderate' | 'high' | 'severe';
  averageSpeed: number;
  confidence: number;
}

export interface TrafficDataPoint {
  timestamp: Date;
  area: GeoArea;
  congestionLevel: number; // 0-3 (low, moderate, high, severe)
  averageSpeed: number;
  travelTimeMultiplier: number;
  weatherConditions?: WeatherConditions;
  eventFactors?: EventFactor[];
}

export interface TrafficFeatures {
  hourOfDay: number; // 0-23
  dayOfWeek: number; // 0-6 (Sunday = 0)
  month: number; // 0-11
  isWeekend: boolean;
  isHoliday: boolean;
  weatherScore: number; // 0-1 (0 = bad weather, 1 = good weather)
  eventImpactScore: number; // 0-1 (0 = no events, 1 = major events)
  historicalAverage: number;
  recentTrend: number; // -1 to 1 (decreasing to increasing)
  zoneType: number; // 0-3 (residential, commercial, industrial, mixed)
}

export interface TrafficRegressionData {
  features: TrafficFeatures;
  target: number; // congestion level or speed
}

export interface ARIMAModelParams {
  p: number; // autoregressive order
  d: number; // degree of differencing
  q: number; // moving average order
  coefficients: number[];
  residuals: number[];
  aic: number; // Akaike Information Criterion
  bic: number; // Bayesian Information Criterion
}

export interface RegressionModelParams {
  coefficients: number[];
  intercept: number;
  rSquared: number;
  meanSquaredError: number;
  meanAbsoluteError: number;
}

export interface ModelAccuracy {
  mape: number; // Mean Absolute Percentage Error
  rmse: number; // Root Mean Square Error
  mae: number; // Mean Absolute Error
  r2: number; // R-squared
  accuracy: number; // Overall accuracy percentage
}

export interface HourlyTrafficPattern {
  hour: number; // 0-23
  averageCongestion: number;
  standardDeviation: number;
  peakProbability: number; // 0-1
  typicalSpeed: number;
}

export interface DayOfWeekPattern {
  dayOfWeek: number; // 0-6
  dayName: string;
  averageCongestion: number;
  peakHours: number[];
  offPeakHours: number[];
  weekendFactor: number;
}

export interface SeasonalPattern {
  month: number; // 0-11
  monthName: string;
  averageCongestion: number;
  weatherImpactFactor: number;
  holidayImpactFactor: number;
  schoolSeasonFactor: number;
}

export interface CongestionPattern {
  patternType: 'rush_hour' | 'event_based' | 'weather_related' | 'seasonal' | 'random';
  triggerConditions: string[];
  averageDuration: number; // minutes
  severityLevel: number; // 0-3
  affectedAreas: string[];
  mitigationStrategies: string[];
}

export interface WeatherConditions {
  temperature: number;
  rainfall: number;
  visibility: number;
  windSpeed: number;
  conditions: string;
}

export interface EventFactor {
  type: 'accident' | 'construction' | 'event' | 'holiday' | 'school';
  severity: number; // 0-1
  duration: number; // minutes
  location: string;
}

export interface TrafficPredictionResult {
  predictions: TrafficPrediction[];
  confidence: number;
  modelUsed: string;
  accuracy: ModelAccuracy;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  factor: string;
  impact: number; // -1 to 1 (negative to positive impact)
  confidence: number; // 0-1
  description: string;
}