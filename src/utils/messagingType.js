export function messagingType(delivery, runDate) {
  const text = String(delivery.message || "").toLocaleLowerCase("es");
  if (text.includes("además, le recordamos sus próximas cuotas:")) return "combined";

  const dueDate = String(delivery.due_date || "").slice(0, 10);
  const date = String(runDate || "").slice(0, 10);
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  if (!valid.test(dueDate) || !valid.test(date)) return "unknown";
  return dueDate < date ? "collection" : "reminder";
}

export function matchesMessagingType(type, filter) {
  return filter === "all" || type === filter || (type === "combined" && (filter === "collection" || filter === "reminder"));
}
