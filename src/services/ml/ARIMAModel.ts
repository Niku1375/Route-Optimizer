/**
 * ARIMA (AutoRegressive Integrated Moving Average) model for traffic prediction
 * Simplified implementation for time-series forecasting
 */

import { 
  ARIMAModel, 
  ARIMAModelParams, 
  TrafficDataPoint, 
  TrafficPrediction, 
  ModelAccuracy 
} from '../../models/TrafficML';

export class ARIMAModelImpl implements ARIMAModel {
  private modelParams: ARIMAModelParams | null = null;
  private trainingData: TrafficDataPoint[] = [];
  private accuracy: ModelAccuracy | null = null;

  async predict(historicalData: TrafficDataPoint[], forecastHours: number): Promise<TrafficPrediction[]> {
    if (!this.modelParams) {
      // Auto-train if no model exists
      await this.train(historicalData);
    }

    const predictions: TrafficPrediction[] = [];
    const lastDataPoint = historicalData[historicalData.length - 1];
    
    if (!lastDataPoint) {
      throw new Error('No historical data provided for prediction');
    }

    // Extract time series values (congestion levels)
    const timeSeries = historicalData.map(point => point.congestionLevel);
    
    // Generate predictions using ARIMA methodology
    for (let h = 1; h <= forecastHours; h++) {
      const prediction = this.forecastNextValue(timeSeries, h);
      const timestamp = new Date(lastDataPoint.timestamp.getTime() + h * 60 * 60 * 1000);
      
      predictions.push({
        timestamp,
        congestionLevel: this.mapCongestionLevel(prediction.value),
        averageSpeed: this.estimateSpeedFromCongestion(prediction.value),
        confidence: Math.max(0.1, prediction.confidence - (h - 1) * 0.05), // Decrease confidence over time
      });
    }

    return predictions;
  }

  async train(trainingData: TrafficDataPoint[]): Promise<ARIMAModelParams> {
    this.trainingData = [...trainingData];
    
    if (trainingData.length < 24) {
      throw new Error('Insufficient training data. Need at least 24 data points.');
    }

    // Extract time series
    const timeSeries = trainingData.map(point => point.congestionLevel);
    
    // Auto-select ARIMA parameters using simplified approach
    const bestParams = this.selectBestARIMAParams(timeSeries);
    
    // Fit the model
    this.modelParams = this.fitARIMA(timeSeries, bestParams.p, bestParams.d, bestParams.q);
    
    // Calculate model accuracy
    this.accuracy = this.calculateAccuracy(timeSeries);
    
    return this.modelParams;
  }

  getModelAccuracy(): ModelAccuracy {
    if (!this.accuracy) {
      throw new Error('Model has not been trained yet');
    }
    return this.accuracy;
  }

  private selectBestARIMAParams(timeSeries: number[]): { p: number; d: number; q: number } {
    let bestAIC = Infinity;
    let bestParams = { p: 1, d: 1, q: 1 };

    // Grid search for optimal parameters (simplified)
    for (let p = 0; p <= 3; p++) {
      for (let d = 0; d <= 2; d++) {
        for (let q = 0; q <= 3; q++) {
          try {
            const params = this.fitARIMA(timeSeries, p, d, q);
            if (params.aic < bestAIC) {
              bestAIC = params.aic;
              bestParams = { p, d, q };
            }
          } catch (error) {
            // Skip invalid parameter combinations
            continue;
          }
        }
      }
    }

    return bestParams;
  }

  private fitARIMA(timeSeries: number[], p: number, d: number, q: number): ARIMAModelParams {
    // Difference the series d times
    let diffSeries = [...timeSeries];
    for (let i = 0; i < d; i++) {
      diffSeries = this.difference(diffSeries);
    }

    if (diffSeries.length < Math.max(p, q) + 1) {
      throw new Error('Insufficient data after differencing');
    }

    // Fit AR and MA components using least squares (simplified)
    const coefficients = this.estimateCoefficients(diffSeries, p, q);
    const residuals = this.calculateResiduals(diffSeries, coefficients, p, q);
    
    // Calculate information criteria
    const n = diffSeries.length;
    const rss = residuals.reduce((sum, r) => sum + r * r, 0);
    const logLikelihood = -0.5 * n * Math.log(2 * Math.PI * rss / n) - 0.5 * rss / (rss / n);
    const numParams = p + q + 1; // +1 for intercept
    
    const aic = -2 * logLikelihood + 2 * numParams;
    const bic = -2 * logLikelihood + numParams * Math.log(n);

    return {
      p,
      d,
      q,
      coefficients,
      residuals,
      aic,
      bic,
    };
  }

