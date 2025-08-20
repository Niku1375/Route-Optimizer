/**
 * Regression models for traffic prediction using traditional ML approaches
 */

import { 
  RegressionModel, 
  RegressionModelParams, 
  TrafficFeatures, 
  TrafficPrediction, 
  TrafficRegressionData,
  ModelAccuracy 
} from '../../models/TrafficML';

export class RegressionModelImpl implements RegressionModel {
  private linearModel: RegressionModelParams | null = null;
  private polynomialModel: RegressionModelParams | null = null;
  private polynomialDegree: number = 2;
  private trainingData: TrafficRegressionData[] = [];
  private accuracy: ModelAccuracy | null = null;

  async predict(features: TrafficFeatures): Promise<TrafficPrediction> {
    if (!this.linearModel && !this.polynomialModel) {
      throw new Error('No trained model available. Train a model first.');
    }

    // Use polynomial model if available, otherwise linear
    const model = this.polynomialModel || this.linearModel!;
    const featureVector = this.extractFeatureVector(features);
    
    let prediction: number;
    
    if (this.polynomialModel) {
      prediction = this.predictPolynomial(featureVector, model);
    } else {
      prediction = this.predictLinear(featureVector, model);
    }

    // Ensure prediction is within valid range
    prediction = Math.max(0, Math.min(3, prediction));

    return {
      timestamp: new Date(), // Current time for immediate prediction
      congestionLevel: this.mapCongestionLevel(prediction),
      averageSpeed: this.estimateSpeedFromCongestion(prediction),
      confidence: this.calculatePredictionConfidence(features, prediction),
    };
  }

  async trainLinearRegression(trainingData: TrafficRegressionData[]): Promise<RegressionModelParams> {
    this.trainingData = [...trainingData];
    
    if (trainingData.length < 10) {
      throw new Error('Insufficient training data. Need at least 10 samples.');
    }

    // Prepare feature matrix and target vector
    const X = trainingData.map(data => this.extractFeatureVector(data.features));
    const y = trainingData.map(data => data.target);

    // Add bias term (intercept)
    const XWithBias = X.map(row => [1, ...row]);

    // Solve using normal equation: β = (X^T * X)^(-1) * X^T * y
    const coefficients = this.solveNormalEquation(XWithBias, y);
    
    // Calculate model metrics
    const predictions = XWithBias.map(row => this.dotProduct(row, coefficients));
    const metrics = this.calculateRegressionMetrics(y, predictions);

    this.linearModel = {
      coefficients: coefficients.slice(1), // Remove bias term
      intercept: coefficients[0],
      rSquared: metrics.r2,
      meanSquaredError: metrics.mse,
      meanAbsoluteError: metrics.mae,
    };

    this.accuracy = this.calculateModelAccuracy(y, predictions);

    return this.linearModel;
  }

  async trainPolynomialRegression(trainingData: TrafficRegressionData[], degree: number): Promise<RegressionModelParams> {
    this.trainingData = [...trainingData];
    this.polynomialDegree = degree;
    
    if (trainingData.length < degree * 2) {
      throw new Error(`Insufficient training data. Need at least ${degree * 2} samples for degree ${degree}.`);
    }

    // Prepare polynomial feature matrix
    const X = trainingData.map(data => this.extractPolynomialFeatures(data.features, degree));
    const y = trainingData.map(data => data.target);

    // Add bias term
    const XWithBias = X.map(row => [1, ...row]);

    // Solve using normal equation with regularization to prevent overfitting
    const coefficients = this.solveRegularizedNormalEquation(XWithBias, y, 0.01);
    
    // Calculate model metrics
    const predictions = XWithBias.map(row => this.dotProduct(row, coefficients));
    const metrics = this.calculateRegressionMetrics(y, predictions);

    this.polynomialModel = {
      coefficients: coefficients.slice(1),
      intercept: coefficients[0],
      rSquared: metrics.r2,
      meanSquaredError: metrics.mse,
      meanAbsoluteError: metrics.mae,
    };

    this.accuracy = this.calculateModelAccuracy(y, predictions);

    return this.polynomialModel;
  }

  getModelAccuracy(): ModelAccuracy {
    if (!this.accuracy) {
      throw new Error('No trained model available');
    }
    return this.accuracy;
  }

  private extractFeatureVector(features: TrafficFeatures): number[] {
    return [
      features.hourOfDay / 23,           // Normalize to 0-1
      features.dayOfWeek / 6,            // Normalize to 0-1
      features.month / 11,               // Normalize to 0-1
      features.isWeekend ? 1 : 0,        // Binary
      features.isHoliday ? 1 : 0,        // Binary
      features.weatherScore,             // Already 0-1
      features.eventImpactScore,         // Already 0-1
      features.historicalAverage / 3,    // Normalize to 0-1
      (features.recentTrend + 1) / 2,    // Normalize -1,1 to 0-1
      features.zoneType / 3,             // Normalize to 0-1
    ];
  }

  private extractPolynomialFeatures(features: TrafficFeatures, degree: number): number[] {
    const baseFeatures = this.extractFeatureVector(features);
    const polynomialFeatures: number[] = [...baseFeatures];

    // Add polynomial terms
    for (let d = 2; d <= degree; d++) {
      for (let i = 0; i < baseFeatures.length; i++) {
        polynomialFeatures.push(Math.pow(baseFeatures[i], d));
      }
    }

    // Add interaction terms for degree 2+
    if (degree >= 2) {
      for (let i = 0; i < baseFeatures.length; i++) {
        for (let j = i + 1; j < baseFeatures.length; j++) {
          polynomialFeatures.push(baseFeatures[i] * baseFeatures[j]);
        }
      }
    }

    return polynomialFeatures;
  }

