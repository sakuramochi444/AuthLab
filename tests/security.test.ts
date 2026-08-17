import test from "node:test";
import assert from "node:assert/strict";
import { digest, hashPassword, passwordScore, verifyPassword } from "../lib/security.ts";
test("passwords are salted and verifiable with bcrypt", async () => {
  const first = await hashPassword("VeryStrong!Password2026");
  const second = await hashPassword("VeryStrong!Password2026");
  assert.match(first, /^\$2[aby]\$12\$/);
  assert.notEqual(first, second);
  assert.equal((await verifyPassword("VeryStrong!Password2026", first)).valid, true);
  assert.equal((await verifyPassword("wrong", first)).valid, false);
});
test("strength rejects common passwords", () => {
  assert.ok(passwordScore("VeryStrong!Password2026") >= 3);
  assert.ok(passwordScore("password123") < 3);
});
test("token digest is deterministic", () => {
  assert.equal(digest("token"), digest("token"));
  assert.notEqual(digest("token"), digest("other"));
});
