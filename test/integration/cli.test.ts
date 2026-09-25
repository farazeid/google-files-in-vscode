import { run } from "./suite";
describe("Google Files in VS Code", function () {
  this.timeout(60_000);
  it(
    "routes shortcuts, renders recovery UI, preserves unrelated tabs, and opens browser pages",
    run,
  );
});
