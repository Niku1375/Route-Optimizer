/**
 * Traffic Pattern Analyzer for identifying and predicting traffic patterns
 */

import { 
  TrafficPatternAnalyzer, 
  TrafficDataPoint, 
  HourlyTrafficPattern,
  DayOfWeekPattern,
  SeasonalPattern,
  CongestionPattern,
  TrafficPrediction 
} from '../../models/TrafficML';
import { GeoArea } from '../../models/GeoLocation';

export class TrafficPatternAnalyzerImpl implements TrafficPatternAnalyzer {
  private hourlyPatterns: HourlyTrafficPattern[] = [];
  private dayOfWeekPatterns: DayOfWeekPattern[] = [];
  private seasonalPatterns: SeasonalPattern[] = [];
  private congestionPatterns: CongestionPattern[] = [];

  analyzeHourlyPatterns(historicalData: TrafficDataPoint[]): HourlyTrafficPattern[] {
    const hourlyData: { [hour: number]: number[] } = {};
    
    // Group data by hour
    for (const dataPoint of historicalData) {
      const hour = dataPoint.timestamp.getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = [];
      }
      hourlyData[hour].push(dataPoint.congestionLevel);
    }

    // Calculate patterns for each hour
    this.hourlyPatterns = [];
    for (let hour = 0; hour < 24; hour++) {
      const congestionLevels = hourlyData[hour] || [];
      
      if (congestionLevels.length === 0) {
        // No data for this hour, use interpolation
        const prevHour = (hour - 1 + 24) % 24;
       // const _nextHour = (hour + 1) % 24;
        const prevPattern = this.hourlyPatterns.find(p => p.hour === prevHour);
        const avgCongestion = prevPattern ? prevPattern.averageCongestion : 1.5;
        
        this.hourlyPatterns.push({
          hour,
          averageCongestion: avgCongestion,
          standardDeviation: 0.5,
          peakProbability: 0.1,
          typicalSpeed: this.estimateSpeedFromCongestion(avgCongestion),
        });
        continue;
      }

      const averageCongestion = congestionLevels.reduce((sum, val) => sum + val, 0) / congestionLevels.length;
      const variance = congestionLevels.reduce((sum, val) => sum + Math.pow(val - averageCongestion, 2), 0) / congestionLevels.length;
      const standardDeviation = Math.sqrt(variance);
      
      // Calculate peak probability (congestion > 2.0)
      const peakCount = congestionLevels.filter(level => level > 2.0).length;
      const peakProbability = peakCount / congestionLevels.length;
      
      this.hourlyPatterns.push({
        hour,
        averageCongestion,
        standardDeviation,
        peakProbability,
        typicalSpeed: this.estimateSpeedFromCongestion(averageCongestion),
      });
    }

