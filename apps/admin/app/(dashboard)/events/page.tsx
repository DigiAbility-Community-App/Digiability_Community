"use client";

import { useEffect, useState, useRef } from "react";
import {
  Plus, Search, ChevronDown, Download, ChevronLeft, ChevronRight,
  MapPin, Clock, X, Loader2, Tag, ExternalLink, Trash2, Calendar,
  Edit3, Upload, Image as ImageIcon, CheckCircle2,
} from "lucide-react";

interface EventType {
  id: string;
  title: string;
  category: string;
  location: string;
  date: string;
  time: string | null;
  image: string;
  description: string;
  spots: number;
  buttonType: string;
  externalUrl: string;
  organizer: string;
  accessibility_tags: string;
}

// Static calendar widget helpers
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_ABBREVS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/** Format a date string to DD/MM/YYYY display format.
 *  Handles ISO (YYYY-MM-DD), "15 August 2026", "15/08/2026" inputs. */
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  // ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [, mo, dy] = dateStr.split("-");
    const yr = dateStr.split("-")[0];
    return `${dy}/${mo}/${yr}`;
  }
  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  // "15 August 2026" or "15 March"
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length >= 2) {
    const dayNum = parseInt(parts[0], 10);
    const monthIdx = MONTH_ABBREVS.indexOf(parts[1].toLowerCase().slice(0, 3));
    if (!isNaN(dayNum) && monthIdx !== -1) {
      const yr = parts[2] ? parts[2] : String(new Date().getFullYear());
      return `${String(dayNum).padStart(2, "0")}/${String(monthIdx + 1).padStart(2, "0")}/${yr}`;
    }
  }
  return dateStr;
}

/** Format HH:MM to 10:00 AM */
function formatTimeDisplay(t: string): string {
  if (!t) return "";
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t;
  const h = parseInt(m[1], 10);
  const min = m[2];
  return `${h % 12 || 12}:${min} ${h >= 12 ? "PM" : "AM"}`;
}

/** Parse a date string in multiple formats into { day, month (0-indexed), year }.
 *  Handles: YYYY-MM-DD, DD/MM/YYYY, "15 March 2026", "March 15 2026" */
function parseEventDate(dateStr: string): { day: number; month: number; year: number } | null {
  if (!dateStr) return null;
  dateStr = dateStr.trim();

  // ISO format YYYY-MM-DD
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return { year: parseInt(isoMatch[1]), month: parseInt(isoMatch[2]) - 1, day: parseInt(isoMatch[3]) };
  }

  // DD/MM/YYYY format
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    return { day: parseInt(dmyMatch[1]), month: parseInt(dmyMatch[2]) - 1, year: parseInt(dmyMatch[3]) };
  }

  // "15 March 2026" or "15 March"
  const parts = dateStr.split(/\s+/);
  if (parts.length >= 2) {
    const dayNum = parseInt(parts[0], 10);
    const monthIdx = MONTH_ABBREVS.indexOf(parts[1].toLowerCase().slice(0, 3));
    if (!isNaN(dayNum) && monthIdx !== -1) {
      const yr = parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear();
      return { day: dayNum, month: monthIdx, year: yr };
    }
    // "March 15 2026"
    const altMonthIdx = MONTH_ABBREVS.indexOf(parts[0].toLowerCase().slice(0, 3));
    const altDay = parseInt(parts[1], 10);
    if (altMonthIdx !== -1 && !isNaN(altDay)) {
      const yr = parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear();
      return { day: altDay, month: altMonthIdx, year: yr };
    }
  }
  return null;
}

const DEFAULT_CATEGORIES = [
  "Medical Support",
  "Legal Aid",
  "Skill Training",
  "Assistive Technology",
  "General Support",
  "Awareness",
];

