export function calendarDays(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return [
    ...Array(leading).fill(null),
    ...Array.from({ length: count }, (_, index) =>
      new Date(Date.UTC(year, monthNumber - 1, index + 1)).toISOString().slice(0, 10)),
  ];
}

export function moveCalendarMonth(month, change) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + change, 1)).toISOString().slice(0, 7);
}

export function selectCalendarDay(selection, day) {
  if (!selection.selectingEnd) return { start: day, end: "", selectingEnd: true };
  return {
    start: day < selection.start ? day : selection.start,
    end: day < selection.start ? selection.start : day,
    selectingEnd: false,
  };
}