    return this.hourlyPatterns;
  }

  analyzeDayOfWeekPatterns(historicalData: TrafficDataPoint[]): DayOfWeekPattern[] {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayData: { [day: number]: number[] } = {};
    const dayHourData: { [day: number]: { [hour: number]: number[] } } = {};

    // Group data by day of week
    for (const dataPoint of historicalData) {
      const dayOfWeek = dataPoint.timestamp.getDay();
      const hour = dataPoint.timestamp.getHours();
      
      if (!dayData[dayOfWeek]) {
        dayData[dayOfWeek] = [];
        dayHourData[dayOfWeek] = {};
      }
      
      dayData[dayOfWeek].push(dataPoint.congestionLevel);
      
      if (!dayHourData[dayOfWeek][hour]) {
        dayHourData[dayOfWeek][hour] = [];
      }
      dayHourData[dayOfWeek][hour].push(dataPoint.congestionLevel);
    }

    // Calculate patterns for each day
    this.dayOfWeekPatterns = [];
    for (let day = 0; day < 7; day++) {
      const congestionLevels = dayData[day] || [];
      const averageCongestion = congestionLevels.length > 0 
        ? congestionLevels.reduce((sum, val) => sum + val, 0) / congestionLevels.length 
        : 1.5;

      // Find peak and off-peak hours
      const peakHours: number[] = [];
      const offPeakHours: number[] = [];
      
      for (let hour = 0; hour < 24; hour++) {
        const hourData = dayHourData[day]?.[hour] || [];
        if (hourData.length > 0) {
          const hourAvg = hourData.reduce((sum, val) => sum + val, 0) / hourData.length;
          if (hourAvg > averageCongestion + 0.5) {
            peakHours.push(hour);
          } else if (hourAvg < averageCongestion - 0.5) {
            offPeakHours.push(hour);
          }
        }
      }

      // Weekend factor (weekends typically have different patterns)
      const weekendFactor = (day === 0 || day === 6) ? 0.7 : 1.0;

      this.dayOfWeekPatterns.push({
        dayOfWeek: day,
        dayName: dayNames[day],
        averageCongestion,
        peakHours,
        offPeakHours,
        weekendFactor,
      });
    }

    return this.dayOfWeekPatterns;
  }

  analyzeSeasonalPatterns(historicalData: TrafficDataPoint[]): SeasonalPattern[] {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthData: { [month: number]: number[] } = {};
    const monthWeatherData: { [month: number]: any[] } = {};

    // Group data by month
    for (const dataPoint of historicalData) {
      const month = dataPoint.timestamp.getMonth();
      
      if (!monthData[month]) {
        monthData[month] = [];
        monthWeatherData[month] = [];
      }
      
      monthData[month].push(dataPoint.congestionLevel);
      if (dataPoint.weatherConditions) {
        monthWeatherData[month].push(dataPoint.weatherConditions);
      }
    }

    // Calculate seasonal patterns
    this.seasonalPatterns = [];
    for (let month = 0; month < 12; month++) {
      const congestionLevels = monthData[month] || [];
      const averageCongestion = congestionLevels.length > 0 
        ? congestionLevels.reduce((sum, val) => sum + val, 0) / congestionLevels.length 
        : 1.5;

      // Calculate weather impact factor
      const weatherData = monthWeatherData[month] || [];
      let weatherImpactFactor = 1.0;
      if (weatherData.length > 0) {
        const avgRainfall = weatherData.reduce((sum, w) => sum + (w.rainfall || 0), 0) / weatherData.length;
        const avgVisibility = weatherData.reduce((sum, w) => sum + (w.visibility || 10), 0) / weatherData.length;
        
        // Higher rainfall and lower visibility increase impact
        weatherImpactFactor = 1.0 + (avgRainfall / 10) + ((10 - avgVisibility) / 20);
      }

      // Holiday impact factor (simplified - assume December and January have more holidays)
      const holidayImpactFactor = (month === 11 || month === 0) ? 1.2 : 1.0;

      // School season factor (assume June-July are vacation months in Delhi)
      const schoolSeasonFactor = (month === 5 || month === 6) ? 0.8 : 1.0;

      this.seasonalPatterns.push({
        month,
        monthName: monthNames[month],
        averageCongestion,
        weatherImpactFactor,
        holidayImpactFactor,
        schoolSeasonFactor,
      });
    }

    return this.seasonalPatterns;
  }

  detectCongestionPatterns(historicalData: TrafficDataPoint[]): CongestionPattern[] {
    this.congestionPatterns = [];

    // Detect rush hour patterns
    const rushHourPattern = this.detectRushHourPattern(historicalData);
    if (rushHourPattern) {
      this.congestionPatterns.push(rushHourPattern);
    }

    // Detect event-based patterns
    const eventPatterns = this.detectEventBasedPatterns(historicalData);
    this.congestionPatterns.push(...eventPatterns);

    // Detect weather-related patterns
    const weatherPattern = this.detectWeatherRelatedPattern(historicalData);
    if (weatherPattern) {
      this.congestionPatterns.push(weatherPattern);
    }

    // Detect seasonal patterns
    const seasonalPattern = this.detectSeasonalCongestionPattern(historicalData);
    if (seasonalPattern) {
      this.congestionPatterns.push(seasonalPattern);
    }

    return this.congestionPatterns;
  }

  predictBasedOnPatterns(area: GeoArea, targetTime: Date): TrafficPrediction {
    const hour = targetTime.getHours();
    const dayOfWeek = targetTime.getDay();
    const month = targetTime.getMonth();

    // Get base prediction from hourly patterns
    const hourlyPattern = this.hourlyPatterns.find(p => p.hour === hour);
    let baseCongestion = hourlyPattern?.averageCongestion || 1.5;
    let baseSpeed = hourlyPattern?.typicalSpeed || 25;

    // Apply day of week adjustments
    const dayPattern = this.dayOfWeekPatterns.find(p => p.dayOfWeek === dayOfWeek);
    if (dayPattern) {
      baseCongestion *= dayPattern.weekendFactor;
      
      // Check if current hour is a peak hour for this day
      if (dayPattern.peakHours.includes(hour)) {
        baseCongestion *= 1.3;
        baseSpeed *= 0.7;
      } else if (dayPattern.offPeakHours.includes(hour)) {
        baseCongestion *= 0.8;
        baseSpeed *= 1.2;
      }
    }

    // Apply seasonal adjustments
    const seasonalPattern = this.seasonalPatterns.find(p => p.month === month);
    if (seasonalPattern) {
      baseCongestion *= seasonalPattern.weatherImpactFactor;
      baseCongestion *= seasonalPattern.holidayImpactFactor;
      baseCongestion *= seasonalPattern.schoolSeasonFactor;
    }

    // Apply congestion pattern adjustments
    for (const pattern of this.congestionPatterns) {
      if (this.patternApplies(pattern, targetTime, area)) {
        baseCongestion *= (1 + pattern.severityLevel * 0.3);
      }
    }

    // Ensure values are within valid ranges
    baseCongestion = Math.max(0, Math.min(3, baseCongestion));
    baseSpeed = Math.max(5, Math.min(60, baseSpeed));

    // Calculate confidence based on data availability
    const confidence = this.calculatePatternConfidence(hour, dayOfWeek, month);

    return {
      timestamp: targetTime,
      congestionLevel: this.mapCongestionLevel(baseCongestion),
      averageSpeed: Math.round(baseSpeed),
      confidence,
    };
  }

  private detectRushHourPattern(historicalData: TrafficDataPoint[]): CongestionPattern | null {
    const morningRushData = historicalData.filter(d => {
      const hour = d.timestamp.getHours();
      return hour >= 7 && hour <= 10;
    });

    const eveningRushData = historicalData.filter(d => {
      const hour = d.timestamp.getHours();
      return hour >= 17 && hour <= 20;
    });

    if (morningRushData.length === 0 && eveningRushData.length === 0) {
      return null;
    }

    const allRushData = [...morningRushData, ...eveningRushData];
    const avgCongestion = allRushData.reduce((sum, d) => sum + d.congestionLevel, 0) / allRushData.length;
    //const _highCongestionCount = allRushData.filter(d => d.congestionLevel > 2.0).length;
    const severityLevel = Math.min(3, avgCongestion);

    return {
      patternType: 'rush_hour',
      triggerConditions: ['weekday', 'time:7-10', 'time:17-20'],
      averageDuration: 180, // 3 hours
      severityLevel,
      affectedAreas: [allRushData[0]?.area.id || 'unknown'],
      mitigationStrategies: [
        'Use alternative routes',
        'Adjust departure time',
        'Consider public transport',
        'Implement staggered work hours'
      ],
    };
  }

  private detectEventBasedPatterns(historicalData: TrafficDataPoint[]): CongestionPattern[] {
    const patterns: CongestionPattern[] = [];
    
    // Look for unusual spikes in congestion that might indicate events
    const eventData = historicalData.filter(d => {
      const eventFactors = d.eventFactors || [];
      return eventFactors.length > 0;
    });

    if (eventData.length > 0) {
      const avgCongestion = eventData.reduce((sum, d) => sum + d.congestionLevel, 0) / eventData.length;
      
      patterns.push({
        patternType: 'event_based',
        triggerConditions: ['special_events', 'festivals', 'sports_events'],
        averageDuration: 240, // 4 hours
        severityLevel: Math.min(3, avgCongestion),
        affectedAreas: [...new Set(eventData.map(d => d.area.id))],
        mitigationStrategies: [
          'Plan alternative routes in advance',
          'Allow extra travel time',
          'Monitor traffic updates',
          'Consider postponing non-essential trips'
        ],
      });
    }

    return patterns;
  }

  private detectWeatherRelatedPattern(historicalData: TrafficDataPoint[]): CongestionPattern | null {
    const weatherData = historicalData.filter(d => {
      const weather = d.weatherConditions;
      return weather && (weather.rainfall > 5 || weather.visibility < 5);
    });

    if (weatherData.length === 0) {
      return null;
    }

    const avgCongestion = weatherData.reduce((sum, d) => sum + d.congestionLevel, 0) / weatherData.length;
    
    return {
      patternType: 'weather_related',
      triggerConditions: ['heavy_rain', 'poor_visibility', 'fog', 'extreme_weather'],
      averageDuration: 120, // 2 hours
      severityLevel: Math.min(3, avgCongestion),
      affectedAreas: [...new Set(weatherData.map(d => d.area.id))],
      mitigationStrategies: [
        'Drive cautiously and slowly',
        'Increase following distance',
        'Use headlights and hazard lights',
        'Consider delaying travel if possible'
      ],
    };
  }

  private detectSeasonalCongestionPattern(historicalData: TrafficDataPoint[]): CongestionPattern | null {
    // Group by month and find months with significantly higher congestion
    const monthlyAvg: { [month: number]: number } = {};
    const monthlyCount: { [month: number]: number } = {};

    for (const dataPoint of historicalData) {
      const month = dataPoint.timestamp.getMonth();
      if (!monthlyAvg[month]) {
        monthlyAvg[month] = 0;
        monthlyCount[month] = 0;
      }
      monthlyAvg[month] += dataPoint.congestionLevel;
      monthlyCount[month]++;
    }

    // Calculate averages
    for (const month in monthlyAvg) {
      monthlyAvg[month] /= monthlyCount[month];
    }

    const overallAvg = Object.values(monthlyAvg).reduce((sum, val) => sum + val, 0) / Object.keys(monthlyAvg).length;
    const highCongestionMonths = Object.entries(monthlyAvg)
      .filter(([, avg]) => avg > overallAvg + 0.5)
      .map(([month]) => parseInt(month));

    if (highCongestionMonths.length === 0) {
      return null;
    }

    return {
      patternType: 'seasonal',
      triggerConditions: ['winter_months', 'festival_season', 'school_season'],
      averageDuration: 30 * 24 * 60, // 30 days in minutes
      severityLevel: 2,
      affectedAreas: ['city_wide'],
      mitigationStrategies: [
        'Plan for seasonal traffic increases',
        'Use public transport during peak seasons',
        'Consider flexible work arrangements',
        'Monitor seasonal traffic advisories'
      ],
    };
  }

  private patternApplies(pattern: CongestionPattern, targetTime: Date, _area: GeoArea): boolean {
    const hour = targetTime.getHours();
    const dayOfWeek = targetTime.getDay();
    const month = targetTime.getMonth();

    switch (pattern.patternType) {
      case 'rush_hour': {
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        const isRushHour = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20);
        return isWeekday && isRushHour;
      }

      case 'seasonal':
        // Winter months (Nov-Feb) typically have higher congestion in Delhi
        return month >= 10 || month <= 1;

      case 'weather_related':
        // This would need real-time weather data to determine
        return false; // Simplified for now

      case 'event_based':
        // This would need event calendar integration
        return false; // Simplified for now

      default:
        return false;
    }
  }

  private calculatePatternConfidence(hour: number, dayOfWeek: number, _month: number): number {
    let confidence = 0.7; // Base confidence

    // Higher confidence during well-established patterns
    const hourlyPattern = this.hourlyPatterns.find(p => p.hour === hour);
    if (hourlyPattern && hourlyPattern.standardDeviation < 0.5) {
      confidence += 0.1;
    }

    // Higher confidence for weekdays vs weekends
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      confidence += 0.1;
    } else {
      confidence -= 0.1;
    }

    // Adjust based on data availability
    const totalPatterns = this.hourlyPatterns.length + this.dayOfWeekPatterns.length + this.seasonalPatterns.length;
    if (totalPatterns < 10) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
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

  private mapCongestionLevel(value: number): 'low' | 'moderate' | 'high' | 'severe' {
    if (value <= 0.5) return 'low';
    if (value <= 1.5) return 'moderate';
    if (value <= 2.5) return 'high';
    return 'severe';
  }
}