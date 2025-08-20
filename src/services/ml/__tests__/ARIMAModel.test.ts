/**
 * Unit tests for ARIMA Model
 */

import { ARIMAModelImpl } from '../ARIMAModel';
import { TrafficDataPoint } from '../../../models/TrafficML';
import { GeoArea } from '../../../models/GeoLocation';

describe('ARIMAModel', () => {
  let arimaModel: ARIMAModelImpl;
  let testData: TrafficDataPoint[];

  const testArea: GeoArea = {
    id: 'test_area',
    name: 'Test Area',
    boundaries: [
      { latitude: 28.6139, longitude: 77.2090 },
      { latitude: 28.6200, longitude: 77.2150 },
    ],
    zoneType: 'commercial',
  };

  beforeEach(() => {
    arimaModel = new ARIMAModelImpl();
    
    // Generate synthetic time series data for testing
    testData = [];
    const baseTime = new Date('2024-01-01T00:00:00Z');
    
    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(baseTime.getTime() + i * 60 * 60 * 1000); // Hourly data
      const hour = timestamp.getHours();
      
      // Create realistic traffic pattern (higher during rush hours)
      let congestionLevel = 1.0; // Base level
      if (hour >= 7 && hour <= 10) {
        congestionLevel = 2.5 + Math.random() * 0.5; // Morning rush
      } else if (hour >= 17 && hour <= 20) {
        congestionLevel = 2.3 + Math.random() * 0.7; // Evening rush
      } else if (hour >= 22 || hour <= 5) {
        congestionLevel = 0.5 + Math.random() * 0.5; // Night time
      } else {
        congestionLevel = 1.2 + Math.random() * 0.8; // Regular hours
      }
      
      testData.push({
        timestamp,
        area: testArea,
        congestionLevel,
        averageSpeed: Math.max(5, 50 - congestionLevel * 15),
        travelTimeMultiplier: 1 + congestionLevel * 0.5,
      });
    }
  });

  describe('train', () => {
    it('should train ARIMA model with sufficient data', async () => {
      const params = await arimaModel.train(testData);
      
      expect(params).toBeDefined();
      expect(params.p).toBeGreaterThanOrEqual(0);
      expect(params.d).toBeGreaterThanOrEqual(0);
      expect(params.q).toBeGreaterThanOrEqual(0);
      expect(params.coefficients).toBeInstanceOf(Array);
      expect(params.residuals).toBeInstanceOf(Array);
      expect(params.aic).toBeGreaterThan(0);
      expect(params.bic).toBeGreaterThan(0);
    });

    it('should throw error with insufficient data', async () => {
      const insufficientData = testData.slice(0, 10); // Only 10 data points
      
      await expect(arimaModel.train(insufficientData)).rejects.toThrow(
        'Insufficient training data. Need at least 24 data points.'
      );
    });

    it('should select reasonable ARIMA parameters', async () => {
      const params = await arimaModel.train(testData);
      
      // Parameters should be within reasonable bounds
      expect(params.p).toBeLessThanOrEqual(3);
      expect(params.d).toBeLessThanOrEqual(2);
      expect(params.q).toBeLessThanOrEqual(3);
    });
  });

  describe('predict', () => {
    beforeEach(async () => {
      await arimaModel.train(testData);
    });

    it('should generate predictions for specified forecast horizon', async () => {
      const forecastHours = 12;
      const predictions = await arimaModel.predict(testData, forecastHours);
      
      expect(predictions).toHaveLength(forecastHours);
      
      predictions.forEach((prediction, index) => {
        expect(prediction.timestamp).toBeInstanceOf(Date);
        expect(['low', 'moderate', 'high', 'severe']).toContain(prediction.congestionLevel);
        expect(prediction.averageSpeed).toBeGreaterThan(0);
        expect(prediction.averageSpeed).toBeLessThanOrEqual(60);
        expect(prediction.confidence).toBeGreaterThan(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
        
        // Confidence should decrease over time
        if (index > 0) {
          expect(prediction.confidence).toBeLessThanOrEqual(predictions[index - 1].confidence + 0.01);
        }
      });
    });

    it('should generate predictions with decreasing confidence over time', async () => {
      const predictions = await arimaModel.predict(testData, 24);
      
      // First prediction should have higher confidence than last
      expect(predictions[0]!.confidence).toBeGreaterThan(predictions[predictions.length - 1]!.confidence);
      
      // Confidence should generally decrease
      let decreasingCount = 0;
      for (let i = 1; i < predictions.length; i++) {
        if (predictions[i].confidence <= predictions[i - 1].confidence) {
          decreasingCount++;
        }
      }
      
      // At least 70% of predictions should have decreasing confidence
      expect(decreasingCount / (predictions.length - 1)).toBeGreaterThan(0.7);
    });

    it('should predict reasonable congestion levels', async () => {
      const predictions = await arimaModel.predict(testData, 6);
      
      predictions.forEach(prediction => {
        // All predictions should be valid congestion levels
        expect(['low', 'moderate', 'high', 'severe']).toContain(prediction.congestionLevel);
        
        // Speed should be inversely related to congestion
        if (prediction.congestionLevel === 'low') {
          expect(prediction.averageSpeed).toBeGreaterThan(30);
        } else if (prediction.congestionLevel === 'severe') {
          expect(prediction.averageSpeed).toBeLessThan(15);
        }
      });
    });

    it('should throw error when predicting without training', async () => {
      const untrainedModel = new ARIMAModelImpl();
      
      await expect(untrainedModel.predict(testData, 6)).rejects.toThrow(
        'Model not trained'
      );
    });
  });

  describe('getModelAccuracy', () => {
    it('should return accuracy metrics after training', async () => {
      await arimaModel.train(testData);
      
      const accuracy = arimaModel.getModelAccuracy();
      
      expect(accuracy.mape).toBeGreaterThan(0);
      expect(accuracy.rmse).toBeGreaterThan(0);
      expect(accuracy.mae).toBeGreaterThan(0);
      expect(accuracy.r2).toBeGreaterThanOrEqual(-1); // R² can be negative for poor models
      expect(accuracy.r2).toBeLessThanOrEqual(1);
      expect(accuracy.accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy.accuracy).toBeLessThanOrEqual(1);
    });

    it('should throw error when getting accuracy without training', () => {
      expect(() => arimaModel.getModelAccuracy()).toThrow(
        'Model has not been trained yet'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle constant time series', async () => {
      const constantData = testData.map(point => ({
        ...point,
        congestionLevel: 1.5, // Constant value
      }));
      
      const params = await arimaModel.train(constantData);
      expect(params).toBeDefined();
      const predictions = await arimaModel.predict(constantData, 3);
      
      expect(predictions).toHaveLength(3);
      predictions.forEach(prediction => {
        expect(prediction.congestionLevel).toBe('moderate'); // Should predict constant level
      });
    });

    it('should handle time series with trend', async () => {
      const trendData = testData.map((point, index) => ({
        ...point,
        congestionLevel: 1.0 + (index * 0.01), // Increasing trend
      }));
      
      const params = await arimaModel.train(trendData);
      expect(params).toBeDefined();
      const predictions = await arimaModel.predict(trendData, 5);
      
      expect(predictions).toHaveLength(5);
      // Should capture the increasing trend
      expect(predictions[predictions.length - 1]!.congestionLevel).not.toBe('low');
    });

    it('should handle missing data points gracefully', async () => {
      // Remove some data points to simulate missing data
      const sparseData = testData.filter((_, index) => index % 3 !== 0);
      
      const params = await arimaModel.train(sparseData);
      expect(params).toBeDefined();
      const predictions = await arimaModel.predict(sparseData, 3);
      
      expect(predictions).toHaveLength(3);
      predictions.forEach(prediction => {
        expect(prediction.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('performance', () => {
    it('should train and predict within reasonable time', async () => {
      const startTime = Date.now();
      
      await arimaModel.train(testData);
      const predictions = await arimaModel.predict(testData, 24);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within 5 seconds for 100 data points
      expect(executionTime).toBeLessThan(5000);
      expect(predictions).toHaveLength(24);
    });

    it('should handle large datasets efficiently', async () => {
      // Generate larger dataset
      const largeData = [];
      const baseTime = new Date('2024-01-01T00:00:00Z');
      
      for (let i = 0; i < 500; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 60 * 60 * 1000);
        largeData.push({
          timestamp,
          area: testArea,
          congestionLevel: 1.5 + Math.sin(i / 24) + Math.random() * 0.5,
          averageSpeed: 25,
          travelTimeMultiplier: 1.5,
        });
      }
      
      const startTime = Date.now();
      await arimaModel.train(largeData);
      const endTime = Date.now();
      
      // Should handle 500 data points within 10 seconds
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });
});