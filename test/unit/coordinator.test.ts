import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenCoordinator, type Scheduler } from "../../src/coordinator";
import { OpenError } from "../../src/errors";
import { resolveShortcut } from "../../src/shortcut";
const file = (id: string) =>
  resolveShortcut(".gdoc", JSON.stringify({ doc_id: id }));
function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
class Clock implements Scheduler {
  time = 0;
  tasks = new Set<() => void>();
  now() {
    return this.time;
  }
  after(_ms: number, callback: () => void) {
    this.tasks.add(callback);
    return () => this.tasks.delete(callback);
  }
  expire() {
    this.time += 15000;
    for (const cb of this.tasks) cb();
  }
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
test("coalesces in-flight duplicates; later opens intentionally create new tabs", async () => {
  const pending = deferred();
  let calls = 0;
  const c = new OpenCoordinator({
    async open() {
      calls++;
      await pending.promise;
    },
  });
  const a = c.open(file("a"));
  const b = c.open(file("a"));
  await flush();
  assert.equal(calls, 1);
  pending.resolve();
  await Promise.all([a, b]);
  await flush();
  await c.open(file("a"));
  assert.equal(calls, 2);
});
test("serializes different documents", async () => {
  const pending = deferred();
  const calls: string[] = [];
  const c = new OpenCoordinator({
    async open(url) {
      calls.push(url);
      if (calls.length === 1) await pending.promise;
    },
  });
  const a = c.open(file("a"));
  const b = c.open(file("b"));
  await flush();
  assert.equal(calls.length, 1);
  pending.resolve();
  await Promise.all([a, b]);
  assert.equal(calls.length, 2);
});
test("timeout preserves lock until the underlying command settles", async () => {
  const clock = new Clock();
  const pending = deferred();
  let calls = 0;
  const c = new OpenCoordinator(
    {
      async open() {
        calls++;
        await pending.promise;
      },
    },
    clock,
  );
  const first = c.open(file("a"));
  await flush();
  clock.expire();
  await assert.rejects(
    first,
    (e: unknown) => e instanceof OpenError && e.code === "timeout",
  );
  await assert.rejects(
    c.open(file("a")),
    (e: unknown) => e instanceof OpenError && e.code === "busy",
  );
  assert.equal(calls, 1);
  pending.resolve();
  await flush();
  await c.open(file("a"));
  assert.equal(calls, 2);
});
test("expired queued work never starts later", async () => {
  const clock = new Clock();
  const pending = deferred();
  let calls = 0;
  const c = new OpenCoordinator(
    {
      async open() {
        calls++;
        await pending.promise;
      },
    },
    clock,
  );
  const a = c.open(file("a"));
  const b = c.open(file("b"));
  await flush();
  clock.expire();
  await Promise.all([assert.rejects(a), assert.rejects(b)]);
  pending.resolve();
  await flush();
  assert.equal(calls, 1);
});
test("errors are sanitized and retries work after failure", async () => {
  let fail = true;
  const c = new OpenCoordinator({
    async open() {
      if (fail) throw Error("private URL and token");
    },
  });
  await assert.rejects(
    c.open(file("a")),
    (e: unknown) =>
      e instanceof OpenError &&
      e.code === "failed" &&
      !e.message.includes("token"),
  );
  await flush();
  fail = false;
  assert.equal((await c.open(file("a"))).status, "opened");
});
test("cancelled queued requests never open a browser", async () => {
  const pending = deferred();
  let calls = 0;
  const c = new OpenCoordinator({
    async open() {
      calls++;
      await pending.promise;
    },
  });
  const a = c.open(file("a"));
  const abort = new AbortController();
  const b = c.open(file("b"), abort.signal);
  abort.abort();
  await assert.rejects(
    b,
    (e: unknown) => e instanceof OpenError && e.code === "cancelled",
  );
  pending.resolve();
  await a;
  await flush();
  assert.equal(calls, 1);
});
test("cancelling one consumer does not cancel another request for the same file", async () => {
  const pending = deferred();
  let calls = 0;
  const c = new OpenCoordinator({
    async open() {
      calls++;
      await pending.promise;
    },
  });
  const abort = new AbortController();
  const a = c.open(file("a"), abort.signal);
  const b = c.open(file("a"));
  abort.abort();
  await assert.rejects(a);
  pending.resolve();
  await b;
  assert.equal(calls, 1);
});
test("already-cancelled request does not reach browser", async () => {
  let calls = 0;
  const c = new OpenCoordinator({
    async open() {
      calls++;
    },
  });
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(c.open(file("a"), abort.signal));
  assert.equal(calls, 0);
});
