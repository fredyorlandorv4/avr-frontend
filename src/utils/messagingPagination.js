export const MESSAGING_PAGE_SIZE = 50;

export function messagingDateRange(start, end, today) {
  const from = start || end || today;
  const to = end || start || today;
  return { from, to, invalid: from > to };
}

export function messagingPage(items, page) {
  const pages = Math.max(1, Math.ceil(items.length / MESSAGING_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  return { current, pages, items: items.slice((current - 1) * MESSAGING_PAGE_SIZE, current * MESSAGING_PAGE_SIZE) };
}
