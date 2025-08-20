-- Logistics Routing System Database Schema
-- PostgreSQL Schema for vehicles, deliveries, routes, hubs, and audit logs

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for geographic data (if needed)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('truck', 'tempo', 'van', 'three-wheeler', 'electric')),
    sub_type VARCHAR(50) NOT NULL,
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    fuel_type VARCHAR(20) NOT NULL CHECK (fuel_type IN ('diesel', 'petrol', 'cng', 'electric')),
    
    -- Capacity specifications
    weight_capacity INTEGER NOT NULL, -- in kg
    volume_capacity DECIMAL(10,2) NOT NULL, -- in cubic meters
    max_length DECIMAL(8,2), -- in meters
    max_width DECIMAL(8,2), -- in meters
    max_height DECIMAL(8,2), -- in meters
    
    -- Current location and status
    current_latitude DECIMAL(10,8),
    current_longitude DECIMAL(11,8),
    location_updated_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in-transit', 'loading', 'maintenance', 'breakdown')),
    
    -- Compliance information
    pollution_level VARCHAR(20) NOT NULL CHECK (pollution_level IN ('BS6', 'BS4', 'BS3', 'electric')),
    pollution_certificate_valid BOOLEAN DEFAULT true,
    permit_valid BOOLEAN DEFAULT true,
    vehicle_age INTEGER, -- in years
    registration_state VARCHAR(10),
    
    -- Access privileges
    residential_zones_access BOOLEAN DEFAULT false,
    commercial_zones_access BOOLEAN DEFAULT true,
    industrial_zones_access BOOLEAN DEFAULT true,
    restricted_hours_access BOOLEAN DEFAULT false,
    pollution_sensitive_zones_access BOOLEAN DEFAULT false,
    narrow_lanes_access BOOLEAN DEFAULT false,
    
    -- Driver information
    driver_id UUID,
    driver_working_hours DECIMAL(4,2) DEFAULT 0,
    driver_max_working_hours DECIMAL(4,2) DEFAULT 8,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Hubs table
CREATE TABLE IF NOT EXISTS hubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    
    -- Location
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    address TEXT,
    
    -- Capacity
    vehicle_capacity INTEGER NOT NULL DEFAULT 50,
    storage_capacity INTEGER, -- in cubic meters
    
    -- Operating hours
    opening_time TIME NOT NULL DEFAULT '06:00',
    closing_time TIME NOT NULL DEFAULT '22:00',
    
    -- Facilities
    facilities JSONB, -- Array of facility types
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID,
    
    -- Pickup information
    pickup_latitude DECIMAL(10,8) NOT NULL,
    pickup_longitude DECIMAL(11,8) NOT NULL,
    pickup_address TEXT,
    pickup_earliest TIMESTAMP WITH TIME ZONE,
    pickup_latest TIMESTAMP WITH TIME ZONE,
    
    -- Delivery information
    delivery_latitude DECIMAL(10,8) NOT NULL,
    delivery_longitude DECIMAL(11,8) NOT NULL,
    delivery_address TEXT,
    delivery_earliest TIMESTAMP WITH TIME ZONE,
    delivery_latest TIMESTAMP WITH TIME ZONE,
    
    -- Shipment details
    weight DECIMAL(10,2) NOT NULL, -- in kg
    volume DECIMAL(10,2) NOT NULL, -- in cubic meters
    is_fragile BOOLEAN DEFAULT false,
    special_handling JSONB, -- Array of special handling requirements
    
    -- Priority and service type
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    service_type VARCHAR(30) NOT NULL DEFAULT 'shared' CHECK (service_type IN ('shared', 'dedicated_premium')),
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    
    -- Route details
    route_name VARCHAR(100),
    estimated_duration INTEGER, -- in minutes
    estimated_distance DECIMAL(10,2), -- in kilometers
    estimated_fuel_consumption DECIMAL(8,2), -- in liters
    
    -- Route data
    stops JSONB NOT NULL, -- Array of route stops with coordinates and details
    traffic_factors JSONB, -- Traffic conditions and factors
    
    -- Status and timing
    status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    planned_start_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    planned_end_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    
    -- Optimization details
    optimization_algorithm VARCHAR(50),
    optimization_time_ms INTEGER,
    efficiency_score DECIMAL(5,2), -- Percentage improvement over baseline
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Route deliveries junction table
CREATE TABLE IF NOT EXISTS route_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    stop_sequence INTEGER NOT NULL,
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    actual_arrival TIMESTAMP WITH TIME ZONE,
    estimated_departure TIMESTAMP WITH TIME ZONE,
    actual_departure TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(route_id, delivery_id),
    UNIQUE(route_id, stop_sequence)
);

