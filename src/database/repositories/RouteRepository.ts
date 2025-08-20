import { BaseRepository, QueryResult } from './BaseRepository';
import { Route } from '../../models/Route';
import { PoolClient } from 'pg';

export interface RouteSearchFilters {
  vehicleId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
  minEfficiencyScore?: number;
  optimizationAlgorithm?: string;
}

export interface RouteDeliveryAssignment {
  routeId: string;
  deliveryId: string;
  stopSequence: number;
  estimatedArrival?: Date;
  estimatedDeparture?: Date;
}

export class RouteRepository extends BaseRepository<Route> {
  constructor() {
    super('routes');
  }

  public async findByVehicleId(vehicleId: string): Promise<Route[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE vehicle_id = $1 ORDER BY created_at DESC`;
    const result = await this.query(query, [vehicleId]);
    return result.rows;
  }

  public async findActiveRoutes(): Promise<Route[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE status = 'active' 
      ORDER BY planned_start_time ASC
    `;
    const result = await this.query(query);
    return result.rows;
  }

  public async findRoutesByStatus(status: string): Promise<Route[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE status = $1 ORDER BY created_at DESC`;
    const result = await this.query(query, [status]);
    return result.rows;
  }

  public async findRoutesWithDeliveries(routeId: string): Promise<any> {
    const query = `
      SELECT 
        r.*,
        json_agg(
          json_build_object(
            'delivery_id', rd.delivery_id,
            'stop_sequence', rd.stop_sequence,
            'estimated_arrival', rd.estimated_arrival,
            'actual_arrival', rd.actual_arrival,
            'estimated_departure', rd.estimated_departure,
            'actual_departure', rd.actual_departure,
            'delivery', json_build_object(
              'id', d.id,
              'pickup_address', d.pickup_address,
              'delivery_address', d.delivery_address,
              'weight', d.weight,
              'volume', d.volume,
              'priority', d.priority
            )
          ) ORDER BY rd.stop_sequence
        ) as deliveries
      FROM ${this.tableName} r
      LEFT JOIN route_deliveries rd ON r.id = rd.route_id
      LEFT JOIN deliveries d ON rd.delivery_id = d.id
      WHERE r.id = $1
      GROUP BY r.id
    `;

    const result = await this.query(query, [routeId]);
    return result.rows[0] || null;
  }

  public async assignDeliveriesToRoute(
    routeId: string,
    assignments: RouteDeliveryAssignment[],
    client?: PoolClient
  ): Promise<void> {
    const queryMethod = client ? this.queryWithClient.bind(this, client) : this.query.bind(this);

    // First, remove existing assignments for this route
    const deleteQuery = `DELETE FROM route_deliveries WHERE route_id = $1`;
    await queryMethod(deleteQuery, [routeId]);

    // Insert new assignments
    if (assignments.length > 0) {
      const values = assignments.map((assignment, index) => {
        const baseIndex = index * 5;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
      }).join(', ');

      const insertQuery = `
        INSERT INTO route_deliveries (route_id, delivery_id, stop_sequence, estimated_arrival, estimated_departure)
        VALUES ${values}
      `;

      const params = assignments.flatMap(assignment => [
        assignment.routeId,
        assignment.deliveryId,
        assignment.stopSequence,
        assignment.estimatedArrival || null,
        assignment.estimatedDeparture || null,
      ]);

      await queryMethod(insertQuery, params);
    }
  }

  public async updateRouteProgress(
    routeId: string,
    deliveryId: string,
    actualArrival?: Date,
    actualDeparture?: Date
  ): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [routeId, deliveryId];
    let paramIndex = 3;

    if (actualArrival) {
      updates.push(`actual_arrival = $${paramIndex}`);
      params.push(actualArrival);
      paramIndex++;
    }

    if (actualDeparture) {
      updates.push(`actual_departure = $${paramIndex}`);
      params.push(actualDeparture);
      paramIndex++;
    }

    if (updates.length > 0) {
      const query = `
        UPDATE route_deliveries 
        SET ${updates.join(', ')}
        WHERE route_id = $1 AND delivery_id = $2
      `;

      await this.query(query, params);
    }
  }

  public async startRoute(routeId: string): Promise<Route | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET 
        status = 'active',
        actual_start_time = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query(query, [routeId]);
    return result.rows[0] || null;
  }

  public async completeRoute(routeId: string): Promise<Route | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET 
        status = 'completed',
        actual_end_time = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query(query, [routeId]);
    return result.rows[0] || null;
  }

  public async cancelRoute(routeId: string): Promise<Route | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET 
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query(query, [routeId]);
    return result.rows[0] || null;
  }

  public async findRoutesByFilters(filters: RouteSearchFilters): Promise<Route[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.vehicleId) {
      query += ` AND vehicle_id = $${paramIndex}`;
      params.push(filters.vehicleId);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.fromDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.fromDate);
      paramIndex++;
    }

    if (filters.toDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.toDate);
      paramIndex++;
    }

    if (filters.minEfficiencyScore) {
      query += ` AND efficiency_score >= $${paramIndex}`;
      params.push(filters.minEfficiencyScore);
      paramIndex++;
    }

    if (filters.optimizationAlgorithm) {
      query += ` AND optimization_algorithm = $${paramIndex}`;
      params.push(filters.optimizationAlgorithm);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.query(query, params);
    return result.rows;
  }

  public async getRouteEfficiencyStats(): Promise<any> {
    const query = `
      SELECT 
        optimization_algorithm,
        status,
        COUNT(*) as route_count,
        AVG(efficiency_score) as avg_efficiency_score,
        AVG(estimated_duration) as avg_duration_minutes,
        AVG(estimated_distance) as avg_distance_km,
        AVG(estimated_fuel_consumption) as avg_fuel_consumption,
        AVG(optimization_time_ms) as avg_optimization_time_ms
      FROM ${this.tableName}
      WHERE efficiency_score IS NOT NULL
      GROUP BY optimization_algorithm, status
      ORDER BY optimization_algorithm, status
    `;

    const result = await this.query(query);
    return result.rows;
  }

  public async findRoutesRequiringReoptimization(): Promise<Route[]> {
    const query = `
      SELECT r.* FROM ${this.tableName} r
      WHERE 
        r.status = 'active'
        AND (
          r.actual_start_time IS NOT NULL 
          AND r.actual_start_time > r.planned_start_time + INTERVAL '30 minutes'
        )
      ORDER BY r.planned_start_time ASC
    `;

    const result = await this.query(query);
    return result.rows;
  }

  public async getRouteDeliveryCount(routeId: string): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM route_deliveries WHERE route_id = $1`;
    const result = await this.query(query, [routeId]) as QueryResult<{ count: string }>;
    return parseInt(result.rows[0].count);
  }

  public async findOverdueRoutes(): Promise<Route[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE 
        status = 'active'
        AND planned_end_time < CURRENT_TIMESTAMP
      ORDER BY planned_end_time ASC
    `;

    const result = await this.query(query);
    return result.rows;
  }

  public async updateRouteEfficiency(
    routeId: string,
    efficiencyScore: number,
    actualDistance?: number,
    actualDuration?: number,
    actualFuelConsumption?: number
  ): Promise<Route | null> {
    const updates = ['efficiency_score = $2'];
    const params: any[] = [routeId, efficiencyScore];
    let paramIndex = 3;

    if (actualDistance !== undefined) {
      updates.push(`estimated_distance = $${paramIndex}`);
      params.push(actualDistance);
      paramIndex++;
    }

    if (actualDuration !== undefined) {
      updates.push(`estimated_duration = $${paramIndex}`);
      params.push(actualDuration);
      paramIndex++;
    }

    if (actualFuelConsumption !== undefined) {
      updates.push(`estimated_fuel_consumption = $${paramIndex}`);
      params.push(actualFuelConsumption);
      paramIndex++;
    }

    const query = `
      UPDATE ${this.tableName} 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query(query, params);
    return result.rows[0] || null;
  }
}