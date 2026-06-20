import type { QueueApi } from "./contract";
import { httpApi } from "./http";

export type { QueueApi } from "./contract";
export * from "./types";

export const api: QueueApi = httpApi;
