import { z } from "zod";

const oneIsTrue = z
  .string()
  .optional()
  .transform((v) => v === "1");

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("127.0.0.1"),
  READ_ONLY: oneIsTrue,

  KEW_AUTH_TOKEN: z.string().default(""),
  KEW_AUTH_USER: optionalString,
  KEW_SESSION_SECRET: optionalString,
  KEW_TRUST_PROXY_AUTH: oneIsTrue,
  KEW_PROXY_USER_HEADER: z
    .string()
    .default("x-forwarded-user")
    .transform((v) => v.toLowerCase()),
  KEW_TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

  REDIS_URL: z.string().default("redis://localhost:6379"),
  BULLMQ_PREFIX: z.string().default("bull"),

  KEW_RETENTION: oneIsTrue,
  KEW_RETENTION_DB_PATH: z.string().default("./kew-retention.db"),
  KEW_RETENTION_MAX_AGE_DAYS: z.coerce.number().int().min(0).default(30),
  KEW_RETENTION_MAX_ROWS: z.coerce.number().int().min(0).default(0),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("kew: invalid environment:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
