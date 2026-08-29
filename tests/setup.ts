// Global test setup. Runs before each test file's module graph is imported, so
// the module-level env reads in the sync scripts see these values.
import { vi } from "vitest";
import "temporal-polyfill/full/global";

vi.stubEnv("FOYS_API_KEY", "test-foys-api-key");
vi.stubEnv("DATABASE_URL", "postgres://test:test@localhost:5432/bestuur_test");
vi.stubEnv("AUTH0_M2M_DOMAIN", "usbasketball.eu.auth0.com");
vi.stubEnv("AUTH0_M2M_CLIENT_ID", "test-m2m-client-id");
vi.stubEnv("AUTH0_M2M_CLIENT_SECRET", "test-m2m-client-secret");