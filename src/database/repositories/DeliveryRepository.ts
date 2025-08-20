import { BaseRepository } from './BaseRepository';
import { Delivery } from '../../models/Delivery';

export interface DeliverySearchFilters {
  customerId?: string;
  status?: string;
  priority?: string;
  serviceType?: string;
  fromDate?: Date;
  toDate?: Date;
  minWeight?: number;
  maxWeight?: number;
  nearLatitude?: number;
  nearLongitude?: number;
  radiusKm?: number;
}

export class DeliveryRepository extends BaseRepository<Delivery> {
  constructor() {
    super('deliveries');
  }

  public async findByCustomerId(customerId: string): Promise<Delivery[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE customer_id = $1 ORDER BY created_at DESC`;
    const result = await this.query(query, [customerId]);
    return result.rows;
  }

  public async findByStatus(status: string): Promise<Delivery[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE status = $1 ORDER BY created_at DESC`;
    const result = await this.query(query, [status]);
    return result.rows;
  }

  public async findPendingDeliveries(): Promise<Delivery[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE status = 'pending' 
      ORDER BY priority DESC, created_at ASC
    `;
    const result = await this.query(query);
    return result.rows;
  }

  public async findDeliveriesInTimeWindow(startTime: Date, endTime: Date): Promise<Delivery[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE 
        (pickup_earliest <= $2 AND pickup_latest >= $1) OR
        (delivery_earliest <= $2 AND delivery_latest >= $1)
      ORDER BY pickup_earliest ASC
    `;
    const result = await this.query(query, [startTime, endTime]);
    return result.rows;
  }

  public async findDeliveriesNearLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    locationType: 'pickup' | 'delivery' | 'both' = 'both'
  ): Promise<Delivery[]> {
    let distanceCondition = '';
    
    if (locationType === 'pickup') {
      distanceCondition = `
        (6371 * acos(
          cos(radians($1)) * cos(radians(pickup_latitude)) *
          cos(radians(pickup_longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(pickup_latitude))
        )) <= $3
      `;
    } else if (locationType === 'delivery') {
      distanceCondition = `
        (6371 * acos(
          cos(radians($1)) * cos(radians(delivery_latitude)) *
          cos(radians(delivery_longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(delivery_latitude))
        )) <= $3
      `;
    } else {
      distanceCondition = `
        (
          (6371 * acos(
            cos(radians($1)) * cos(radians(pickup_latitude)) *
            cos(radians(pickup_longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(pickup_latitude))
          )) <= $3
          OR
          (6371 * acos(
            cos(radians($1)) * cos(radians(delivery_latitude)) *
            cos(radians(delivery_longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(delivery_latitude))
          )) <= $3
        )
      `;
    }

    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE ${distanceCondition}
      ORDER BY created_at DESC
    `;

    const result = await this.query(query, [latitude, longitude, radiusKm]);
    return result.rows;
  }

  public async findDeliveriesByFilters(filters: DeliverySearchFilters): Promise<Delivery[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.customerId) {
      query += ` AND customer_id = $${paramIndex}`;
      params.push(filters.customerId);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.priority) {
      query += ` AND priority = $${paramIndex}`;
      params.push(filters.priority);
      paramIndex++;
    }

    if (filters.serviceType) {
      query += ` AND service_type = $${paramIndex}`;
      params.push(filters.serviceType);
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

    if (filters.minWeight) {
      query += ` AND weight >= $${paramIndex}`;
      params.push(filters.minWeight);
      paramIndex++;
    }

    if (filters.maxWeight) {
      query += ` AND weight <= $${paramIndex}`;
      params.push(filters.maxWeight);
      paramIndex++;
    }

    if (filters.nearLatitude && filters.nearLongitude && filters.radiusKm) {
      query += `
        AND (
          (6371 * acos(
            cos(radians($${paramIndex})) * cos(radians(pickup_latitude)) *
            cos(radians(pickup_longitude) - radians($${paramIndex + 1})) +
            sin(radians($${paramIndex})) * sin(radians(pickup_latitude))
          )) <= $${paramIndex + 2}
          OR
          (6371 * acos(
            cos(radians($${paramIndex})) * cos(radians(delivery_latitude)) *
            cos(radians(delivery_longitude) - radians($${paramIndex + 1})) +
            sin(radians($${paramIndex})) * sin(radians(delivery_latitude))
          )) <= $${paramIndex + 2}
        )
      `;
      params.push(filters.nearLatitude, filters.nearLongitude, filters.radiusKm);
      paramIndex += 3;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.query(query, params);
    return result.rows;
  }

  public async updateStatus(deliveryId: string, status: string): Promise<Delivery | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET status = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query(query, [deliveryId, status]);
    return result.rows[0] || null;
  }

  public async findUrgentDeliveries(): Promise<Delivery[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE 
        priority = 'urgent' 
        AND status IN ('pending', 'assigned')
      ORDER BY created_at ASC
    `;
    const result = await this.query(query);
    return result.rows;
  }

  public async findExpiredDeliveries(): Promise<Delivery[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE 
        delivery_latest < CURRENT_TIMESTAMP 
        AND status NOT IN ('delivered', 'cancelled')
      ORDER BY delivery_latest ASC
    `;
    const result = await this.query(query);
    return result.rows;
  }

  public async getDeliveryStatsByCustomer(customerId: string): Promise<any> {
    const query = `
      SELECT 
        status,
        service_type,
        COUNT(*) as count,
        AVG(weight) as avg_weight,
        AVG(volume) as avg_volume,
        MIN(created_at) as first_delivery,
        MAX(created_at) as last_delivery
      FROM ${this.tableName}
      WHERE customer_id = $1
      GROUP BY status, service_type
      ORDER BY status, service_type
    `;

    const result = await this.query(query, [customerId]);
    return result.rows;
  }

  public async getDeliveryStatsByTimeRange(startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT 
        DATE(created_at) as delivery_date,
        status,
        priority,
        service_type,
        COUNT(*) as count,
        SUM(weight) as total_weight,
        SUM(volume) as total_volume,
        AVG(weight) as avg_weight,
        AVG(volume) as avg_volume
      FROM ${this.tableName}
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at), status, priority, service_type
      ORDER BY delivery_date DESC, status, priority
    `;

    const result = await this.query(query, [startDate, endDate]);
    return result.rows;
  }

  public async findDeliveriesRequiringSpecialHandling(): Promise<Delivery[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE 
        is_fragile = true 
        OR special_handling IS NOT NULL 
        AND special_handling != '[]'::jsonb
      ORDER BY priority DESC, created_at ASC
    `;
    const result = await this.query(query);
    return result.rows;
  }

  public async bulkUpdateStatus(deliveryIds: string[], status: string): Promise<Delivery[]> {
    const placeholders = deliveryIds.map((_, index) => `$${index + 2}`).join(',');
    const query = `
      UPDATE ${this.tableName} 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id IN (${placeholders})
      RETURNING *
    `;

    const params = [status, ...deliveryIds];
    const result = await this.query(query, params);
    return result.rows;
  }
}