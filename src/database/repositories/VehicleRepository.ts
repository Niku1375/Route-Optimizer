import { BaseRepository } from './BaseRepository';
import { Vehicle } from '../../models/Vehicle';

export interface VehicleSearchFilters {
  vehicleType?: string;
  status?: string;
  fuelType?: string;
  pollutionLevel?: string;
  minWeightCapacity?: number;
  minVolumeCapacity?: number;
  nearLatitude?: number;
  nearLongitude?: number;
  radiusKm?: number;
  isActive?: boolean;
}

export interface VehicleLocationUpdate {
  latitude: number;
  longitude: number;
  timestamp?: Date;
}

export class VehicleRepository extends BaseRepository<Vehicle> {
  constructor() {
    super('vehicles');
  }

  public async findByPlateNumber(plateNumber: string): Promise<Vehicle | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE plate_number = $1`;
    const result = await this.query(query, [plateNumber]);
    return result.rows[0] || null;
  }

  public async findByStatus(status: string): Promise<Vehicle[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE status = $1 AND is_active = true`;
    const result = await this.query(query, [status]);
    return result.rows;
  }

  public async findAvailableVehicles(filters: VehicleSearchFilters = {}): Promise<Vehicle[]> {
    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE status = 'available' AND is_active = true
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.vehicleType) {
      query += ` AND vehicle_type = $${paramIndex}`;
      params.push(filters.vehicleType);
      paramIndex++;
    }

    if (filters.fuelType) {
      query += ` AND fuel_type = $${paramIndex}`;
      params.push(filters.fuelType);
      paramIndex++;
    }

    if (filters.pollutionLevel) {
      query += ` AND pollution_level = $${paramIndex}`;
      params.push(filters.pollutionLevel);
      paramIndex++;
    }

    if (filters.minWeightCapacity) {
      query += ` AND weight_capacity >= $${paramIndex}`;
      params.push(filters.minWeightCapacity);
      paramIndex++;
    }

    if (filters.minVolumeCapacity) {
      query += ` AND volume_capacity >= $${paramIndex}`;
      params.push(filters.minVolumeCapacity);
      paramIndex++;
    }

    // Geographic proximity search
    if (filters.nearLatitude && filters.nearLongitude && filters.radiusKm) {
      query += `
        AND (
          6371 * acos(
            cos(radians($${paramIndex})) * cos(radians(current_latitude)) *
            cos(radians(current_longitude) - radians($${paramIndex + 1})) +
            sin(radians($${paramIndex})) * sin(radians(current_latitude))
          )
        ) <= $${paramIndex + 2}
      `;
      params.push(filters.nearLatitude, filters.nearLongitude, filters.radiusKm);
      paramIndex += 3;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.query(query, params);
    return result.rows;
  }

  public async updateLocation(vehicleId: string, location: VehicleLocationUpdate): Promise<Vehicle | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET 
        current_latitude = $2,
        current_longitude = $3,
        location_updated_at = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;

    const timestamp = location.timestamp || new Date();
    const result = await this.query(query, [
      vehicleId,
      location.latitude,
      location.longitude,
      timestamp,
    ]);

    return result.rows[0] || null;
  }

  public async updateStatus(vehicleId: string, status: string): Promise<Vehicle | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET status = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query(query, [vehicleId, status]);
    return result.rows[0] || null;
  }

  public async findByDriverId(driverId: string): Promise<Vehicle[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE driver_id = $1 AND is_active = true`;
    const result = await this.query(query, [driverId]);
    return result.rows;
  }

  public async findVehiclesNearLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 10
  ): Promise<Vehicle[]> {
    const query = `
      SELECT *,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(current_latitude)) *
            cos(radians(current_longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(current_latitude))
          )
        ) AS distance_km
      FROM ${this.tableName}
      WHERE 
        current_latitude IS NOT NULL 
        AND current_longitude IS NOT NULL
        AND is_active = true
        AND (
          6371 * acos(
            cos(radians($1)) * cos(radians(current_latitude)) *
            cos(radians(current_longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(current_latitude))
          )
        ) <= $3
      ORDER BY distance_km ASC
    `;

    const result = await this.query(query, [latitude, longitude, radiusKm]);
    return result.rows;
  }

  public async findComplianceViolations(): Promise<Vehicle[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE 
        (pollution_certificate_valid = false OR permit_valid = false)
        AND is_active = true
      ORDER BY updated_at DESC
    `;

    const result = await this.query(query);
    return result.rows;
  }

  public async updateDriverWorkingHours(vehicleId: string, workingHours: number): Promise<Vehicle | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET 
        driver_working_hours = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query(query, [vehicleId, workingHours]);
    return result.rows[0] || null;
  }

  public async findVehiclesByCapacityRange(
    minWeight: number,
    maxWeight: number,
    minVolume?: number,
    maxVolume?: number
  ): Promise<Vehicle[]> {
    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE 
        weight_capacity >= $1 
        AND weight_capacity <= $2
        AND is_active = true
    `;
    const params = [minWeight, maxWeight];

    if (minVolume !== undefined && maxVolume !== undefined) {
      query += ` AND volume_capacity >= $3 AND volume_capacity <= $4`;
      params.push(minVolume, maxVolume);
    }

    query += ` ORDER BY weight_capacity ASC, volume_capacity ASC`;

    const result = await this.query(query, params);
    return result.rows;
  }

  public async getVehicleUtilizationStats(): Promise<any> {
    const query = `
      SELECT 
        vehicle_type,
        status,
        COUNT(*) as count,
        AVG(driver_working_hours) as avg_working_hours,
        AVG(weight_capacity) as avg_weight_capacity,
        AVG(volume_capacity) as avg_volume_capacity
      FROM ${this.tableName}
      WHERE is_active = true
      GROUP BY vehicle_type, status
      ORDER BY vehicle_type, status
    `;

    const result = await this.query(query);
    return result.rows;
  }
}