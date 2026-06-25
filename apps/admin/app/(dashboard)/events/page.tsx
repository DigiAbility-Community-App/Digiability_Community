"use client";

import { useEffect, useState } from "react";
import {
  Plus, Search, ChevronDown, Download, ChevronLeft, ChevronRight,
  MapPin, Clock, X, Loader2, Tag, ExternalLink, Trash2, Calendar,
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
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["S","M","T","W","T","F","S"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventType[]>([]);
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

  // Create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState({
    title: "", category: "Medical Support", location: "", date: "", time: "",
    image: "", description: "", spots: "50", buttonType: "filled", externalUrl: "",
    organizer: "", accessibilityTags: "",
  });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.success) setEvents(data.events || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const autofillImage = (cat: string) => {
    const map: Record<string, string> = {
      "Medical Support": "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1200&auto=format&fit=crop",
      "Legal Aid": "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1200&auto=format&fit=crop",
      "Skill Training": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop",
      "Assistive Technology": "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=1200&auto=format&fit=crop",
    };
    setFormData(prev => ({ ...prev, image: map[cat] || "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop" }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const res = await fetch("/api/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Event created!");
        setFormData({ title: "", category: "Medical Support", location: "", date: "", time: "", image: "", description: "", spots: "50", buttonType: "filled", externalUrl: "", organizer: "", accessibilityTags: "" });
        fetchEvents();
        setTimeout(() => { setIsModalOpen(false); setSuccessMsg(""); }, 1200);
      } else { setErrorMsg(data.message || "Failed."); }
    } catch { setErrorMsg("Unexpected error."); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) setEvents(prev => prev.filter(e => e.id !== id));
    } catch (e) { console.error(e); }
  };

  // Filters
  const categories = Array.from(new Set(events.map(e => e.category)));
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
  const catBreakdown = categories.map(cat => ({
    name: cat.toUpperCase(),
    count: events.filter(e => e.category === cat).length,
    color: { "Medical Support": "#7004DC", "Legal Aid": "#DC2626", "Skill Training": "#D2A500", "Awareness": "#D2A500", "Assistive Technology": "#3b82f6", "General Support": "#94a3b8" }[cat] || "#7004DC",
  }));
  const totalCatCount = events.length;

  // Calendar render
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const today = now.getDate();
  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();
  const calCells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Upcoming this week (next 7 events from DB)
  const upcomingThisWeek = events.slice(0, 3);

  return (
    <div className="px-8 py-7 min-h-screen">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1C1C]">Events Management</h1>
          <p className="text-sm text-[#7D7387] mt-0.5">Manage and schedule organizational activities</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="h-11 px-5 rounded-xl bg-[#D2A500] hover:bg-[#b89300] transition text-white font-bold flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" /> Create Event
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..." className="w-full h-9 rounded-lg bg-[#F7F5FA] pl-9 pr-3 text-sm outline-none border border-transparent focus:border-[#8A38F5]" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm outline-none appearance-none focus:border-[#8A38F5]">
            <option>Status</option>
            <option>All</option>
            <option>Active</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-9 px-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm outline-none appearance-none focus:border-[#8A38F5]">
            <option value="All">Category</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input type="text" placeholder="mm/dd/yyyy" className="h-9 pl-8 pr-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-[#8A38F5] w-36" />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={cityFilter} onChange={e => setCityFilter(e.target.value)} placeholder="City" className="h-9 pl-8 pr-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-[#8A38F5] w-28" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">

        {/* LEFT: TABLE */}
        <div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* TABLE HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-extrabold text-[#1A1C1C]">Events Table</h3>
              <button className="text-sm font-bold text-[#7004DC] flex items-center gap-1.5 hover:underline">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#8A38F5]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-semibold">No events found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#F7F5FA]">
                      <tr>
                        {["EVENT NAME", "CATEGORY", "ORGANIZER", "DATE", "CITY", "ATTENDEES", ""].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginated.map(ev => (
                        <tr key={ev.id} className="hover:bg-[#FAFAFA] transition">
                          <td className="px-5 py-4">
                            <p className="text-sm font-bold text-[#7004DC] hover:underline cursor-pointer line-clamp-1">{ev.title}</p>
                          </td>
                          <td className="px-5 py-4 text-sm text-[#4B4355]">{ev.category}</td>
                          <td className="px-5 py-4 text-sm text-[#4B4355]">{ev.organizer || "—"}</td>
                          <td className="px-5 py-4 text-sm text-[#4B4355] whitespace-nowrap">{ev.date}</td>
                          <td className="px-5 py-4 text-sm text-[#4B4355]">{ev.location}</td>
                          <td className="px-5 py-4 text-sm font-semibold text-[#1A1C1C]">{ev.spots}</td>
                          <td className="px-5 py-4">
                            <button onClick={() => handleDelete(ev.id)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
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
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-5">

          {/* CALENDAR */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-extrabold text-[#1A1C1C]">{MONTHS[calMonth]} {calYear}</h4>
              <div className="flex gap-1">
                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }} className="w-7 h-7 rounded-lg hover:bg-[#F3F3F3] flex items-center justify-center">
                  <ChevronLeft className="w-3.5 h-3.5 text-[#7D7387]" />
                </button>
                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }} className="w-7 h-7 rounded-lg hover:bg-[#F3F3F3] flex items-center justify-center">
                  <ChevronRight className="w-3.5 h-3.5 text-[#7D7387]" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0 mb-2">
              {DAYS.map((d, i) => <div key={i} className="text-center text-[10px] font-bold text-[#7D7387] py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0">
              {calCells.map((day, i) => (
                <div key={i} className="flex items-center justify-center py-1">
                  {day ? (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer ${isCurrentMonth && day === today ? "bg-[#7004DC] text-white" : "text-[#4B4355] hover:bg-[#F3F3F3]"}`}>
                      {day}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* UPCOMING THIS WEEK */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h4 className="text-sm font-extrabold text-[#1A1C1C] mb-4">Upcoming This Week</h4>
            {upcomingThisWeek.length === 0 ? (
              <p className="text-xs text-slate-400">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {upcomingThisWeek.map((ev, i) => {
                  const colors = ["bg-[#7004DC]", "bg-[#D2A500]", "bg-green-600"];
                  const parts = ev.date.split(" ");
                  return (
                    <div key={ev.id} className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${colors[i % colors.length]} flex flex-col items-center justify-center text-white shrink-0`}>
                        <span className="text-[9px] font-bold uppercase leading-none">{parts[1] || ""}</span>
                        <span className="text-base font-extrabold leading-none">{parts[0] || ""}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1A1C1C] line-clamp-1">{ev.title}</p>
                        <p className="text-xs text-[#7D7387] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {ev.location}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button className="w-full mt-4 h-9 rounded-xl border border-[#7004DC] text-[#7004DC] text-xs font-bold hover:bg-violet-50 transition">
              View All Weekly Schedule
            </button>
          </div>

          {/* EVENT CATEGORIES */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h4 className="text-sm font-extrabold text-[#1A1C1C] mb-4">Event Categories</h4>
            <div className="space-y-3">
              {catBreakdown.map(cat => {
                const pct = totalCatCount > 0 ? Math.round((cat.count / totalCatCount) * 100) : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7D7387]">{cat.name}</span>
                      <span className="text-xs font-bold text-[#1A1C1C]">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F3F3F3] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                );
              })}
              {catBreakdown.length === 0 && <p className="text-xs text-slate-400">No categories yet</p>}
            </div>
          </div>
        </div>
      </div>

      {/* CREATE EVENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">Publish New Event</h3>
                <p className="text-xs text-slate-400 mt-0.5">Fill in the event details</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-5">
              {errorMsg && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold">{errorMsg}</div>}
              {successMsg && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm font-semibold">{successMsg}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Program Title *</label>
                  <input name="title" required value={formData.title} onChange={handleInput} placeholder="e.g. Adaptive Sports Workshop 2026" className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category *</label>
                  <select name="category" value={formData.category} onChange={e => { handleInput(e); autofillImage(e.target.value); }} className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white appearance-none">
                    {["Medical Support","Legal Aid","Skill Training","Assistive Technology","General Support"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Location *</label>
                  <input name="location" required value={formData.location} onChange={handleInput} placeholder="e.g. Pune (or 'Online')" className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date *</label>
                  <input name="date" required value={formData.date} onChange={handleInput} placeholder="e.g. 15 March" className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Time (Optional)</label>
                  <input name="time" value={formData.time} onChange={handleInput} placeholder="e.g. 10:00 AM - 1:00 PM" className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Image URL *</label>
                  <input name="image" required value={formData.image} onChange={handleInput} placeholder="https://images.unsplash.com/..." className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description *</label>
                  <textarea name="description" required rows={3} value={formData.description} onChange={handleInput} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#8A38F5] resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Total Spots</label>
                  <input name="spots" type="number" value={formData.spots} onChange={handleInput} className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">External Portal URL *</label>
                  <input name="externalUrl" required type="url" value={formData.externalUrl} onChange={handleInput} placeholder="https://services.digiability.org/..." className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Organizer</label>
                  <input name="organizer" value={formData.organizer} onChange={handleInput} placeholder="e.g. Sahayak Foundation" className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Accessibility Tags <span className="normal-case font-normal">(comma-separated)</span></label>
                  <input name="accessibilityTags" value={formData.accessibilityTags} onChange={handleInput} placeholder="e.g. Wheelchair,Ramp,Sign Language,Free Entry" className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="h-11 px-5 rounded-xl border border-slate-200 text-[#4B4355] font-semibold text-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={submitting} className="h-11 px-5 rounded-xl bg-[#8A38F5] hover:bg-[#762DD1] disabled:bg-violet-300 text-white font-bold text-sm flex items-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? "Publishing..." : "Publish Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
