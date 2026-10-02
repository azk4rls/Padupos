import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { config } from '../config/index.js';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let queryClient: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!dbInstance) {
    queryClient = postgres(config.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    dbInstance = drizzle(queryClient, { schema });
  }
  return dbInstance;
}

export async function closeDb() {
  if (queryClient) {
    await queryClient.end();
    queryClient = null;
    dbInstance = null;
  }
}

export { schema };