  private difference(series: number[]): number[] {
    const diffed: number[] = [];
    for (let i = 1; i < series.length; i++) {
      const current = series[i];
      const previous = series[i - 1];
      if (current !== undefined && previous !== undefined) {
        diffed.push(current - previous);
      }
    }
    return diffed;
  }

  private estimateCoefficients(series: number[], p: number, q: number): number[] {
    // Simplified coefficient estimation using method of moments
    const coefficients: number[] = [];
    
    // AR coefficients (simplified using autocorrelation)
    for (let i = 1; i <= p; i++) {
      const autocorr = this.calculateAutocorrelation(series, i);
      coefficients.push(autocorr * 0.8); // Damping factor
    }
    
    // MA coefficients (simplified)
    for (let i = 1; i <= q; i++) {
      coefficients.push(0.1 * i); // Simple initialization
    }
    
    return coefficients;
  }

  private calculateAutocorrelation(series: number[], lag: number): number {
    if (lag >= series.length) return 0;
    
    const mean = series.reduce((sum, val) => sum + val, 0) / series.length;
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < series.length - lag; i++) {
      const current = series[i];
      const lagged = series[i + lag];
      if (current !== undefined && lagged !== undefined) {
        numerator += (current - mean) * (lagged - mean);
      }
    }
    
    for (let i = 0; i < series.length; i++) {
      const value = series[i];
      if (value !== undefined) {
        denominator += (value - mean) * (value - mean);
      }
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateResiduals(series: number[], coefficients: number[], p: number, q: number): number[] {
    const residuals: number[] = [];
    const arCoeffs = coefficients.slice(0, p);
    const maCoeffs = coefficients.slice(p, p + q);
    
    for (let t = Math.max(p, q); t < series.length; t++) {
      let predicted = 0;
      
      // AR component
      for (let i = 0; i < p; i++) {
        const coeff = arCoeffs[i];
        const value = series[t - i - 1];
        if (coeff !== undefined && value !== undefined) {
          predicted += coeff * value;
        }
      }
      
      // MA component (simplified)
      for (let i = 0; i < q && i < residuals.length; i++) {
        const coeff = maCoeffs[i];
        const residual = residuals[residuals.length - i - 1];
        if (coeff !== undefined && residual !== undefined) {
          predicted += coeff * residual;
        }
      }
      
      const currentValue = series[t];
      if (currentValue !== undefined) {
          const residual = currentValue - predicted;
        residuals.push(residual);
      }
    }
    
    return residuals;
  }

  private forecastNextValue(timeSeries: number[], horizon: number): { value: number; confidence: number } {
    if (!this.modelParams) {
      throw new Error('Model not trained');
    }

    const { p, d, coefficients } = this.modelParams;
    const arCoeffs = coefficients.slice(0, p);
    
    // Simple forecasting using AR component
    let forecast = 0;
    const recentValues = timeSeries.slice(-p);
    
    for (let i = 0; i < Math.min(p, recentValues.length); i++) {
      const coeff = arCoeffs[i];
      const value = recentValues[recentValues.length - i - 1];
      if (coeff !== undefined && value !== undefined) {
        forecast += coeff * value;
      }
    }
    
    // Add trend component if differencing was used
    if (d > 0) {
      const recentTrend = timeSeries.slice(-2);
      if (recentTrend.length === 2) {
        const recent = recentTrend[1];
        const previous = recentTrend[0];
        if (recent !== undefined && previous !== undefined) {
          forecast += recent - previous;
        }
      }
    }
    
    // Ensure forecast is within valid range
    forecast = Math.max(0, Math.min(3, forecast));
    
    // Calculate confidence (decreases with horizon)
    const baseConfidence = this.accuracy?.accuracy || 0.7;
    const confidence = Math.max(0.1, baseConfidence - (horizon - 1) * 0.05);
    
    return { value: forecast, confidence };
  }

  private calculateAccuracy(timeSeries: number[]): ModelAccuracy {
    if (!this.modelParams || timeSeries.length < 10) {
      return {
        mape: 100,
        rmse: 1,
        mae: 1,
        r2: 0,
        accuracy: 0.5,
      };
    }

    // Use last 20% of data for validation
    const validationSize = Math.floor(timeSeries.length * 0.2);
    const trainingSize = timeSeries.length - validationSize;
    
    const predictions: number[] = [];
    const actuals: number[] = [];
    
    for (let i = trainingSize; i < timeSeries.length; i++) {
      const historicalData = timeSeries.slice(0, i);
      const prediction = this.forecastNextValue(historicalData, 1);
      predictions.push(prediction.value);
      const actual = timeSeries[i];
      if (actual !== undefined) {
        actuals.push(actual);
      }
    }
    
    // Calculate metrics
    const mape = this.calculateMAPE(actuals, predictions);
    const rmse = this.calculateRMSE(actuals, predictions);
    const mae = this.calculateMAE(actuals, predictions);
    const r2 = this.calculateR2(actuals, predictions);
    
    // Overall accuracy (inverse of normalized RMSE)
    const accuracy = Math.max(0, 1 - rmse / 3); // Normalize by max congestion level
    
    return { mape, rmse, mae, r2, accuracy };
  }

  private calculateMAPE(actual: number[], predicted: number[]): number {
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < actual.length; i++) {
      const actualVal = actual[i];
      const predictedVal = predicted[i];
      if (actualVal !== undefined && predictedVal !== undefined && actualVal !== 0) {
        sum += Math.abs((actualVal - predictedVal) / actualVal);
        count++;
      }
    }
    
    return count > 0 ? (sum / count) * 100 : 100;
  }

