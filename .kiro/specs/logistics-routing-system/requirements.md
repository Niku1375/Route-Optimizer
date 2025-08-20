# Requirements Document

## Introduction

This document defines the requirements for a logistics system implementing vehicle routing and fleet management using proven traditional Vehicle Routing Problem (VRP) optimization algorithms such as OR-Tools. It integrates traffic prediction, multi-hub sequencing, vehicle class and capacity constraints, hub-level buffer vehicle management, and real-time data APIs. The system is designed to address Delhi-specific constraints while providing a scalable, secure, and operationally robust routing platform.

## Requirements

### Requirement 1: Fleet and Vehicle Management

**User Story:** As a fleet manager, I want to track vehicle status, location, capacity, and compliance in real time to maintain accurate fleet availability for scheduling and routing.

#### Acceptance Criteria

1. WHEN vehicle details are stored THEN the system SHALL include ID, vehicle class/type, capacity (weight, volume), compliance certificates, and GPS tracking capability
2. WHEN vehicle status changes THEN the system SHALL update location, load status, availability, and compliance flags within 30 seconds
3. WHEN vehicles require maintenance or breakdown THEN the system SHALL auto-mark vehicles unavailable and trigger buffer vehicle allocation at appropriate hubs
4. WHEN live tracking fails THEN the system SHALL use last known GPS position with appropriate staleness alerts to operators

### Requirement 2: Customer Vehicle Availability Interface

**User Story:** As a customer, I want to view available vehicles filtered by location, capacity, and regulatory compliance so I can select suitable vehicles for my delivery needs.

#### Acceptance Criteria

1. WHEN customer requests vehicle availability THEN the system SHALL provide real-time filtered vehicle lists within 30 seconds based on pickup/delivery location, capacity requirements, and delivery time windows
2. WHEN displaying vehicles THEN the system SHALL show only vehicles compliant with active Delhi regulations including zone restrictions, time-based restrictions, odd-even rules, and pollution norms
3. WHEN trucks are requested for residential areas THEN the system SHALL only show availability between 7 AM to 11 PM and suggest alternative vehicles for restricted hours
4. WHEN no vehicles meet criteria THEN the system SHALL suggest alternative pickup locations, delivery time windows, or vehicle class substitutions
5. WHEN filtering is applied THEN the system SHALL allow filtering by vehicle type (truck, tempo, van, three-wheeler) with automatic compliance validation for destination zones
6. WHEN customer selects premium service THEN the system SHALL offer dedicated vehicle options with no load sharing and priority scheduling
7. WHEN premium dedicated service is requested THEN the system SHALL calculate premium pricing based on exclusive vehicle usage and provide guaranteed delivery windows

### Requirement 3: Vehicle Search API

**User Story:** As an application developer, I want a real-time API for vehicle availability and status updates to support customer-facing and internal logistics apps.

#### Acceptance Criteria

1. WHEN /available_vehicles API is called THEN the system SHALL return vehicle ID, GPS location, current load capacity, estimated times, and compliance status within 5 seconds
2. WHEN vehicle compliance is checked THEN the system SHALL validate against all current Delhi-specific regulations dynamically
3. WHEN real-time data is unavailable THEN the system SHALL provide cached data with staleness indicators
4. WHEN API errors occur THEN the system SHALL include robust error handling and degraded service notifications

### Requirement 4: Traffic Prediction Integration

**User Story:** As a routing planner, I want to incorporate traffic forecasting models and APIs so that routing decisions adapt proactively to predicted congestion and environmental factors.

#### Acceptance Criteria

1. WHEN traffic data is available THEN the system SHALL dynamically update routing parameters with traffic forecasts from Google Maps Traffic, Delhi Traffic Police API, IMD Weather, and Ambee Air Quality APIs
2. WHEN congestion is predicted THEN the system SHALL provide alternative routing suggestions within 30 seconds
3. WHEN API outages occur THEN the system SHALL use fallback cached traffic data with operator notifications
4. WHEN historical data is processed THEN the system SHALL support short-term traffic prediction models using traditional ML models like time-series forecasting (ARIMA, regression models)

### Requirement 5: Traditional Routing Solver with OR-Tools

**User Story:** As a logistics planner, I want to use OR-Tools VRP solver to generate optimized delivery routes considering vehicle capacities, delivery time windows, and Delhi-specific regulatory constraints.

#### Acceptance Criteria

