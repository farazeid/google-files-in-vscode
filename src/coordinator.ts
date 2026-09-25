import { OpenError, safeError } from "./errors";
import type { GoogleFile } from "./shortcut";
export interface BrowserAdapter {
  open(url: string): Promise<void>;
}
export interface Scheduler {
  now(): number;
  after(ms: number, callback: () => void): () => void;
}
export const systemScheduler: Scheduler = {
  now: () => performance.now(),
  after(ms, callback) {
    const timer = setTimeout(callback, ms);
    return () => clearTimeout(timer);
  },
};
export interface OpenResult {
  status: "opened";
  elapsedMs: number;
}
interface Entry {
  promise: Promise<OpenResult>;
  timedOut: boolean;
  consumers: Set<{ active: boolean }>;
}
export class OpenCoordinator {
  private readonly pending = new Map<string, Entry>();
  private tail: Promise<void> = Promise.resolve();
  constructor(
    private readonly browser: BrowserAdapter,
    private readonly clock: Scheduler = systemScheduler,
    private readonly timeoutMs = 15_000,
  ) {}
  open(file: GoogleFile, signal?: AbortSignal): Promise<OpenResult> {
    if (signal?.aborted) return Promise.reject(new OpenError("cancelled"));
    const current = this.pending.get(file.key);
    if (current)
      return current.timedOut
        ? Promise.reject(new OpenError("busy"))
        : this.subscribe(current, signal);
    const started = this.clock.now();
    let resolve!: (value: OpenResult) => void;
    let reject!: (error: OpenError) => void;
    const entry: Entry = {
      promise: new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
      timedOut: false,
      consumers: new Set(),
    };
    this.pending.set(file.key, entry);
    const cancelTimeout = this.clock.after(this.timeoutMs, () => {
      entry.timedOut = true;
      reject(new OpenError("timeout"));
    });
    const work = this.tail.then(async () => {
      if (entry.timedOut) return;
      if (![...entry.consumers].some((consumer) => consumer.active)) {
        reject(new OpenError("cancelled"));
        return;
      }
      try {
        await this.browser.open(file.url);
        if (!entry.timedOut)
          resolve({ status: "opened", elapsedMs: this.clock.now() - started });
      } catch (error) {
        if (!entry.timedOut) reject(safeError(error));
      }
    });
    this.tail = work
      .catch(() => undefined)
      .finally(() => {
        cancelTimeout();
        this.pending.delete(file.key);
      });
    return this.subscribe(entry, signal);
  }
  private subscribe(entry: Entry, signal?: AbortSignal): Promise<OpenResult> {
    const consumer = { active: true };
    entry.consumers.add(consumer);
    return new Promise((resolve, reject) => {
      const cancel = () => {
        consumer.active = false;
        reject(new OpenError("cancelled"));
      };
      const cleanup = () => {
        signal?.removeEventListener("abort", cancel);
        entry.consumers.delete(consumer);
      };
      signal?.addEventListener("abort", cancel, { once: true });
      entry.promise.then(
        (value) => {
          cleanup();
          if (consumer.active) resolve(value);
        },
        (error) => {
          cleanup();
          if (consumer.active) reject(error);
        },
      );
    });
  }
}
