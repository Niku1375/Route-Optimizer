import { APIServer } from './api/server';
import Logger from './utils/logger';

async function startServer() {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const server = new APIServer();
    
    await server.start(port);
    
    Logger.info('🚀 Logistics Routing System API Server started successfully', {
      port,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      Logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        await server.stop();
        Logger.info('Server stopped gracefully');
        process.exit(0);
      } catch (error) {
        Logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    Logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { startServer };