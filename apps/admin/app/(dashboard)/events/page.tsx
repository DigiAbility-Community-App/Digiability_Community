"use client";

import { useEffect, useState } from "react";
import { 
  CalendarDays, 
  MapPin, 
  Users, 
  Plus, 
  Trash2, 
  X, 
  Clock, 
  Globe, 
  Image as ImageIcon, 
  ExternalLink,
  Loader2,
  Tag
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
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form fields
  const [formData, setFormData] = useState({
    title: "",
    category: "Medical Support",
    location: "",
    date: "",
    time: "",
    image: "",
    description: "",
    spots: "50",
    buttonType: "filled",
    externalUrl: "",
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error("Failed to load events", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage("Event created successfully!");
        setFormData({
          title: "",
          category: "Medical Support",
          location: "",
          date: "",
          time: "",
          image: "",
          description: "",
          spots: "50",
          buttonType: "filled",
          externalUrl: "",
        });
        fetchEvents();
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessMessage("");
        }, 1200);
      } else {
        setErrorMessage(data.message || "Failed to create event.");
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;

    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        setEvents((prev) => prev.filter((event) => event.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete event", error);
      alert("Failed to delete event.");
    }
  };

  const autofillImage = (categoryName: string) => {
    let url = "";
    switch (categoryName) {
      case "Medical Support":
        url = "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1200&auto=format&fit=crop";
        break;
      case "Legal Aid":
        url = "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1200&auto=format&fit=crop";
        break;
      case "Skill Training":
        url = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop";
        break;
      case "Assistive Technology":
        url = "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=1200&auto=format&fit=crop";
        break;
      default:
        url = "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop";
    }
    setFormData((prev) => ({ ...prev, image: url }));
  };

  // Stats calculation
  const totalEvents = events.length;
  const onlineEvents = events.filter(e => e.location.toLowerCase() === "online").length;
  const physicalEvents = totalEvents - onlineEvents;

  return (
    <main className="flex-1 p-8 bg-[#F6F6F6] min-h-screen overflow-y-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-[#1A1A2E] tracking-tight">Events Console</h2>
          <p className="text-slate-500 mt-1">Manage public programs, workshops, and aid camps for the DigiAbility Community.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3 bg-[#8A38F5] hover:bg-[#762DD1] text-white rounded-2xl font-bold shadow-lg shadow-violet-500/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          <span>Publish Event</span>
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-violet-50 text-[#8A38F5] rounded-2xl">
            <CalendarDays className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400">Total Programs</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{totalEvents}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Globe className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400">Online Workshops</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{onlineEvents}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl">
            <MapPin className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400">Physical camps</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{physicalEvents}</p>
          </div>
        </div>
      </div>

      {/* EVENTS TABLE/LIST */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Event Registry</h3>
          <span className="text-xs font-semibold bg-violet-50 text-[#8A38F5] px-3 py-1 rounded-full uppercase tracking-wider">
            {events.length} listed
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#8A38F5]" />
            <p className="font-semibold text-sm">Loading events registry...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="inline-flex p-5 bg-slate-50 text-slate-400 rounded-3xl mb-4">
              <CalendarDays className="w-10 h-10" />
            </div>
            <h4 className="text-lg font-bold text-slate-700">No events found</h4>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">Publish your first program to help the community access support and skill camps.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Publish First Event</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Event Details</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Spots</th>
                  <th className="px-6 py-4">External Portal</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-16 h-12 rounded-xl object-cover border border-slate-100"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop";
                          }}
                        />
                        <div>
                          <p className="font-bold text-slate-800 line-clamp-1">{event.title}</p>
                          <p className="text-slate-400 text-xs line-clamp-1 mt-0.5">{event.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-50 text-[#8A38F5]">
                        <Tag className="w-3.5 h-3.5" />
                        {event.category}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {event.location}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div>
                        <p className="font-semibold text-slate-700">{event.date}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{event.time || "All Day"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-1 text-slate-600 font-semibold">
                        <Users className="w-4 h-4 text-slate-400" />
                        {event.spots}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <a 
                        href={event.externalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-violet-500 hover:text-violet-700 font-medium text-xs hover:underline"
                      >
                        <span>View Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete Program"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE EVENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* MODAL HEADER */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Publish New Event</h3>
                <p className="text-slate-400 text-xs mt-0.5">Fill in the event specs to showcase on the user's mobile community dashboard.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL FORM */}
            <form onSubmit={handleCreateEvent} className="flex-1 overflow-y-auto p-6 space-y-6">
              {errorMessage && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold border border-red-100">
                  ⚠️ {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-sm font-semibold border border-emerald-100">
                  🎉 {successMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Title */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Program Title *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g. Adaptive Sports Workshop 2026"
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 transition-colors"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Category *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={(e) => {
                      handleInputChange(e);
                      autofillImage(e.target.value);
                    }}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 bg-white transition-colors"
                  >
                    <option value="Medical Support">Medical Support</option>
                    <option value="Legal Aid">Legal Aid</option>
                    <option value="Skill Training">Skill Training</option>
                    <option value="Assistive Technology">Assistive Technology</option>
                    <option value="General Support">General Support</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Location *</label>
                  <input
                    type="text"
                    name="location"
                    required
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g. Pune (or 'Online')"
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 transition-colors"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Date (Text description) *</label>
                  <input
                    type="text"
                    name="date"
                    required
                    value={formData.date}
                    onChange={handleInputChange}
                    placeholder="e.g. 15 March or 24 AUG"
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 transition-colors"
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Time (Optional)</label>
                  <input
                    type="text"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    placeholder="e.g. 10:00 AM - 1:00 PM"
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 transition-colors"
                  />
                </div>

                {/* Image URL */}
                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Image URL *</label>
                    <button
                      type="button"
                      onClick={() => autofillImage(formData.category)}
                      className="text-xs text-violet-500 hover:text-violet-700 font-semibold flex items-center gap-1"
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>Use Category Autofill</span>
                    </button>
                  </div>
                  <input
                    type="url"
                    name="image"
                    required
                    value={formData.image}
                    onChange={handleInputChange}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 transition-colors"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Program Description *</label>
                  <textarea
                    name="description"
                    required
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Detail the event objectives, who can attend, and prerequisites."
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 resize-none transition-colors"
                  />
                </div>

                {/* Spots */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Total Spots</label>
                  <input
                    type="number"
                    name="spots"
                    value={formData.spots}
                    onChange={handleInputChange}
                    placeholder="50"
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 transition-colors"
                  />
                </div>

                {/* Button Type */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Button Style</label>
                  <select
                    name="buttonType"
                    value={formData.buttonType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 bg-white transition-colors"
                  >
                    <option value="filled">Filled (Primary Accent)</option>
                    <option value="outline">Outline</option>
                  </select>
                </div>

                {/* External URL */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">External Portal URL (Digiability Service App Link) *</label>
                  <input
                    type="url"
                    name="externalUrl"
                    required
                    value={formData.externalUrl}
                    onChange={handleInputChange}
                    placeholder="https://services.digiability.org/register/..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#8A38F5] text-slate-800 transition-colors"
                  />
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 border border-slate-200 rounded-2xl text-slate-500 hover:text-slate-700 font-bold transition-all hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-3 bg-[#8A38F5] hover:bg-[#762DD1] disabled:bg-violet-300 text-white rounded-2xl font-bold shadow-lg shadow-violet-500/10 flex items-center gap-2 transition-all active:scale-[0.98]"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submitting ? "Publishing..." : "Publish Event"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