  private solveNormalEquation(X: number[][], y: number[]): number[] {
    // Calculate X^T * X
    const XTranspose = this.transpose(X);
    const XTX = this.matrixMultiply(XTranspose, X);
    
    // Calculate X^T * y
    const XTy = this.matrixVectorMultiply(XTranspose, y);
    
    // Solve (X^T * X) * β = X^T * y
    return this.solveLinearSystem(XTX, XTy);
  }

  private solveRegularizedNormalEquation(X: number[][], y: number[], lambda: number): number[] {
    // Calculate X^T * X + λI
    const XTranspose = this.transpose(X);
    const XTX = this.matrixMultiply(XTranspose, X);
    
    // Add regularization term
    for (let i = 0; i < XTX.length; i++) {
      XTX[i][i] += lambda;
    }
    
    // Calculate X^T * y
    const XTy = this.matrixVectorMultiply(XTranspose, y);
    
    // Solve regularized system
    return this.solveLinearSystem(XTX, XTy);
  }

  private transpose(matrix: number[][]): number[][] {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result: number[][] = [];
    
    for (let j = 0; j < cols; j++) {
      result[j] = [];
      for (let i = 0; i < rows; i++) {
        result[j][i] = matrix[i][j];
      }
    }
    
    return result;
  }

  private matrixMultiply(A: number[][], B: number[][]): number[][] {
    const rowsA = A.length;
    const colsA = A[0].length;
    const colsB = B[0].length;
    const result: number[][] = [];
    
    for (let i = 0; i < rowsA; i++) {
      result[i] = [];
      for (let j = 0; j < colsB; j++) {
        let sum = 0;
        for (let k = 0; k < colsA; k++) {
          sum += A[i][k] * B[k][j];
        }
        result[i][j] = sum;
      }
    }
    
    return result;
  }

  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => this.dotProduct(row, vector));
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] {
    // Gaussian elimination with partial pivoting
    const n = A.length;
    const augmented: number[][] = A.map((row, i) => [...row, b[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      
      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
    
    // Back substitution
    const solution: number[] = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      solution[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        solution[i] -= augmented[i][j] * solution[j];
      }
      solution[i] /= augmented[i][i];
    }
    
    return solution;
  }

  private predictLinear(features: number[], model: RegressionModelParams): number {
    return model.intercept + this.dotProduct(features, model.coefficients);
  }

  private predictPolynomial(features: number[], model: RegressionModelParams): number {
    // Features are already polynomial features
    return model.intercept + this.dotProduct(features, model.coefficients);
  }

  private calculateRegressionMetrics(actual: number[], predicted: number[]): {
    mse: number;
    mae: number;
    r2: number;
  } {
    const n = actual.length;
    const actualMean = actual.reduce((sum, val) => sum + val, 0) / n;
    
    let mse = 0;
    let mae = 0;
    let totalSumSquares = 0;
    let residualSumSquares = 0;
    
    for (let i = 0; i < n; i++) {
      const error = actual[i] - predicted[i];
      mse += error * error;
      mae += Math.abs(error);
      totalSumSquares += (actual[i] - actualMean) * (actual[i] - actualMean);
      residualSumSquares += error * error;
    }
    
    mse /= n;
    mae /= n;
    const r2 = totalSumSquares === 0 ? 0 : 1 - (residualSumSquares / totalSumSquares);
    
    return { mse, mae, r2 };
  }

  private calculateModelAccuracy(actual: number[], predicted: number[]): ModelAccuracy {
    const metrics = this.calculateRegressionMetrics(actual, predicted);
    const rmse = Math.sqrt(metrics.mse);
    
    // Calculate MAPE
    let mape = 0;
    let mapeCount = 0;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        mape += Math.abs((actual[i] - predicted[i]) / actual[i]);
        mapeCount++;
      }
    }
    mape = mapeCount > 0 ? (mape / mapeCount) * 100 : 100;
    
    // Overall accuracy (inverse of normalized RMSE)
    const accuracy = Math.max(0, 1 - rmse / 3); // Normalize by max congestion level
    
    return {
      mape,
      rmse,
      mae: metrics.mae,
      r2: metrics.r2,
      accuracy,
    };
  }

  private calculatePredictionConfidence(features: TrafficFeatures, _prediction: number): number {
    // Base confidence from model accuracy
    let confidence = this.accuracy?.accuracy || 0.7;
    
    // Adjust based on feature reliability
    if (features.weatherScore < 0.3) {
      confidence *= 0.8; // Reduce confidence in bad weather
    }
    
    if (features.eventImpactScore > 0.7) {
      confidence *= 0.7; // Reduce confidence during major events
    }
    
    // Adjust based on time of day (more confident during regular patterns)
    const hour = features.hourOfDay;
    if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20)) {
      confidence *= 1.1; // More confident during rush hours
    } else if (hour >= 22 || hour <= 5) {
      confidence *= 0.9; // Less confident during night hours
    }
    
    // Ensure confidence is within bounds
    return Math.max(0.1, Math.min(1.0, confidence));
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