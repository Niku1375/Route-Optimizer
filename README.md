# Logistics Routing System

A comprehensive logistics routing system implementing Vehicle Routing Problem (VRP) optimization with Delhi-specific compliance features, built with TypeScript and OR-Tools.

## Features

- **Vehicle Fleet Management**: Real-time tracking and status management
- **Route Optimization**: OR-Tools VRP solver with traditional ML models
- **Delhi Compliance**: Vehicle class restrictions, odd-even rules, pollution zones
- **Hub-and-Spoke Operations**: Multi-hub routing with buffer vehicle management
- **Traffic Prediction**: Integration with external APIs for real-time traffic data
- **Premium Services**: Dedicated vehicle options with loyalty incentives
- **Real-time Updates**: Dynamic route re-optimization and live tracking

## Project Structure

```
src/
├── models/           # Data models and interfaces
│   ├── Vehicle.ts    # Vehicle model with Delhi compliance
│   ├── Delivery.ts   # Delivery and shipment models
│   ├── Hub.ts        # Hub operations and management
│   ├── Route.ts      # Route optimization results
│   ├── GeoLocation.ts # Geographic data models
│   └── Common.ts     # Shared types and enums
├── services/         # Business logic services
├── api/              # REST API endpoints and controllers
└── utils/            # Utilities and helpers
    ├── logger.ts     # Winston logging configuration
    ├── errors.ts     # Custom error classes
    ├── validation.ts # Input validation utilities
    ├── constants.ts  # System constants
    └── helpers.ts    # General utility functions
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- TypeScript 5+

### Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run tests:
```bash
npm test
```

4. Run with coverage:
```bash
npm run test:coverage
```

### Development

- **Development mode**: `npm run dev`
- **Watch tests**: `npm run test:watch`
- **Linting**: `npm run lint`

## Core Models

### Vehicle Model
Comprehensive vehicle representation with Delhi-specific compliance features:
- Vehicle specifications and capacity constraints
- Real-time location and status tracking
- Compliance validation (pollution, odd-even, time restrictions)
- Access privileges for different zone types
- Driver information and working hours

### Delivery Model
Detailed delivery requirements and shipment information:
- Pickup and delivery locations with time windows
- Shipment details (weight, volume, special handling)
- Service type selection (shared vs premium dedicated)
- Priority levels and special requirements

### Hub Model
Hub operations and buffer vehicle management:
- Hub capacity and facility information
- Buffer vehicle allocation and tracking
- Operating hours and contact information
- Loading and transfer operations

### Route Model
Optimized route results with compliance validation:
- Route stops with estimated and actual times
- Traffic factors and optimization metadata
- Compliance validation results
- Performance metrics and tracking

## Validation and Error Handling

The system includes comprehensive validation utilities:
- Geographic coordinate validation
- Time window validation
- Capacity constraint validation
- Delhi plate number format validation
- Indian phone number validation
- Custom error classes with proper error codes

## Testing

- **Unit Tests**: Comprehensive test coverage for all models and utilities
- **Test Utilities**: Helper functions for generating test data
- **Coverage Target**: 90% code coverage requirement
- **Test Framework**: Jest with TypeScript support

## Delhi-Specific Features

### Vehicle Class Restrictions
- Truck restrictions in residential areas (11 PM - 7 AM)
- Zone-based access privileges
- Vehicle type optimization for narrow lanes

### Compliance Validation
- Odd-even rule enforcement based on plate numbers
- Pollution zone access validation
- Time-based restriction checking
- Alternative vehicle suggestions

### Environmental Impact
- CO2 savings tracking through pooled deliveries
- Fuel consumption optimization
- Environmental impact reporting

## Constants and Configuration

System-wide constants for:
- Delhi vehicle movement restrictions
- Performance targets and timeouts
- Business logic parameters
- API endpoints and rate limits
- Error codes and HTTP status codes

## Logging

Centralized logging with Winston:
- Multiple log levels (error, warn, info, debug)
- File and console output
- Structured logging with timestamps
- Environment-specific configuration

## Next Steps

This foundation provides the core structure for implementing:
1. Fleet management services
2. Route optimization with OR-Tools
3. Traffic prediction integration
4. API endpoints and controllers
5. Database integration
6. Real-time updates and monitoring

## License

MIT License - see LICENSE file for details.