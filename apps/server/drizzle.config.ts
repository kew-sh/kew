import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: `file:${process.env.KEW_RETENTION_DB_PATH ?? "./kew-retention.db"}`,
  },
});