  private calculateRMSE(actual: number[], predicted: number[]): number {
    const mse = actual.reduce((sum, val, i) => {
      const predictedVal = predicted[i];
      return predictedVal !== undefined ? sum + Math.pow(val - predictedVal, 2) : sum;
    }, 0) / actual.length;
    return Math.sqrt(mse);
  }

  private calculateMAE(actual: number[], predicted: number[]): number {
    return actual.reduce((sum, val, i) => {
      const predictedVal = predicted[i];
      return predictedVal !== undefined ? sum + Math.abs(val - predictedVal) : sum;
    }, 0) / actual.length;
  }

  private calculateR2(actual: number[], predicted: number[]): number {
    const actualMean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
    const totalSumSquares = actual.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
    const residualSumSquares = actual.reduce((sum, val, i) => {
      const predictedVal = predicted[i];
      return predictedVal !== undefined ? sum + Math.pow(val - predictedVal, 2) : sum;
    }, 0);
    
    return totalSumSquares === 0 ? 0 : 1 - (residualSumSquares / totalSumSquares);
  }

  private mapCongestionLevel(value: number): 'low' | 'moderate' | 'high' | 'severe' {
    if (value <= 0.5) return 'low';
    if (value <= 1.5) return 'moderate';
    if (value <= 2.5) return 'high';
    return 'severe';
  }

  private estimateSpeedFromCongestion(congestionLevel: number): number {
    // Delhi typical speeds based on congestion level
    const speedMap = {
      0: 45,    // low congestion
      1: 25,    // moderate congestion
      2: 15,    // high congestion
      3: 8,     // severe congestion
    };
    
    // Linear interpolation between levels
    const lowerLevel = Math.floor(congestionLevel);
    const upperLevel = Math.ceil(congestionLevel);
    const fraction = congestionLevel - lowerLevel;
    
    const lowerSpeed = speedMap[lowerLevel as keyof typeof speedMap] || 25;
    const upperSpeed = speedMap[upperLevel as keyof typeof speedMap] || 25;
    
    return Math.round(lowerSpeed + fraction * (upperSpeed - lowerSpeed));
  }
}