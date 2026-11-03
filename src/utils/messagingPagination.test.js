import test from "node:test";
import assert from "node:assert/strict";
import { messagingDateRange, messagingPage } from "./messagingPagination.js";

test("permite una fecha única, un rango y detecta rangos invertidos", () => {
  assert.deepEqual(messagingDateRange("2026-10-31", "", "2026-10-29"), { from: "2026-10-31", to: "2026-10-31", invalid: false });
  assert.deepEqual(messagingDateRange("", "2026-10-30", "2026-10-29"), { from: "2026-10-30", to: "2026-10-30", invalid: false });
  assert.equal(messagingDateRange("2026-10-29", "2026-10-31", "").invalid, false);
  assert.equal(messagingDateRange("2026-10-31", "2026-10-29", "").invalid, true);
});

test("pagina en grupos de 50 y mantiene una página válida al cambiar los resultados", () => {
  const records = Array.from({ length: 101 }, (_, index) => index);
  assert.deepEqual(messagingPage(records, 2).items, records.slice(50, 100));
  assert.deepEqual(messagingPage(records, 3).items, [100]);
  assert.equal(messagingPage(records.slice(0, 20), 3).current, 1);
  assert.deepEqual(messagingPage([], 1).items, []);
});
