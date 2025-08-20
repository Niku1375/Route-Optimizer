/**
 * Traffic ML Service that integrates ARIMA, Regression, and Pattern Analysis models
 */

import { 
  TrafficMLModels,
  TrafficDataPoint,
  TrafficFeatures,
  TrafficPredictionResult,
  PredictionFactor,
  ModelAccuracy
} from '../../models/TrafficML';
import { TrafficForecast, TrafficPrediction } from '../../models/Traffic';
import { GeoArea } from '../../models/GeoLocation';
import { TimeWindow } from '../../models/Common';

import { ARIMAModelImpl } from './ARIMAModel';
import { RegressionModelImpl } from './RegressionModel';
import { TrafficPatternAnalyzerImpl } from './TrafficPatternAnalyzer';

export class TrafficMLService {
  private models: TrafficMLModels;
  private isInitialized: boolean = false;

  constructor() {
    this.models = {
      arima: new ARIMAModelImpl(),
      regression: new RegressionModelImpl(),
      patternAnalysis: new TrafficPatternAnalyzerImpl(),
    };
  }

  /**
   * Initialize the ML service with historical data
   */
  async initialize(historicalData: TrafficDataPoint[]): Promise<void> {
    if (historicalData.length < 50) {
      throw new Error('Insufficient historical data. Need at least 50 data points for reliable ML models.');
    }

    try {
      // Train ARIMA model
      await this.models.arima.train(historicalData);

      // Prepare regression training data
      const regressionData = this.prepareRegressionTrainingData(historicalData);
      
      // Train linear regression model
      await this.models.regression.trainLinearRegression(regressionData);
      
      // Train polynomial regression model (degree 2)
      await this.models.regression.trainPolynomialRegression(regressionData, 2);

      // Analyze traffic patterns
      this.models.patternAnalysis.analyzeHourlyPatterns(historicalData);
      this.models.patternAnalysis.analyzeDayOfWeekPatterns(historicalData);
      this.models.patternAnalysis.analyzeSeasonalPatterns(historicalData);
      this.models.patternAnalysis.detectCongestionPatterns(historicalData);

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize ML models: ${error}`);
    }
  }

  /**
   * Generate comprehensive traffic forecast using ensemble of models
   */
  async generateTrafficForecast(area: GeoArea, timeWindow: TimeWindow): Promise<TrafficForecast> {
    this.ensureInitialized();

    const predictions: TrafficPrediction[] = [];
    const startTime = timeWindow.earliest.getTime();
    const endTime = timeWindow.latest.getTime();
    const hourlyInterval = 60 * 60 * 1000; // 1 hour

    // Generate predictions for each hour in the time window
    for (let time = startTime; time <= endTime; time += hourlyInterval) {
      const targetTime = new Date(time);
      const prediction = await this.predictTrafficAtTime(area, targetTime);
      predictions.push(prediction);
    }

    // Calculate ensemble confidence
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    return {
      area,
      timeWindow,
      predictions,
      confidence: avgConfidence,
      modelUsed: 'ensemble_ml_models',
    };
  }

  /**
   * Predict traffic for a specific time using ensemble approach
   */
  async predictTrafficAtTime(area: GeoArea, targetTime: Date): Promise<TrafficPrediction> {
    this.ensureInitialized();

    // Get predictions from all models
    const patternPrediction = this.models.patternAnalysis.predictBasedOnPatterns(area, targetTime);
    
    const features = this.extractTrafficFeatures(area, targetTime);
    const regressionPrediction = await this.models.regression.predict(features);

    // For ARIMA, we need historical data - use pattern analysis as proxy
    const arimaPrediction = patternPrediction; // Simplified for now

    // Ensemble prediction using weighted average
    const predictions = [
      { prediction: patternPrediction, weight: 0.4 },
      { prediction: regressionPrediction, weight: 0.4 },
      { prediction: arimaPrediction, weight: 0.2 },
    ];

    const ensemblePrediction = this.combineEnsemblePredictions(predictions, targetTime);
    
    return ensemblePrediction;
  }

  /**
   * Get detailed prediction with factors and model performance
   */
  async getDetailedPrediction(area: GeoArea, targetTime: Date): Promise<TrafficPredictionResult> {
    this.ensureInitialized();

    const prediction = await this.predictTrafficAtTime(area, targetTime);
    const features = this.extractTrafficFeatures(area, targetTime);
    const factors = this.identifyPredictionFactors(features, targetTime);
    
    // Get model accuracies
    const regressionAccuracy = this.models.regression.getModelAccuracy();
    const arimaAccuracy = this.models.arima.getModelAccuracy();
    
    // Calculate ensemble accuracy
    const ensembleAccuracy: ModelAccuracy = {
      mape: (regressionAccuracy.mape + arimaAccuracy.mape) / 2,
      rmse: Math.sqrt((regressionAccuracy.rmse ** 2 + arimaAccuracy.rmse ** 2) / 2),
      mae: (regressionAccuracy.mae + arimaAccuracy.mae) / 2,
      r2: (regressionAccuracy.r2 + arimaAccuracy.r2) / 2,
      accuracy: (regressionAccuracy.accuracy + arimaAccuracy.accuracy) / 2,
    };

    return {
      predictions: [prediction],
      confidence: prediction.confidence,
      modelUsed: 'ensemble_ml_models',
      accuracy: ensembleAccuracy,
      factors,
    };
  }

  /**
   * Update models with new data (online learning simulation)
   */
  async updateModelsWithNewData(newData: TrafficDataPoint[]): Promise<void> {
    this.ensureInitialized();

    if (newData.length === 0) return;

    try {
      // For simplicity, we'll retrain with new data
      // In a production system, this would use incremental learning
      
      // Update pattern analysis (can be done incrementally)
      this.models.patternAnalysis.analyzeHourlyPatterns(newData);
      
      // For ARIMA and regression, we'd need to implement incremental updates
      // For now, we'll just log that new data is available
      console.log(`Received ${newData.length} new data points for model updates`);
      
    } catch (error) {
      console.error('Failed to update models with new data:', error);
    }
  }

  /**
   * Get model performance metrics
   */
  getModelPerformance(): { [modelName: string]: ModelAccuracy } {
    this.ensureInitialized();

    return {
      arima: this.models.arima.getModelAccuracy(),
      regression: this.models.regression.getModelAccuracy(),
    };
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('TrafficMLService must be initialized with historical data before use');
    }
  }

  private prepareRegressionTrainingData(historicalData: TrafficDataPoint[]): any[] {
    return historicalData.map(dataPoint => ({
      features: this.extractTrafficFeatures(dataPoint.area, dataPoint.timestamp, dataPoint),
      target: dataPoint.congestionLevel,
    }));
  }

  private extractTrafficFeatures(area: GeoArea, timestamp: Date, dataPoint?: TrafficDataPoint): TrafficFeatures {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    const month = timestamp.getMonth();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Simplified holiday detection (major Indian holidays)
    const isHoliday = this.isHoliday(timestamp);
    
    // Weather score (0 = bad weather, 1 = good weather)
    let weatherScore = 0.8; // Default good weather
    if (dataPoint?.weatherConditions) {
      const weather = dataPoint.weatherConditions;
      weatherScore = this.calculateWeatherScore(weather);
    }

    // Event impact score (0 = no events, 1 = major events)
    let eventImpactScore = 0.1; // Default minimal impact
    if (dataPoint?.eventFactors && dataPoint.eventFactors.length > 0) {
      eventImpactScore = Math.min(1.0, dataPoint.eventFactors.reduce((sum, event) => sum + event.severity, 0));
    }

    // Historical average for this hour/day combination
    const historicalAverage = this.getHistoricalAverage(hour, dayOfWeek);
    
    // Recent trend (simplified)
    const recentTrend = 0; // Would need time series analysis
    
    // Zone type mapping
    const zoneTypeMap = { residential: 0, commercial: 1, industrial: 2, mixed: 3 };
    const zoneType = zoneTypeMap[area.zoneType] || 3;

    return {
      hourOfDay: hour,
      dayOfWeek,
      month,
      isWeekend,
      isHoliday,
      weatherScore,
      eventImpactScore,
      historicalAverage,
      recentTrend,
      zoneType,
    };
  }

  private calculateWeatherScore(weather: any): number {
    let score = 1.0;
    
    // Reduce score for rain
    if (weather.rainfall > 0) {
      score -= Math.min(0.5, weather.rainfall / 20); // Max 0.5 reduction for heavy rain
    }
    
    // Reduce score for poor visibility
    if (weather.visibility < 10) {
      score -= Math.min(0.3, (10 - weather.visibility) / 20);
    }
    
    // Reduce score for extreme temperatures
    if (weather.temperature > 40 || weather.temperature < 5) {
      score -= 0.1;
    }
    
    return Math.max(0, score);
  }

  private isHoliday(date: Date): boolean {
    // Simplified holiday detection for major Indian holidays
    const month = date.getMonth();
    const day = date.getDate();
    
    // Fixed date holidays
    const fixedHolidays = [
      { month: 0, day: 26 }, // Republic Day
      { month: 7, day: 15 }, // Independence Day
      { month: 9, day: 2 },  // Gandhi Jayanti
    ];
    
    return fixedHolidays.some(holiday => holiday.month === month && holiday.day === day);
  }

  private getHistoricalAverage(hour: number, dayOfWeek: number): number {
    // Simplified historical average based on typical Delhi traffic patterns
    const weekdayPatterns = [1.0, 1.2, 1.5, 2.0, 2.5, 2.8, 2.5, 2.0, 1.8, 1.5, 1.3, 1.2, 1.0, 0.8, 0.6, 0.8, 1.0, 1.5, 2.2, 2.8, 2.5, 2.0, 1.5, 1.2];
    const weekendPatterns = [0.8, 0.6, 0.5, 0.4, 0.4, 0.5, 0.8, 1.2, 1.5, 1.8, 2.0, 2.2, 2.0, 1.8, 1.5, 1.3, 1.2, 1.5, 1.8, 2.0, 1.8, 1.5, 1.2, 1.0];
    
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const patterns = isWeekend ? weekendPatterns : weekdayPatterns;
    
    return patterns[hour] || 1.5;
  }

  private combineEnsemblePredictions(predictions: Array<{ prediction: TrafficPrediction; weight: number }>, targetTime: Date): TrafficPrediction {
    let weightedCongestionSum = 0;
    let weightedSpeedSum = 0;
    let weightedConfidenceSum = 0;
    let totalWeight = 0;

    for (const { prediction, weight } of predictions) {
      const congestionValue = this.congestionLevelToNumber(prediction.congestionLevel);
      
      weightedCongestionSum += congestionValue * weight;
      weightedSpeedSum += prediction.averageSpeed * weight;
      weightedConfidenceSum += prediction.confidence * weight;
      totalWeight += weight;
    }

    const avgCongestion = weightedCongestionSum / totalWeight;
    const avgSpeed = Math.round(weightedSpeedSum / totalWeight);
    const avgConfidence = weightedConfidenceSum / totalWeight;

    return {
      timestamp: targetTime,
      congestionLevel: this.numberToCongestionLevel(avgCongestion),
      averageSpeed: avgSpeed,
      confidence: avgConfidence,
    };
  }

  private identifyPredictionFactors(features: TrafficFeatures, _targetTime: Date): PredictionFactor[] {
    const factors: PredictionFactor[] = [];

    // Time-based factors
    if (features.hourOfDay >= 7 && features.hourOfDay <= 10) {
      factors.push({
        factor: 'Morning Rush Hour',
        impact: 0.8,
        confidence: 0.9,
        description: 'High traffic expected during morning rush hour (7-10 AM)',
      });
    } else if (features.hourOfDay >= 17 && features.hourOfDay <= 20) {
      factors.push({
        factor: 'Evening Rush Hour',
        impact: 0.7,
        confidence: 0.9,
        description: 'High traffic expected during evening rush hour (5-8 PM)',
      });
    }

    // Weekend factor
    if (features.isWeekend) {
      factors.push({
        factor: 'Weekend Traffic',
        impact: -0.3,
        confidence: 0.8,
        description: 'Lower traffic expected on weekends',
      });
    }

    // Weather factor
    if (features.weatherScore < 0.7) {
      factors.push({
        factor: 'Poor Weather Conditions',
        impact: 0.4,
        confidence: 0.7,
        description: 'Adverse weather conditions may increase congestion',
      });
    }

    // Event factor
    if (features.eventImpactScore > 0.5) {
      factors.push({
        factor: 'Special Events',
        impact: features.eventImpactScore,
        confidence: 0.6,
        description: 'Special events in the area may cause additional congestion',
      });
    }

    // Holiday factor
    if (features.isHoliday) {
      factors.push({
        factor: 'Public Holiday',
        impact: -0.5,
        confidence: 0.8,
        description: 'Reduced traffic expected on public holiday',
      });
    }

    return factors;
  }

  private congestionLevelToNumber(level: string): number {
    const mapping = { low: 0, moderate: 1, high: 2, severe: 3 };
    return mapping[level as keyof typeof mapping] || 1;
  }

  private numberToCongestionLevel(value: number): 'low' | 'moderate' | 'high' | 'severe' {
    if (value <= 0.5) return 'low';
    if (value <= 1.5) return 'moderate';
    if (value <= 2.5) return 'high';
    return 'severe';
  }
}