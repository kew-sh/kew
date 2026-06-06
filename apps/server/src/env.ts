import { z } from "zod";

const oneIsTrue = z
  .string()
  .optional()
  .transform((v) => v === "1");

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(5399),
    HOST: z.string().default("127.0.0.1"),
    READ_ONLY: oneIsTrue,

    KEW_AUTH_PASSWORD: z
      .string()
      .default("")
      .refine((v) => v.length === 0 || v.length >= 8, {
        message:
          "KEW_AUTH_PASSWORD must be at least 8 characters (leave empty to disable the login)",
      }),
    KEW_AUTH_EMAIL: z.preprocess(
      (v) => (v ? v : undefined),
      z.email("KEW_AUTH_EMAIL must be a valid email address").optional(),
    ),
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
  })
  .refine((e) => !e.KEW_AUTH_EMAIL || e.KEW_AUTH_PASSWORD.length > 0, {
    message:
      "KEW_AUTH_EMAIL is set but KEW_AUTH_PASSWORD is empty; set a password to enable the email + password login",
    path: ["KEW_AUTH_PASSWORD"],
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
