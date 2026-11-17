import test from "node:test";
import assert from "node:assert/strict";
import { messagingType, matchesMessagingType } from "./messagingType.js";

test("identifica estados de cuenta como su propio tipo de mensaje", () => {
  const type = messagingType({ message_type: "statement", due_date: "2026-11-17" }, "2026-11-17");
  assert.equal(type, "statement");
  assert.equal(matchesMessagingType(type, "statement"), true);
  assert.equal(matchesMessagingType(type, "reminder"), false);
});

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