1. WHEN routing is requested THEN the system SHALL implement VRP solving using OR-Tools with heuristics, local search, and constraint programming methods
2. WHEN route solutions are generated THEN the system SHALL deliver initial solutions within 10 seconds for typical delivery batch sizes
3. WHEN constraints are applied THEN the system SHALL strictly enforce vehicle capacity constraints (weight and volume), delivery time windows, driver working hours, and region-specific regulations
4. WHEN real-time updates occur THEN the system SHALL support incremental and dynamic re-optimization
5. WHEN solver failures occur THEN the system SHALL employ fallback heuristics to guarantee feasible routing

### Requirement 6: Real-Time Route Updates and Re-Optimization

**User Story:** As a fleet operator, I want routes updated dynamically according to live traffic, vehicle availability, and environmental conditions to maximize route efficiency and compliance.

#### Acceptance Criteria

1. WHEN significant changes occur THEN the system SHALL detect changes in traffic conditions or vehicle availability and trigger re-optimization
2. WHEN re-optimization is triggered THEN the system SHALL compute updated route plans within 30 seconds and push instructions to drivers and dashboards
3. WHEN rerouting occurs THEN the system SHALL log rerouting triggers (traffic congestion, vehicle breakdown, regulatory change) with timestamps
4. WHEN routes are updated THEN the system SHALL ensure minimal disruption to ongoing deliveries during rerouting

### Requirement 7: Map and Routing API Integrations

**User Story:** As a system designer and data scientist, I want to use external APIs like Mapbox and GraphHopper for map visualization, interactive routing, and creating custom geographic test case scenarios.

#### Acceptance Criteria

1. WHEN map visualization is needed THEN the system SHALL integrate Mapbox APIs for interactive map display, scenario generation, and route visualization
2. WHEN navigation data is required THEN the system SHALL leverage GraphHopper APIs for turn-by-turn navigation data and traffic-aware routing simulations
3. WHEN scenarios are created THEN the system SHALL support configurable parameters including vehicle types, delivery constraints, time windows, and regulatory compliance restrictions
4. WHEN testing is performed THEN the system SHALL use scenario data for training, testing, validation, and tuning of routing heuristics

### Requirement 8: Hub-and-Spoke Routing with Vehicle Capacity Constraints

**User Story:** As a system architect, I want the routing solver to support hub-sequenced vehicle routing with explicit vehicle class-based capacity constraints for efficient multi-leg delivery.

#### Acceptance Criteria

1. WHEN routing through hubs THEN the system SHALL route vehicles through sequenced hubs considering multi-leg VRP constraints, including transfer times and hub operations
2. WHEN capacity limits apply THEN the system SHALL enforce vehicle-specific capacity limits (weight and volume) across routes spanning multiple hubs
3. WHEN shipments exceed capacity THEN the system SHALL allow load splitting by optimally dividing across multiple vehicles by class
4. WHEN assigning vehicles THEN the system SHALL optimize assignments considering fuel efficiency, delivery priorities, and proximity to subsequent hubs

### Requirement 9: Vehicle Breakdown Handling and Buffer Vehicle Management

**User Story:** As a fleet manager, I want the system to handle vehicle breakdowns through buffer vehicle allocation at hubs and rapid replacement dispatch to ensure service continuity.

#### Acceptance Criteria

1. WHEN managing buffer fleets THEN the system SHALL maintain buffer fleets at each hub sized using historical breakdown and demand data
2. WHEN breakdowns are detected THEN the system SHALL automatically detect breakdowns and dispatch nearest buffer vehicle within 2 minutes
3. WHEN multiple breakdowns occur THEN the system SHALL coordinate rerouting and load reassignment dynamically
4. WHEN tracking availability THEN the system SHALL continuously track buffer vehicle availability and update fleet status for dispatch decisions

### Requirement 10: Intelligent Vehicle Class Assignment and Load Distribution

**User Story:** As a logistics planner, I want the system to assign vehicles by class intelligently based on shipment weight, volume, delivery route characteristics, and Delhi-specific vehicle restrictions to optimize cost and efficiency.

#### Acceptance Criteria

1. WHEN classifying shipments THEN the system SHALL classify by weight, volume, fragility, handling needs, destination zone type, and delivery time requirements
2. WHEN assigning trucks THEN the system SHALL use trucks for inter-hub transport, warehouse-to-hub deliveries, and residential deliveries only between 7 AM to 11 PM
3. WHEN handling restricted-hour deliveries THEN the system SHALL automatically assign tempos, vans, or three-wheelers for deliveries during truck-restricted hours (11 PM to 7 AM)
4. WHEN routing to congested areas THEN the system SHALL prioritize three-wheelers for narrow lanes and residential zones where maneuverability is critical
5. WHEN calculating vehicle mix THEN the system SHALL optimize vehicle assignments considering time window restrictions, zone access privileges, and pollution compliance requirements
6. WHEN load splitting is required THEN the system SHALL split loads across smaller vehicles during restricted hours while maintaining delivery efficiency

