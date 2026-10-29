import test from "node:test";
import assert from "node:assert/strict";
import { messagingType, matchesMessagingType } from "./messagingType.js";

test("clasifica según el día del lote y no el día en que se consulta", () => {
  assert.equal(messagingType({ due_date: "2026-10-28" }, "2026-10-29"), "collection");
  assert.equal(messagingType({ due_date: "2026-10-29" }, "2026-10-29"), "reminder");
  assert.equal(messagingType({ due_date: "2026-10-31" }, "2026-10-29"), "reminder");
  assert.equal(messagingType({}, "2026-10-29"), "unknown");
});

test("un mensaje combinado aparece en ambos filtros", () => {
  const type = messagingType({ due_date: "2026-10-28", message: "Cobro\n\nAdemás, le recordamos sus próximas cuotas:" }, "2026-10-29");
  assert.equal(type, "combined");
  assert.equal(matchesMessagingType(type, "collection"), true);
  assert.equal(matchesMessagingType(type, "reminder"), true);
  assert.equal(matchesMessagingType("reminder", "collection"), false);
});
