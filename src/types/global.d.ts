/**
 * Global type declarations for test utilities
 */

declare global {
  // eslint-disable-next-line no-var
  var testUtils: {
    mockDate: (date: string | Date) => Date;
    restoreDate: () => void;
    generateTestVehicle: (overrides?: any) => any;
    generateTestDelivery: (overrides?: any) => any;
    generateTestHub: (overrides?: any) => any;
    generateTestRoute: (overrides?: any) => any;
  };
}

export {};