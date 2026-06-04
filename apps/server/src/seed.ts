import { FlowProducer, Queue, Worker } from "bullmq";
import { createRedis } from "./redis";

/**
 * Populates Redis with a realistic, varied snapshot of BullMQ data so the
 * dashboard has something true to render. Run once: `bun run seed`.
 * (`active` is transient, so it stays ~0 here; run `bun run demo` for live load.)
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ALL = ["emails", "ai-inference", "media-processing", "webhooks", "exports", "notifications"];

async function drain(name: string, processor: (job: { data: any }) => Promise<unknown>, ms: number) {
  const worker = new Worker(name, processor as never, { connection: createRedis(), concurrency: 16 });
  await wait(ms);
  await worker.close();
}

async function main() {
  const connection = createRedis();
  const q = (name: string) => new Queue(name, { connection });

  for (const name of ALL) {
    await q(name).obliterate({ force: true }).catch(() => {});
  }

  // emails — healthy: lots completed, a few failed, one delayed, a cron scheduler
  const emails = q("emails");
  for (let i = 0; i < 300; i++) await emails.add("welcome-email", { to: `user${i}@example.com` });
  for (let i = 0; i < 6; i++) await emails.add("digest", { _fail: true });
  await emails.add("reminder", { userId: 42 }, { delay: 10 * 60_000 });
  await emails.upsertJobScheduler("daily-digest", { pattern: "0 9 * * *" }, { name: "digest", data: { scheduled: true } });

  // ai-inference — failing: token-heavy jobs, ~2/3 hit a provider error
  const ai = q("ai-inference");
  for (let i = 0; i < 220; i++)
    await ai.add("embed-document", { model: "claude-sonnet", tokens: 1200, _fail: i % 3 !== 0 });

  // media-processing — backed up: huge waiting backlog, some delayed + prioritized, no worker
  const media = q("media-processing");
  for (let i = 0; i < 1500; i++) await media.add("transcode-video", { assetId: `ast_${i}` });
  for (let i = 0; i < 20; i++) await media.add("optimize-image", {}, { delay: (i + 1) * 30_000 });
  for (let i = 0; i < 5; i++) await media.add("urgent-reencode", {}, { priority: 1 });

  // webhooks — healthy
  const webhooks = q("webhooks");
  for (let i = 0; i < 120; i++) await webhooks.add("stripe-event", { type: "invoice.paid" });

  // exports — paused with a backlog
  const exportsQ = q("exports");
  for (let i = 0; i < 80; i++) await exportsQ.add("csv-export", { rows: 1000 });
  await exportsQ.pause();

  // notifications — idle (small, fully drained)
  const notifications = q("notifications");
  for (let i = 0; i < 20; i++) await notifications.add("push", { device: "ios" });

  // a flow → parent sits in waiting-children until its children finish
  const flow = new FlowProducer({ connection });
  await flow.add({
    name: "assemble-report",
    queueName: "media-processing",
    children: [
      { name: "render-chart", queueName: "media-processing", data: {} },
      { name: "build-summary", queueName: "media-processing", data: {} },
      { name: "make-cover", queueName: "media-processing", data: {} },
    ],
  });

  // process a few queues to create completed/failed states
  await Promise.all([
    drain("emails", async (j) => {
      if (j.data?._fail) throw new Error("RateLimitError: 429 Too Many Requests");
      await wait(3);
      return { ok: true };
    }, 4500),
    drain("ai-inference", async (j) => {
      if (j.data?._fail) throw new Error("TimeoutError: provider timed out after 30000ms");
      await wait(8);
      return { embedding: "[…]" };
    }, 4500),
    drain("webhooks", async () => {
      await wait(2);
      return { delivered: true };
    }, 3000),
    drain("notifications", async () => {
      await wait(2);
      return { sent: true };
    }, 2000),
  ]);

  console.log("✓ seed complete — queues populated with a realistic snapshot");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
