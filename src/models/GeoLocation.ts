/**
 * Geographic location and area definitions
 */

export interface GeoLocation {
  latitude: number;
  longitude: number;
  timestamp?: Date;
  address?: string;
}

export interface GeoArea {
  id: string;
  name: string;
  boundaries: GeoLocation[];
  zoneType: 'residential' | 'commercial' | 'industrial' | 'mixed';
  restrictions?: string[];
}

export interface PollutionZone {
  id: string;
  area: GeoArea;
  level: 'low' | 'moderate' | 'high' | 'severe';
  restrictions: string[];
  activeHours?: {
    start: string;
    end: string;
  };
}