### Requirement 11: Security and Data Privacy

**User Story:** As a security administrator, I require strong security controls to protect customers' and fleet data and to ensure compliance with data privacy laws.

#### Acceptance Criteria

1. WHEN accessing APIs THEN the system SHALL use OAuth 2.0 with robust role-based access control on all APIs and interfaces
2. WHEN handling sensitive data THEN the system SHALL encrypt data at rest and in transit using AES-256 or equivalent
3. WHEN managing data retention THEN the system SHALL apply strict policies with automatic purging of sensitive data older than 12 months
4. WHEN security events occur THEN the system SHALL log and alert on unauthorized access or anomalous behavior in real time

### Requirement 12: Monitoring, Logging, and Alerting

**User Story:** As a DevOps engineer, I want comprehensive monitoring for all system components including APIs, routing solver, traffic prediction modules, and fallback mechanisms.

#### Acceptance Criteria

1. WHEN monitoring systems THEN the system SHALL monitor API response times, traffic API uptime, solver performance, and fallback usage
2. WHEN fallbacks are used THEN the system SHALL log all fallback cache usages and system degradation incidents with timely operator alerts
3. WHEN failures occur THEN the system SHALL enable alerting on routing failures, traffic model inaccuracies, and data pipeline disruptions
4. WHEN reporting metrics THEN the system SHALL provide dashboards showcasing route optimization efficiency, compliance rates, and system uptime statistics

### Requirement 13: Delhi Vehicle Class Movement Restrictions

**User Story:** As a compliance officer, I want the system to enforce Delhi-specific vehicle class movement restrictions to ensure regulatory compliance and avoid penalties.

#### Acceptance Criteria

1. WHEN routing trucks THEN the system SHALL restrict truck movement in residential and commercial areas between 11 PM to 7 AM
2. WHEN assigning tempos and light commercial vehicles THEN the system SHALL allow flexible operation with zone-specific pollution and parking constraints
3. WHEN using three-wheelers THEN the system SHALL leverage their high access privileges for deliveries in congested lanes and narrow residential roads
4. WHEN electric vehicles are available THEN the system SHALL prioritize EVs for pollution-sensitive zones and provide special access privileges
5. WHEN odd-even rules are active THEN the system SHALL validate vehicle license plates against current date restrictions and suggest compliant alternatives
6. WHEN pollution emergencies are declared THEN the system SHALL automatically restrict high-polluting vehicles and reroute using cleaner alternatives
7. WHEN weight/dimension limits apply THEN the system SHALL validate vehicle specifications against zone-specific infrastructure constraints

### Requirement 14: Customer Loyalty and Incentive System

**User Story:** As a customer or MSME with a history of choosing pooled services, I want to receive loyalty incentives and percentage waivers to reward my eco-friendly choices and encourage continued sustainable logistics practices.

#### Acceptance Criteria

1. WHEN customer has pooling history THEN the system SHALL track customer's shared service usage frequency and environmental impact contributions
2. WHEN loyalty tier is calculated THEN the system SHALL assign customers to tiers (Bronze, Silver, Gold, Platinum) based on pooled service usage over 6-month periods
3. WHEN applying loyalty discounts THEN the system SHALL provide percentage waivers (5-25%) on future bookings based on customer tier and pooling frequency
4. WHEN MSME customers choose pooling THEN the system SHALL offer additional business incentives including priority scheduling and bulk booking discounts
5. WHEN environmental milestones are reached THEN the system SHALL reward customers with bonus credits for CO2 savings achieved through pooled deliveries
6. WHEN premium service is requested THEN the system SHALL offer loyalty customers reduced premium pricing based on their pooling history
7. WHEN loyalty benefits expire THEN the system SHALL send proactive notifications about tier maintenance requirements and available incentives

### Requirement 15: Business, Sustainability, and Operational Metrics

**User Story:** As a business stakeholder, I want detailed KPIs and reports on route efficiency, operational cost savings, fuel consumption, and environmental impact.

#### Acceptance Criteria

1. WHEN computing metrics THEN the system SHALL compute total distance, time savings, estimated fuel consumption, and cost metrics for each delivery batch
2. WHEN measuring efficiency THEN the system SHALL ensure routing solutions achieve a minimum of 20% efficiency improvement over unoptimized baseline routes
3. WHEN tracking environmental impact THEN the system SHALL track compliance, reporting on CO2 emissions and fuel savings relative to regulatory targets
4. WHEN generating reports THEN the system SHALL provide periodic reports on ROI including savings from route optimization, buffer vehicle usage, and compliance adherence