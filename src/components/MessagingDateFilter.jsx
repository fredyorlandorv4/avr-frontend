import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarDays, moveCalendarMonth, selectCalendarDay } from "../utils/messagingCalendar.js";

const dateLabel = (value) => new Intl.DateTimeFormat("es-GT", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
}).format(new Date(`${value}T00:00:00Z`));

export default function MessagingDateFilter({ from, to, today, onApply }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(from.slice(0, 7));
  const [selection, setSelection] = useState({ start: from, end: from === to ? "" : to, selectingEnd: false });
  const container = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onOutside = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open]);

  const showCalendar = () => {
    setSelection({ start: from, end: from === to ? "" : to, selectingEnd: false });
    setMonth(from.slice(0, 7));
    setOpen((current) => !current);
  };
  const apply = () => {
    onApply(selection.start, selection.end);
    setOpen(false);
    trigger.current?.focus();
  };
  const monthLabel = new Intl.DateTimeFormat("es-GT", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div ref={container} className="relative">
      <button ref={trigger} type="button" onClick={showCalendar} aria-expanded={open} aria-controls="messaging-calendar" className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700">
        <CalendarDays className="h-4 w-4 shrink-0" />
        {dateLabel(from)}{from !== to ? ` – ${dateLabel(to)}` : ""}
      </button>
      {open && (
        <div id="messaging-calendar" role="dialog" aria-label="Seleccionar fechas de mensajería" className="absolute left-0 top-full z-30 mt-2 w-[min(21rem,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setMonth((current) => moveCalendarMonth(current, -1))} aria-label="Mes anterior" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-semibold capitalize text-slate-800" aria-live="polite">{monthLabel}</span>
            <button type="button" onClick={() => setMonth((current) => moveCalendarMonth(current, 1))} aria-label="Mes siguiente" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold text-slate-500" aria-hidden="true">
            {["L", "M", "X", "J", "V", "S", "D"].map((day, index) => <span key={`${day}-${index}`} className="py-2">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {calendarDays(month).map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const endpoint = day === selection.start || day === selection.end;
              const inRange = selection.end && day > selection.start && day < selection.end;
              return <button key={day} type="button" aria-label={dateLabel(day)} aria-pressed={Boolean(endpoint || inRange)} onClick={() => setSelection((current) => selectCalendarDay(current, day))} className={`mx-auto h-9 w-9 rounded-lg !p-0 text-sm ${endpoint ? "!bg-[#053E68] !text-white" : inRange ? "bg-blue-100 text-blue-900" : "text-slate-700 hover:bg-slate-100"}`}>{Number(day.slice(-2))}</button>;
            })}
          </div>
          <p className="mt-3 min-h-10 text-xs text-slate-500" aria-live="polite">
            {selection.end ? `${dateLabel(selection.start)} – ${dateLabel(selection.end)}` : `${dateLabel(selection.start)}. Selecciona otra fecha para crear un rango o aplica para elegir un día.`}
          </p>
          <div className="mt-3 flex justify-between gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => { setMonth(today.slice(0, 7)); setSelection({ start: today, end: "", selectingEnd: true }); }} className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Hoy</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancelar</button>
              <button type="button" onClick={apply} className="rounded-lg !bg-[#053E68] px-3 py-2 text-sm font-semibold !text-white">Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
