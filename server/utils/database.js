import { PrismaClient } from '@prisma/client';

// Create a singleton Prisma client instance optimized for Aiven (pooling limit: 20)
class DatabaseClient {
  constructor() {
    if (DatabaseClient.instance) {
      return DatabaseClient.instance;
    }

    // Parse DATABASE_URL to add connection pool parameters for Aiven
    const databaseUrl = process.env.DATABASE_URL;
    const urlWithPooling = databaseUrl.includes('?') 
      ? `${databaseUrl}&connection_limit=15&pool_timeout=30`
      : `${databaseUrl}?connection_limit=15&pool_timeout=30`;

    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      errorFormat: 'minimal',
      datasources: {
        db: {
          url: urlWithPooling
        }
      }
    });

    // Handle graceful shutdown
    this.setupGracefulShutdown();
    
    DatabaseClient.instance = this;
  }

  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      console.log(`Received ${signal}. Gracefully shutting down database connection...`);
      try {
        await this.prisma.$disconnect();
        console.log('Database connection closed successfully.');
        process.exit(0);
      } catch (error) {
        console.error('Error during database shutdown:', error);
        process.exit(1);
      }
    };

    // Handle different termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    // Temporarily disable beforeExit to prevent premature shutdowns
    // process.on('beforeExit', () => gracefulShutdown('beforeExit'));
  }

  // Helper method to retry database operations with exponential backoff
  async retryOperation(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.error(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
        
        // Don't retry certain errors
        if (error.code === 'P2002' || error.code === 'P2025') {
          throw error;
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff: 100ms, 400ms, 1600ms)
        const delay = Math.pow(4, attempt - 1) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Helper method to check database connection health
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { healthy: true, message: 'Database connection is healthy' };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { 
        healthy: false, 
        message: 'Database connection failed', 
        error: error.message 
      };
    }
  }

  // Get the Prisma client instance
  getClient() {
    return this.prisma;
  }

  // Batch multiple queries to reduce connection overhead
  async batchQueries(queries) {
    try {
      return await Promise.all(queries.map(query => query()));
    } catch (error) {
      console.error('Batch query error:', error);
      throw error;
    }
  }
}

// Export singleton instance
const dbClient = new DatabaseClient();
export default dbClient;

// Export Prisma client for direct access
export const prisma = dbClient.getClient();

// Export retry operation helper
export const retryOperation = dbClient.retryOperation.bind(dbClient);

// Export health check
export const healthCheck = dbClient.healthCheck.bind(dbClient);

// Export batch queries helper
export const batchQueries = dbClient.batchQueries.bind(dbClient);