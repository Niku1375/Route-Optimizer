export { BaseRepository } from './BaseRepository';
export { VehicleRepository } from './VehicleRepository';
export { DeliveryRepository } from './DeliveryRepository';
export { RouteRepository } from './RouteRepository';

// Import classes for instantiation
import { VehicleRepository } from './VehicleRepository';
import { DeliveryRepository } from './DeliveryRepository';
import { RouteRepository } from './RouteRepository';

// Repository instances for dependency injection
export const vehicleRepository = new VehicleRepository();
export const deliveryRepository = new DeliveryRepository();
export const routeRepository = new RouteRepository();