export default function EventsPage() {
  const [events, setEvents] = useState<EventType[]>([]);
  const [masterCategories, setMasterCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calSelectedDay, setCalSelectedDay] = useState<number | null>(null);

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [useUrlInput, setUseUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "Medical Support",
    location: "",
    date: "",
    timeFrom: "",
    timeTo: "",
    image: "",
    description: "",
    spots: "50",
    buttonType: "filled",
    externalUrl: "",
    organizer: "",
    accessibilityTags: "",
  });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.success) setEvents(data.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterCategories = async () => {
    try {
      const res = await fetch("/api/settings/event-categories");
      const data = await res.json();
      if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
        const activeNames = data.categories
          .filter((c: any) => c.status === "Active")
          .map((c: any) => c.name);
        if (activeNames.length > 0) {
          setMasterCategories(activeNames);
        }
      }
    } catch (e) {
      console.error("Failed to load master categories:", e);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchMasterCategories();
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image size exceeds 5MB. Please choose a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setFormData(prev => ({ ...prev, image: base64 }));
      setErrorMsg("");
    };
    reader.readAsDataURL(file);
  };

  const handleOpenCreate = () => {
    setEditingEventId(null);
    setFormData({
      title: "",
      category: masterCategories[0] || "Medical Support",
      location: "",
      date: "",
      timeFrom: "",
      timeTo: "",
      image: "",
      description: "",
      spots: "50",
      buttonType: "filled",
      externalUrl: "",
      organizer: "",
      accessibilityTags: "",
    });
    setErrorMsg("");
    setSuccessMsg("");
    setUseUrlInput(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ev: EventType) => {
    setEditingEventId(ev.id);
    // Parse existing time string (e.g. "10:00 AM - 1:00 PM" or "10:00-13:00") back into HH:MM
    const parseToHHMM = (str: string): string => {
      if (!str) return "";
      const m24 = str.match(/^(\d{1,2}):(\d{2})$/);
      if (m24) return str.padStart(5, "0");
      const m12 = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (m12) {
        let h = parseInt(m12[1], 10);
        const mins = m12[2];
        const meridiem = m12[3].toUpperCase();
        if (meridiem === "PM" && h !== 12) h += 12;
        if (meridiem === "AM" && h === 12) h = 0;
        return `${h.toString().padStart(2, "0")}:${mins}`;
      }
      return "";
    };
    const timeParts = (ev.time || "").split("-").map(s => s.trim());
    setFormData({
      title: ev.title || "",
      category: ev.category || masterCategories[0] || "Medical Support",
      location: ev.location || "",
      date: ev.date || "",
      timeFrom: parseToHHMM(timeParts[0] || ""),
      timeTo: parseToHHMM(timeParts[1] || ""),
      image: ev.image || "",
      description: ev.description || "",
      spots: String(ev.spots || 50),
      buttonType: ev.buttonType || "filled",
      externalUrl: ev.externalUrl || "",
      organizer: ev.organizer || "",
      accessibilityTags: ev.accessibility_tags || "",
    });
    setErrorMsg("");
    setSuccessMsg("");
    setUseUrlInput(!ev.image.startsWith("data:"));
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image.trim()) {
      setErrorMsg("Please upload an event image from your device.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const isEdit = Boolean(editingEventId);
      const url = isEdit ? `/api/events/${editingEventId}` : "/api/events";
      const method = isEdit ? "PATCH" : "POST";

      // Build combined time string "10:00 AM – 1:00 PM"
      const buildTimeString = () => {
        const { timeFrom, timeTo } = formData;
        if (!timeFrom && !timeTo) return "";
        const fmt = (hhmm: string) => formatTimeDisplay(hhmm);
        if (timeFrom && timeTo) return `${fmt(timeFrom)} – ${fmt(timeTo)}`;
        return fmt(timeFrom || timeTo);
      };

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timeFrom, timeTo, ...rest } = formData;
      const payload = { ...rest, time: buildTimeString() };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(isEdit ? "Event updated successfully!" : "Event published successfully!");
        fetchEvents();
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessMsg("");
          setEditingEventId(null);
        }, 1000);
      } else {
        setErrorMsg(data.message || "Failed to save event.");
      }
    } catch {
      setErrorMsg("Unexpected error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete event "${title}"?`)) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setEvents(prev => prev.filter(e => e.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Title", "Category", "Organizer", "Date", "Time", "Location", "Spots", "External URL"];
    const rows = filtered.map(e => [
      `"${(e.title || "").replace(/"/g, '""')}"`,
      `"${(e.category || "").replace(/"/g, '""')}"`,
      `"${(e.organizer || "").replace(/"/g, '""')}"`,
      `"${(e.date || "").replace(/"/g, '""')}"`,
      `"${(e.time || "").replace(/"/g, '""')}"`,
      `"${(e.location || "").replace(/"/g, '""')}"`,
      e.spots,
      `"${(e.externalUrl || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `events_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // All combined available categories for filtering
  const allFilterCategories = Array.from(new Set([...masterCategories, ...events.map(e => e.category)])).filter(Boolean);

  const filtered = events.filter(ev => {
    const s = search.toLowerCase();
    const matchSearch = ev.title.toLowerCase().includes(s) || ev.location.toLowerCase().includes(s) || ev.category.toLowerCase().includes(s);
    const matchCat = categoryFilter === "All" || ev.category === categoryFilter;
    const matchCity = !cityFilter || ev.location.toLowerCase().includes(cityFilter.toLowerCase());
    return matchSearch && matchCat && matchCity;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Category breakdown
  const catBreakdown = allFilterCategories.map(cat => ({
    name: cat.toUpperCase(),
    count: events.filter(e => e.category === cat).length,
    color: { "Medical Support": "#7004DC", "Legal Aid": "#DC2626", "Skill Training": "#D2A500", "Awareness": "#10b981", "Assistive Technology": "#3b82f6", "General Support": "#94a3b8" }[cat] || "#7004DC",
  })).filter(c => c.count > 0);

  const totalCatCount = events.length;

  // Calendar render
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const today = now.getDate();
  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();
  const calCells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Build map: day number -> list of events on that day for the viewed month/year
  const eventDaysMap = new Map<number, EventType[]>();
  events.forEach(ev => {
    const parsed = parseEventDate(ev.date);
    if (!parsed) return;
    // Match month; if year stored, match year; if no year, match any year in view
    const yearMatches = parsed.year === calYear;
    const monthMatches = parsed.month === calMonth;
    if (yearMatches && monthMatches && parsed.day >= 1 && parsed.day <= daysInMonth) {
      const existing = eventDaysMap.get(parsed.day) || [];
      eventDaysMap.set(parsed.day, [...existing, ev]);
    }
  });

  const calSelectedEvents = calSelectedDay ? (eventDaysMap.get(calSelectedDay) || []) : [];

  // Sort events by date (soonest first) and take up to 5 for Recent Schedules panel
  const sortedByDate = [...events].sort((a, b) => {
    const pa = parseEventDate(a.date);
    const pb = parseEventDate(b.date);
    if (!pa || !pb) return 0;
    return new Date(pa.year, pa.month, pa.day).getTime() - new Date(pb.year, pb.month, pb.day).getTime();
  });
  const upcomingThisWeek = sortedByDate.slice(0, 5);

  return (
    <div className="px-8 py-7 min-h-screen space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1C1C]">Events Management</h1>
          <p className="text-sm text-[#7D7387] mt-0.5">Manage, schedule, and edit community events & workshops</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="h-11 px-5 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] transition text-white font-bold flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" /> Create Event
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events by title, category, city..."
            className="w-full h-10 rounded-xl bg-[#F7F5FA] pl-10 pr-3 text-sm outline-none border border-transparent focus:border-[#8A38F5] transition"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-10 px-3 pr-8 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none appearance-none focus:border-[#8A38F5]"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="h-10 px-3 pr-8 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none appearance-none focus:border-[#8A38F5]"
          >
            <option value="All">All Categories</option>
            {allFilterCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            placeholder="Filter City"
            className="h-10 pl-8 pr-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-[#8A38F5] w-32"
          />
        </div>
      </div>


      {/* ── 3 OVERVIEW PANELS (horizontal row) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">

        {/* PANEL 1: CALENDAR — Live Event Highlights */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-extrabold text-[#1A1C1C]">{MONTHS[calMonth]} {calYear}</h4>
              <p className="text-[10px] text-[#7D7387] mt-0.5">
                {eventDaysMap.size > 0 ? `${eventDaysMap.size} day${eventDaysMap.size !== 1 ? "s" : ""} with events` : "No events this month"}
              </p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setCalSelectedDay(null); if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }} className="w-7 h-7 rounded-lg hover:bg-[#F3F3F3] flex items-center justify-center transition"><ChevronLeft className="w-3.5 h-3.5 text-[#7D7387]" /></button>
              <button onClick={() => { setCalSelectedDay(null); if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }} className="w-7 h-7 rounded-lg hover:bg-[#F3F3F3] flex items-center justify-center transition"><ChevronRight className="w-3.5 h-3.5 text-[#7D7387]" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => <div key={i} className="text-center text-[9px] font-bold text-[#7D7387] py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0">
            {calCells.map((day, i) => {
              if (!day) return <div key={i} />;
              const isToday = isCurrentMonth && day === today;
              const isSelected = day === calSelectedDay;
              const dayEvents = eventDaysMap.get(day) || [];
              const hasEvents = dayEvents.length > 0;
              return (
                <div key={i} className="flex flex-col items-center pt-0.5 pb-1 cursor-pointer" onClick={() => setCalSelectedDay(isSelected ? null : day)}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition ${isSelected ? "bg-[#7004DC] text-white ring-2 ring-[#7004DC]/30" : isToday ? "bg-[#F3EEFF] text-[#7004DC] ring-2 ring-[#7004DC]/20" : hasEvents ? "text-[#1A1C1C] hover:bg-violet-50" : "text-[#7D7387] hover:bg-[#F5F5F5]"}`}>{day}</div>
                  {hasEvents && <div className="flex items-center gap-0.5 mt-0.5">{dayEvents.slice(0, 3).map((_, di) => <div key={di} className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-[#7004DC]"}`} />)}</div>}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#F0EDF5]">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#7004DC]" /><span className="text-[9px] font-bold text-[#7D7387] uppercase tracking-wider">Has Event</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-[#F3EEFF] ring-2 ring-[#7004DC]/20 flex items-center justify-center"><span className="text-[7px] font-bold text-[#7004DC]">{today}</span></div><span className="text-[9px] font-bold text-[#7D7387] uppercase tracking-wider">Today</span></div>
          </div>
          {calSelectedDay && (
            <div className="mt-3 pt-3 border-t border-[#F0EDF5]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7004DC] mb-2">{MONTHS[calMonth]} {calSelectedDay} — {calSelectedEvents.length} Event{calSelectedEvents.length !== 1 ? "s" : ""}</p>
              {calSelectedEvents.length === 0 ? <p className="text-xs text-slate-400">No events on this date.</p> : (
                <div className="space-y-2">
                  {calSelectedEvents.map(ev => (
                    <div key={ev.id} className="flex items-start gap-2 p-2 rounded-xl bg-[#F7F5FA] border border-[#ECE7F2]">
                      {ev.image ? <img src={ev.image} alt={ev.title} className="w-8 h-8 rounded-lg object-cover shrink-0" /> : <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0"><Calendar className="w-4 h-4 text-[#7004DC]" /></div>}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1A1C1C] line-clamp-1">{ev.title}</p>
                        <p className="text-[10px] text-[#7D7387] flex items-center gap-1"><MapPin className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{ev.location}</span></p>
                        {ev.time && <p className="text-[10px] text-[#7D7387] flex items-center gap-1"><Clock className="w-2.5 h-2.5 shrink-0" />{ev.time}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
          <h4 className="text-sm font-extrabold text-[#1A1C1C] mb-4">Recent Schedules</h4>
          {upcomingThisWeek.length === 0 ? (
            <p className="text-xs text-slate-400">No upcoming events recorded</p>
          ) : (
            <div className="space-y-3">
              {upcomingThisWeek.map((ev, i) => {
                const colors = ["bg-[#7004DC]", "bg-[#D2A500]", "bg-emerald-600"];
                const parts = ev.date.split(" ");
                return (
                  <div key={ev.id} className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${colors[i % colors.length]} flex flex-col items-center justify-center text-white shrink-0`}>
                      <span className="text-[9px] font-bold uppercase leading-none">{parts[1] || "DAY"}</span>
                      <span className="text-base font-extrabold leading-none">{parts[0] || String(i + 1)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1A1C1C] truncate">{ev.title}</p>
                      <p className="text-xs text-[#7D7387] flex items-center gap-1 mt-0.5 truncate"><MapPin className="w-3 h-3 shrink-0" /> {ev.location}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-extrabold text-[#1A1C1C]">Event Categories</h4>
            <span className="text-xs text-[#7004DC] font-bold">{events.length} Total</span>
          </div>
          <div className="space-y-3">
            {catBreakdown.map(cat => {
              const pct = totalCatCount > 0 ? Math.round((cat.count / totalCatCount) * 100) : 0;
              return (
                <div key={cat.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7D7387]">{cat.name}</span>
                    <span className="text-xs font-bold text-[#1A1C1C]">{cat.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-[#F3F3F3] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              );
            })}
            {catBreakdown.length === 0 && <p className="text-xs text-slate-400">No categorized events yet</p>}
          </div>
        </div>
      </div>

      {/* ── EVENTS TABLE ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-extrabold text-[#1A1C1C]">Published Events ({filtered.length})</h3>
            <p className="text-xs text-[#7D7387]">Active schedule synchronized with the mobile app</p>
          </div>
          <button onClick={handleExportCsv} disabled={filtered.length === 0} className="text-sm font-bold text-[#7004DC] flex items-center gap-1.5 hover:underline disabled:opacity-40"><Download className="w-4 h-4" /> Export CSV</button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#8A38F5]" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-[#1A1C1C]">No events found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or create a new event.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F7F5FA] border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] min-w-[260px]">Event Name</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] min-w-[140px]">Category</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] min-w-[150px]">Organizer</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] min-w-[130px]">Date &amp; Time</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] min-w-[130px]">City</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] min-w-[80px]">Spots</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] text-right pr-6 min-w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(ev => (
                    <tr key={ev.id} className="hover:bg-[#FAFAFA] transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {ev.image ? <img src={ev.image} alt={ev.title} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-gray-100" /> : <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 text-[#7004DC]"><Calendar className="w-5 h-5" /></div>}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#1A1C1C] line-clamp-1">{ev.title}</p>
                            {ev.description && <p className="text-xs text-[#7D7387] line-clamp-1 mt-0.5">{ev.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F3EEFF] text-[#7004DC] border border-[#E9D9FF]">{ev.category}</span></td>
                      <td className="px-5 py-4 text-sm text-[#4B4355] whitespace-nowrap">{ev.organizer || "—"}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-xs font-bold text-[#1A1C1C]">{formatDateDisplay(ev.date)}</p>
                        {ev.time && <p className="text-[11px] text-[#7D7387] mt-0.5">{formatTimeDisplay(ev.time)}</p>}
                      </td>
                      <td className="px-5 py-4 text-sm text-[#4B4355] whitespace-nowrap">{ev.location}</td>
                      <td className="px-5 py-4 text-sm font-bold text-[#1A1C1C] whitespace-nowrap">{ev.spots}</td>
                      <td className="px-5 py-4 text-right pr-6 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleOpenEdit(ev)} className="w-8 h-8 rounded-lg text-[#7004DC] hover:bg-violet-100/70 flex items-center justify-center transition" title="Edit Event"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(ev.id, ev.title)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition" title="Delete Event"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-[#F7F5FA]">
              <p className="text-sm text-[#7D7387]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} events</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-9 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-[#4B4355] disabled:opacity-40 hover:bg-gray-50 transition">Previous</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-9 px-4 rounded-xl bg-[#7004DC] text-white text-sm font-semibold disabled:opacity-40 transition">Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* CREATE / EDIT EVENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* MODAL HEADER */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">
                  {editingEventId ? "Edit Community Event" : "Publish New Community Event"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingEventId ? "Modify existing event information" : "Fill in event details and upload a cover image from your device"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-semibold">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {successMsg}
                </div>
              )}

              {/* IMAGE UPLOAD FROM DEVICE */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Event Cover Image * <span className="normal-case font-normal text-slate-400">(Upload from Device)</span>
                </label>

                {formData.image ? (
                  <div className="relative rounded-2xl border-2 border-violet-200 overflow-hidden bg-slate-50 p-2 flex items-center gap-4">
                    <img
                      src={formData.image}
                      alt="Cover Preview"
                      className="w-24 h-20 rounded-xl object-cover border border-slate-200 shadow-sm"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-[#1A1C1C]">Cover image selected</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Ready to display across user app feeds</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1 bg-white border border-slate-300 hover:border-[#7004DC] rounded-lg text-xs font-bold text-[#7004DC] transition"
                        >
                          Replace Image
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image: "" }))}
                          className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-[#7004DC] rounded-2xl p-6 text-center cursor-pointer bg-[#FBF9FE] transition group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-2 text-[#7004DC] group-hover:scale-110 transition">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-[#1A1C1C]">Click to choose image from device storage</p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP up to 5MB</p>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                {/* Optional URL Toggle */}
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setUseUrlInput(!useUrlInput)}
                    className="text-[11px] font-semibold text-[#7004DC] hover:underline"
                  >
                    {useUrlInput ? "Hide Direct URL input" : "Or enter direct Image URL"}
                  </button>
                </div>
                {useUrlInput && (
                  <input
                    type="url"
                    name="image"
                    value={formData.image}
                    onChange={handleInput}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[#8A38F5] mt-2"
                  />
                )}
              </div>

              {/* GRID FIELDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Program Title *
                  </label>
                  <input
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInput}
                    placeholder="e.g. Adaptive Sports & Health Workshop 2026"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInput}
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white appearance-none"
                  >
                    {masterCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Location / City *
                  </label>
                  <input
                    name="location"
                    required
                    value={formData.location}
                    onChange={handleInput}
                    placeholder="e.g. Pune (or 'Online Webinar')"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Date *
                  </label>
                  <input
                    name="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={handleInput}
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5] text-[#1A1C1C]"
                    style={{ colorScheme: "light" }}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Event Time <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">From</label>
                      <input
                        name="timeFrom"
                        type="time"
                        value={formData.timeFrom}
                        onChange={handleInput}
                        className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5] text-[#1A1C1C]"
                        style={{ colorScheme: "light" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">To</label>
                      <input
                        name="timeTo"
                        type="time"
                        value={formData.timeTo}
                        onChange={handleInput}
                        className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5] text-[#1A1C1C]"
                        style={{ colorScheme: "light" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={3}
                    value={formData.description}
                    onChange={handleInput}
                    placeholder="Provide a brief summary and agenda for the community..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#8A38F5] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Available Spots
                  </label>
                  <input
                    name="spots"
                    type="number"
                    value={formData.spots}
                    onChange={handleInput}
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Organizer
                  </label>
                  <input
                    name="organizer"
                    value={formData.organizer}
                    onChange={handleInput}
                    placeholder="e.g. Sahayak Foundation"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    External Registration / Portal URL *
                  </label>
                  <input
                    name="externalUrl"
                    required
                    type="url"
                    value={formData.externalUrl}
                    onChange={handleInput}
                    placeholder="https://services.digiability.org/event-register"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Accessibility Tags <span className="normal-case font-normal">(comma-separated)</span>
                  </label>
                  <input
                    name="accessibilityTags"
                    value={formData.accessibilityTags}
                    onChange={handleInput}
                    placeholder="e.g. Wheelchair Accessible, Sign Language, Braille Kits, Free Entry"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-11 px-5 rounded-xl border border-slate-200 text-[#4B4355] font-semibold text-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 px-6 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-300 text-white font-bold text-sm flex items-center gap-2 shadow-sm transition"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting
                    ? (editingEventId ? "Saving Changes..." : "Publishing...")
                    : (editingEventId ? "Update Event" : "Publish Event")
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
