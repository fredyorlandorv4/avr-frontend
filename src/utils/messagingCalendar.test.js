import test from "node:test";
import assert from "node:assert/strict";
import { calendarDays, moveCalendarMonth, selectCalendarDay } from "./messagingCalendar.js";

test("el calendario respeta meses, años bisiestos y semana iniciada en lunes", () => {
  const days = calendarDays("2024-02");
  assert.deepEqual(days.slice(0, 5), [null, null, null, "2024-02-01", "2024-02-02"]);
  assert.equal(days.at(-1), "2024-02-29");
  assert.equal(moveCalendarMonth("2026-01", -1), "2025-12");
  assert.equal(moveCalendarMonth("2026-12", 1), "2027-01");
});

test("selecciona una fecha o un rango incluso en orden inverso", () => {
  const first = selectCalendarDay({ selectingEnd: false }, "2026-11-10");
  assert.deepEqual(first, { start: "2026-11-10", end: "", selectingEnd: true });
  const range = selectCalendarDay(first, "2026-11-01");
  assert.deepEqual(range, { start: "2026-11-01", end: "2026-11-10", selectingEnd: false });
  assert.deepEqual(selectCalendarDay(range, "2026-11-20"), { start: "2026-11-20", end: "", selectingEnd: true });
});