-- Customer loyalty profiles table
CREATE TABLE IF NOT EXISTS customer_loyalty_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID UNIQUE NOT NULL,
    customer_type VARCHAR(20) NOT NULL DEFAULT 'individual' CHECK (customer_type IN ('individual', 'msme', 'enterprise')),
    
    -- Loyalty tier information
    loyalty_tier VARCHAR(20) NOT NULL DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum')),
    tier_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tier_expiry_date TIMESTAMP WITH TIME ZONE,
    
    -- Pooling history
    total_pooled_deliveries INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    pooling_frequency DECIMAL(5,2) DEFAULT 0, -- Percentage
    co2_saved_kg DECIMAL(10,2) DEFAULT 0,
    cost_saved_inr DECIMAL(12,2) DEFAULT 0,
    last_six_months_pooling INTEGER DEFAULT 0,
    
    -- Current incentives
    current_discount_percentage DECIMAL(5,2) DEFAULT 0,
    bonus_credits DECIMAL(10,2) DEFAULT 0,
    
    -- MSME specific benefits
    bulk_booking_discount DECIMAL(5,2) DEFAULT 0,
    priority_scheduling BOOLEAN DEFAULT false,
    dedicated_account_manager BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Traffic data table for caching and historical analysis
CREATE TABLE IF NOT EXISTS traffic_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id VARCHAR(100) NOT NULL,
    
    -- Geographic bounds
    north_lat DECIMAL(10,8) NOT NULL,
    south_lat DECIMAL(10,8) NOT NULL,
    east_lng DECIMAL(11,8) NOT NULL,
    west_lng DECIMAL(11,8) NOT NULL,
    
    -- Traffic information
    congestion_level VARCHAR(20) NOT NULL CHECK (congestion_level IN ('light', 'moderate', 'heavy', 'severe')),
    average_speed DECIMAL(5,2), -- km/h
    travel_time_factor DECIMAL(4,2), -- Multiplier for normal travel time
    
    -- Data source and timing
    data_source VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional factors
    weather_conditions JSONB,
    special_events JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance rules table for Delhi-specific regulations
CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_type VARCHAR(50) NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    
    -- Rule details
    vehicle_types JSONB, -- Array of applicable vehicle types
    zone_types JSONB, -- Array of applicable zone types
    time_restrictions JSONB, -- Time-based restrictions
    
    -- Rule configuration
    is_active BOOLEAN DEFAULT true,
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP WITH TIME ZONE,
    
    -- Rule data
    rule_data JSONB NOT NULL, -- Specific rule parameters
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table for system activity tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event information
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(30) NOT NULL CHECK (event_category IN ('vehicle', 'route', 'delivery', 'user', 'system', 'compliance')),
    event_description TEXT,
    
    -- Entity information
    entity_type VARCHAR(50),
    entity_id UUID,
    
    -- User and session information
    user_id UUID,
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    
    -- Event data
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    
    -- Timing
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Severity and status
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'partial'))
);

-- Buffer vehicles table for hub-level buffer management
CREATE TABLE IF NOT EXISTS buffer_vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hub_id UUID NOT NULL REFERENCES hubs(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    
    -- Buffer status
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'allocated', 'in_use', 'maintenance')),
    allocated_at TIMESTAMP WITH TIME ZONE,
    allocation_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(hub_id, vehicle_id)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_location ON vehicles(current_latitude, current_longitude);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);

CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location ON deliveries(pickup_latitude, pickup_longitude);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_location ON deliveries(delivery_latitude, delivery_longitude);
CREATE INDEX IF NOT EXISTS idx_deliveries_time_window ON deliveries(pickup_earliest, pickup_latest);

CREATE INDEX IF NOT EXISTS idx_routes_vehicle ON routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_timing ON routes(planned_start_time, planned_end_time);

CREATE INDEX IF NOT EXISTS idx_route_deliveries_route ON route_deliveries(route_id);
CREATE INDEX IF NOT EXISTS idx_route_deliveries_delivery ON route_deliveries(delivery_id);
CREATE INDEX IF NOT EXISTS idx_route_deliveries_sequence ON route_deliveries(route_id, stop_sequence);

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_customer ON customer_loyalty_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_tier ON customer_loyalty_profiles(loyalty_tier);

CREATE INDEX IF NOT EXISTS idx_traffic_data_area ON traffic_data(area_id);
CREATE INDEX IF NOT EXISTS idx_traffic_data_timestamp ON traffic_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_traffic_data_expires ON traffic_data(expires_at);

CREATE INDEX IF NOT EXISTS idx_compliance_rules_type ON compliance_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_active ON compliance_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_buffer_vehicles_hub ON buffer_vehicles(hub_id);
CREATE INDEX IF NOT EXISTS idx_buffer_vehicles_status ON buffer_vehicles(status);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hubs_updated_at BEFORE UPDATE ON hubs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_loyalty_profiles_updated_at BEFORE UPDATE ON customer_loyalty_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_rules_updated_at BEFORE UPDATE ON compliance_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buffer_vehicles_updated_at BEFORE UPDATE ON buffer_vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();