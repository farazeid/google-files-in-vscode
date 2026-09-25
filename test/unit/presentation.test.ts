import { test } from "node:test";
import assert from "node:assert/strict";
import { errorPage } from "../../src/presentation";
test("error UI escapes text, restricts scripts, and offers external only for resolved files", () => {
  const html = errorPage("<script>alert(1)</script>", false, "test-nonce");
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes('id="retry"'));
  assert.ok(!html.includes('id="external"'));
  assert.ok(errorPage("Unavailable", true, "nonce").includes('id="external"'));
});
