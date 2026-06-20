import { Queue, Worker } from "bullmq";
import { createRedis } from "../queue";

// Dev: live load generator so counts and sparklines move. Run: bun run demo
const QUEUES = ["emails", "webhooks", "notifications", "ai-inference"];
const producers = Object.fromEntries(
  QUEUES.map((n) => [n, new Queue(n, { connection: createRedis() })]),
);

for (const name of QUEUES) {
  new Worker(
    name,
    async () => {
      if (name === "ai-inference" && Math.random() < 0.35) {
        throw new Error("RateLimitError: 429 Too Many Requests");
      }
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 400));
      return { ok: true };
    },
    { connection: createRedis(), concurrency: 6 },
  );
}

setInterval(() => {
  const name = QUEUES[Math.floor(Math.random() * QUEUES.length)];
  void producers[name].add("job", { at: Date.now() });
}, 450);

console.log("▶ demo load generator running — trickling jobs. ctrl-c to stop.");
