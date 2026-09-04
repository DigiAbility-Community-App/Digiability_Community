"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { isValidIndianPhone, INVALID_PHONE_MESSAGE } from "@/lib/validation";
import {
  Search, ChevronDown, X, Trash2,
  RefreshCw, Users, MessageSquare, CheckCircle2,
  Calendar, User, Send, Plus, Download, Edit3,
  Eye, EyeOff, Upload, Phone, Mail, Globe, MapPin,
  ShieldCheck, Tag, Loader2, Image as ImageIcon,
} from "lucide-react";
import { DateRangePicker, isWithinDateRange } from "@/components/shared/DateRangePicker";
import { WeeklyScheduleEditor } from "@/components/shared/WeeklyScheduleEditor";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { WeeklySchedule, defaultWeeklySchedule, isValidWeeklySchedule } from "@/lib/availabilitySchedule";

// ─────────────────────────────────────────────
// FORUM QUESTION TYPES
// ─────────────────────────────────────────────
interface ForumQuestion {
  id: string;
  title: string;
  category: string;
  views: number;
  answerCount: number;
  status: "SOLVED" | "UNSOLVED";
  createdAt: string;
  createdAtISO: string;
  isDeleted: boolean;
  authorName: string;
  authorEmail: string;
}

interface ForumAnswer {
  id: string;
  content: string;
  authorName: string;
  authorEmail: string;
  isAccepted: boolean;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

interface ForumQuestionDetail {
  question: ForumQuestion & { description: string };
  answers: ForumAnswer[];
}

// ─────────────────────────────────────────────
// SERVICE DIRECTORY TYPES
// ─────────────────────────────────────────────
interface ServiceItem {
  id: string;
  name: string;
  type: string;
  category: string;
  logo: string | null;
  image: string | null;
  description: string;
  location: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactUrl: string | null;
  price: string;
  availability: string;
  availabilitySchedule: WeeklySchedule | null;
  rating: number;
  reviews: number;
  verified: boolean;
  status: "published" | "unpublished";
  createdAt?: string;
  updatedAt?: string;
}

const SERVICE_CATEGORIES = [
  { id: "all", label: "All Categories" },
  { id: "therapists", label: "Therapists" },
  { id: "equipment", label: "Equipment" },
  { id: "care", label: "Respite Care" },
  { id: "legal", label: "Legal Services" },
  { id: "transport", label: "Transportation" },
  { id: "medical", label: "Medical Support" },
];

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function CommunityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"Forums" | "Services">("Forums");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Forum data ──
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [forumStats, setForumStats] = useState({ total: 0, solved: 0, unsolved: 0, totalViews: 0, totalAnswers: 0 });
  const [selectedQuestion, setSelectedQuestion] = useState<ForumQuestionDetail | null>(null);
  const [questionDetailLoading, setQuestionDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);

  // ── Services data ──
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceCategory, setServiceCategory] = useState("all");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("all");
  const [serviceMasterCategories, setServiceMasterCategories] = useState<{ id: string; name: string }[]>([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceErrorMsg, setServiceErrorMsg] = useState("");
  const [serviceSuccessMsg, setServiceSuccessMsg] = useState("");
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [deleteServiceTarget, setDeleteServiceTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingService, setDeletingService] = useState(false);
  const [deleteServiceError, setDeleteServiceError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [serviceFormData, setServiceFormData] = useState({
    name: "",
    type: "",
    category: "Therapists",
    logo: "🏢",
    image: "",
    description: "",
    location: "",
    contactPhone: "",
    contactEmail: "",
    contactUrl: "",
    price: "₹500 - ₹1,500 / session",
    availabilitySchedule: defaultWeeklySchedule(),
    verified: true,
    status: "published" as "published" | "unpublished",
  });

  const fetchQuestions = async () => {
    setQuestionsLoading(true);
    try {
      const res = await fetch("/api/forums");
      const data = await res.json();
      if (data.success) {
        setQuestions(data.questions);
        setForumStats(data.stats);
      }
    } catch (e) { console.error(e); }
    finally { setQuestionsLoading(false); }
  };

  const fetchServiceCategories = async () => {
    try {
      const res = await fetch("/api/settings/service-categories");
      const data = await res.json();
      if (data.success && data.categories) {
        setServiceMasterCategories(data.categories);
      }
    } catch (e) {
      console.error("Failed to load service categories:", e);
    }
  };

  const fetchServices = async () => {
    setServicesLoading(true);
    try {
      const { sessionExpired, data } = await apiFetch("/api/services");
      if (sessionExpired) { router.push("/login"); return; }
      if (data.success) {
        setServices(data.services || []);
      }
    } catch (e) { console.error("Failed to load services:", e); }
    finally { setServicesLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "Forums") fetchQuestions();
    if (activeTab === "Services") {
      fetchServices();
      fetchServiceCategories();
    }
  }, [activeTab]);

  const openQuestion = async (id: string) => {
    setQuestionDetailLoading(true);
    setSelectedQuestion(null);
    setReplyText("");
    try {
      const res = await fetch(`/api/forums/${id}`);
      const data = await res.json();
      if (data.success) setSelectedQuestion(data);
    } catch (e) { console.error(e); }
    finally { setQuestionDetailLoading(false); }
  };

  const postReply = async () => {
    if (!selectedQuestion || !replyText.trim()) return;
    setReplyPosting(true);
    try {
      const res = await fetch(`/api/forums/${selectedQuestion.question.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedQuestion((prev) => prev ? {
          ...prev,
          answers: [...prev.answers, data.answer],
          question: { ...prev.question, answerCount: prev.question.answerCount + 1 },
        } : prev);
        setQuestions((prev) => prev.map((q) =>
          q.id === selectedQuestion.question.id ? { ...q, answerCount: q.answerCount + 1 } : q
        ));
        setReplyText("");
      }
    } catch (e) { console.error(e); }
    finally { setReplyPosting(false); }
  };

  const deleteQuestion = async (questionId: string) => {
    await fetch("/api/forums", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId }),
    });
    setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, isDeleted: true } : q));
    if (selectedQuestion?.question.id === questionId) {
      setSelectedQuestion((prev) => prev ? { ...prev, question: { ...prev.question, isDeleted: true } } : prev);
    }
  };

  // ── Services Handlers ──
  const handleToggleServiceStatus = async (srv: ServiceItem) => {
    const newStatus = srv.status === "unpublished" ? "published" : "unpublished";
    try {
      const { ok, sessionExpired } = await apiFetch(`/api/services/${srv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (sessionExpired) { router.push("/login"); return; }
      if (ok) {
        setServices(prev => prev.map(s => s.id === srv.id ? { ...s, status: newStatus } : s));
      }
    } catch (e) {
      console.error("Failed to toggle service status:", e);
    }
  };

  const handleOpenCreateService = () => {
    setEditingServiceId(null);
    setServiceFormData({
      name: "",
      type: "",
      category: "therapists",
      logo: "👩‍⚕️",
      image: "",
      description: "",
      location: "",
      contactPhone: "",
      contactEmail: "",
      contactUrl: "",
      price: "₹500 - ₹1,500 / session",
      availabilitySchedule: defaultWeeklySchedule(),
      verified: true,
      status: "published",
    });
    setServiceErrorMsg("");
    setServiceSuccessMsg("");
    setIsServiceModalOpen(true);
  };

  const handleOpenEditService = (srv: ServiceItem) => {
    setEditingServiceId(srv.id);
    setServiceFormData({
      name: srv.name || "",
      type: srv.type || "",
      category: srv.category || "therapists",
      logo: srv.logo || "🏢",
      image: srv.image || "",
      description: srv.description || "",
      location: srv.location || "",
      contactPhone: srv.contactPhone || "",
      contactEmail: srv.contactEmail || "",
      contactUrl: srv.contactUrl || "",
      price: srv.price || "₹500 - ₹1,500 / session",
      availabilitySchedule: srv.availabilitySchedule || defaultWeeklySchedule(),
      verified: srv.verified !== undefined ? srv.verified : true,
      status: srv.status || "published",
    });
    setServiceErrorMsg("");
    setServiceSuccessMsg("");
    setIsServiceModalOpen(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setServiceErrorMsg("Image size exceeds 5MB. Please choose a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setServiceFormData(prev => ({ ...prev, image: base64 }));
      setServiceErrorMsg("");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceFormData.name.trim() || !serviceFormData.description.trim() || !serviceFormData.location.trim()) {
      setServiceErrorMsg("Please fill in all required fields (Name, Description, Location).");
      return;
    }
    if (!isValidIndianPhone(serviceFormData.contactPhone)) {
      setServiceErrorMsg(INVALID_PHONE_MESSAGE);
      return;
    }
    if (!isValidWeeklySchedule(serviceFormData.availabilitySchedule)) {
      setServiceErrorMsg("Every day marked Open needs both a From and To time.");
      return;
    }

    setServiceSubmitting(true);
    setServiceErrorMsg("");
    setServiceSuccessMsg("");

    try {
      const isEdit = Boolean(editingServiceId);
      const url = isEdit ? `/api/services/${editingServiceId}` : "/api/services";
      const method = isEdit ? "PATCH" : "POST";

      const { sessionExpired, data } = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serviceFormData),
      });

      if (sessionExpired) {
        setServiceErrorMsg("Your session has expired. Redirecting to login…");
        setTimeout(() => router.push("/login"), 1200);
        return;
      }

      if (data.success) {
        setServiceSuccessMsg(isEdit ? "Service updated successfully!" : "Service published successfully!");
        setTimeout(() => {
          setIsServiceModalOpen(false);
          fetchServices();
        }, 600);
      } else {
        setServiceErrorMsg(data.message || "Failed to save service");
      }
    } catch (err: any) {
      setServiceErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setServiceSubmitting(false);
    }
  };

  const handleDeleteService = async () => {
    if (!deleteServiceTarget) return;
    const { id } = deleteServiceTarget;
    setDeletingService(true);
    setDeleteServiceError("");
    try {
      const { sessionExpired, data } = await apiFetch(`/api/services/${id}`, { method: "DELETE" });
      if (sessionExpired) { router.push("/login"); return; }
      if (data.success) {
        setServices(prev => prev.filter(s => s.id !== id));
        setDeleteServiceTarget(null);
      } else {
        setDeleteServiceError(data.message || "Failed to delete service");
      }
    } catch (e) {
      console.error(e);
      setDeleteServiceError("Failed to delete service");
    } finally {
      setDeletingService(false);
    }
  };

  const handleExportServicesCsv = () => {
    if (services.length === 0) return;
    const headers = ["ID", "Name", "Type", "Category", "Location", "Phone", "Email", "Price", "Availability", "Rating", "Reviews", "Status"];
    const rows = services.map(s => [
      `"${s.id}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.type.replace(/"/g, '""')}"`,
      `"${s.category}"`,
      `"${s.location.replace(/"/g, '""')}"`,
      `"${s.contactPhone || ""}"`,
      `"${s.contactEmail || ""}"`,
      `"${s.price.replace(/"/g, '""')}"`,
      `"${s.availability.replace(/"/g, '""')}"`,
      s.rating,
      s.reviews,
      `"${s.status}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `services-directory-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const TABS = ["Forums", "Services"] as const;

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = !search || q.title.toLowerCase().includes(search.toLowerCase()) || q.authorName.toLowerCase().includes(search.toLowerCase());
    const matchesDate = isWithinDateRange(q.createdAtISO, dateFrom, dateTo);
    return matchesSearch && matchesDate;
  });

  const filteredServices = services.filter(s => {
    const matchesSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.type.toLowerCase().includes(search.toLowerCase()) ||
      s.location.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = serviceCategory === "all" || s.category.toLowerCase() === serviceCategory.toLowerCase();
    const matchesStatus = serviceStatusFilter === "all" || s.status === serviceStatusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] w-full max-w-full overflow-x-hidden">

      {/* TOP HEADER */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-5 border-b border-gray-100 bg-white">
        <div>
          <h1 className="text-xl font-extrabold text-[#1A1C1C]">
            {activeTab === "Forums" ? "Discussions & Q&A" : "Professional Services Directory"}
          </h1>
          <p className="text-xs text-[#7D7387] mt-0.5">
            {activeTab === "Forums" ? "Monitor questions, provide verified answers, and moderate discussion content" : "Manage verified service providers, therapists, and equipment vendors for the mobile app"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "Forums" && (
            <button onClick={fetchQuestions} className="h-10 px-4 rounded-xl border border-gray-200 text-[#4B4355] font-bold text-sm flex items-center gap-2 transition hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          )}
          {activeTab === "Services" && (
            <>
              <button onClick={handleExportServicesCsv} disabled={services.length === 0} className="h-10 px-4 rounded-xl border border-gray-200 text-[#4B4355] font-bold text-sm flex items-center gap-2 transition hover:bg-gray-50 disabled:opacity-40">
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button onClick={handleOpenCreateService} className="h-10 px-5 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] text-white font-bold text-sm flex items-center gap-2 transition shadow-sm">
                <Plus className="w-4 h-4" /> Add New Service
              </button>
            </>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-100 bg-white px-8">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearch(""); }}
            className={`mr-8 py-4 text-sm font-semibold border-b-2 transition -mb-px ${activeTab === tab ? "border-[#7004DC] text-[#7004DC]" : "border-transparent text-[#7D7387] hover:text-[#1A1C1C]"}`}
          >
            {tab === "Forums" ? "Discussions & Q&A" : "Services"}
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="flex items-center gap-3 px-8 py-4 bg-white border-b border-gray-100 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={activeTab === "Forums" ? "Search questions or authors..." : "Search services, providers, locations..."}
            className="w-full h-9 rounded-xl bg-[#F7F5FA] pl-9 pr-3 text-sm outline-none border border-transparent focus:border-[#8A38F5]"
          />
        </div>

        {activeTab === "Forums" && (
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            className="h-9 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] bg-white outline-none focus:border-[#7004DC]"
          />
        )}

        {activeTab === "Services" && (
          <>
            <select
              value={serviceCategory}
              onChange={e => setServiceCategory(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] bg-white outline-none focus:border-[#7004DC]"
            >
              <option value="all">All Categories</option>
              {serviceMasterCategories.length > 0
                ? serviceMasterCategories.map(c => <option key={c.id} value={c.name.toLowerCase()}>{c.name}</option>)
                : SERVICE_CATEGORIES.filter(c => c.id !== "all").map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>

            <select
              value={serviceStatusFilter}
              onChange={e => setServiceStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] bg-white outline-none focus:border-[#7004DC]"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 overflow-y-auto p-8 ${selectedQuestion ? "xl:mr-[440px]" : ""}`}>

          {/* ── FORUMS TAB ── */}
          {activeTab === "Forums" && (
            <div>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Questions", value: forumStats.total, color: "text-[#7004DC]" },
                  { label: "Solved", value: forumStats.solved, color: "text-green-600" },
                  { label: "Unsolved", value: forumStats.unsolved, color: "text-orange-500" },
                  { label: "Total Answers", value: forumStats.totalAnswers, color: "text-[#1A1C1C]" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                    <p className={`text-2xl font-extrabold ${color}`}>{Number(value).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {questionsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[3fr_1fr_80px_80px_100px_100px] bg-[#F7F5FA] border-b border-gray-100">
                    {["QUESTION", "CATEGORY", "VIEWS", "ANSWERS", "STATUS", "POSTED"].map(h => (
                      <div key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387]">{h}</div>
                    ))}
                  </div>
                  {questions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <MessageSquare className="w-12 h-12 mb-3 text-slate-300" />
                      <p className="font-semibold">No forum questions yet</p>
                    </div>
                  ) : filteredQuestions.map(q => (
                      <div
                        key={q.id}
                        onClick={() => openQuestion(q.id)}
                        className={`grid grid-cols-[3fr_1fr_80px_80px_100px_100px] items-center border-b border-gray-100 cursor-pointer transition ${selectedQuestion?.question.id === q.id ? "bg-violet-50" : "hover:bg-[#FAFAFA]"} ${q.isDeleted ? "opacity-50" : ""}`}
                      >
                        <div className="px-4 py-3">
                          <p className="text-sm font-semibold text-[#1A1C1C] line-clamp-1">{q.title}</p>
                          <p className="text-xs text-[#7D7387] mt-0.5">by {q.authorName}</p>
                        </div>
                        <div className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full bg-[#F3F3F3] text-[10px] font-bold text-[#4B4355]">{q.category}</span>
                        </div>
                        <div className="px-4 py-3 text-sm text-[#4B4355] font-semibold">{q.views}</div>
                        <div className="px-4 py-3 text-sm text-[#4B4355] font-semibold">{q.answerCount}</div>
                        <div className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${q.isDeleted ? "bg-red-100 text-red-600" : q.status === "SOLVED" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                            {q.isDeleted ? "Deleted" : q.status === "SOLVED" ? "Solved" : "Unsolved"}
                          </span>
                        </div>
                        <div className="px-4 py-3 text-xs text-[#7D7387]">{q.createdAt}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ── SERVICES TAB ── */}
          {activeTab === "Services" && (
            <div>
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Services", value: services.length, color: "text-[#7004DC]" },
                  { label: "Published on App", value: services.filter(s => s.status !== "unpublished").length, color: "text-green-600" },
                  { label: "Unpublished / Draft", value: services.filter(s => s.status === "unpublished").length, color: "text-amber-500" },
                  { label: "Verified Providers", value: services.filter(s => s.verified).length, color: "text-blue-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                    <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {servicesLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-[#7004DC]" />
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-violet-50 text-[#7004DC] flex items-center justify-center mx-auto mb-4 text-2xl">
                    🏢
                  </div>
                  <h3 className="text-base font-extrabold text-[#1A1C1C]">No services found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Try adjusting your filters or click "+ Add New Service" to publish a new provider.
                  </p>
                  <button onClick={handleOpenCreateService} className="mt-4 px-4 py-2 bg-[#7004DC] text-white text-xs font-bold rounded-xl hover:bg-[#5c03b7] transition">
                    + Add First Service
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* table-fixed is what actually stops the overflow: with the
                      default auto layout, columns size to max-content and the
                      min-w-* floors cap nothing, so long names/descriptions/
                      emails pushed the table past the container. Fixed layout
                      makes the existing truncate/line-clamp classes effective. */}
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed text-left border-collapse">
                      <thead className="bg-[#F7F5FA] border-b border-gray-100">
                        <tr>
                          <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] w-[26%]">Service &amp; Provider</th>
                          <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] w-[14%]">Category &amp; Type</th>
                          <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] w-[14%] hidden xl:table-cell">Location &amp; Address</th>
                          <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] w-[18%]">Contact Info</th>
                          <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] w-[12%] hidden lg:table-cell">Pricing</th>
                          <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] w-[10%]">Status</th>
                          <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387] text-right pr-6 w-[12%]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredServices.map(srv => (
                          <tr key={srv.id} className="hover:bg-[#FAFAFA] transition">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                {srv.image && srv.image.startsWith("http") ? (
                                  <img src={srv.image} alt={srv.name} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-gray-100 shadow-sm" />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 text-xl border border-violet-100">
                                    {srv.logo || "🏢"}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-bold text-[#1A1C1C] line-clamp-1">{srv.name}</p>
                                    {srv.verified && (
                                      <span title="Verified Provider">
                                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-[#7D7387] line-clamp-1 mt-0.5">{srv.description}</p>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#F3EEFF] text-[#7004DC] border border-[#E9D9FF] mb-1 max-w-full truncate">
                                {srv.category.toUpperCase()}
                              </span>
                              <p className="text-xs text-[#4B4355] font-semibold truncate">{srv.type}</p>
                            </td>

                            <td className="px-5 py-4 hidden xl:table-cell">
                              <div className="flex items-start gap-1.5 text-xs text-[#4B4355] min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{srv.location}</span>
                              </div>
                            </td>

                            <td className="px-5 py-4 text-xs text-[#4B4355] space-y-1">
                              {srv.contactPhone && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate">{srv.contactPhone}</span>
                                </div>
                              )}
                              {srv.contactEmail && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Mail className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                  <span className="truncate">{srv.contactEmail}</span>
                                </div>
                              )}
                              {srv.contactUrl && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Globe className="w-3.5 h-3.5 text-[#7004DC] shrink-0" />
                                  <a href={srv.contactUrl} target="_blank" rel="noreferrer" className="text-[#7004DC] hover:underline truncate">
                                    Booking Link ↗
                                  </a>
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4 hidden lg:table-cell">
                              <p className="text-xs font-bold text-[#1A1C1C] truncate">{srv.price}</p>
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${srv.status === "unpublished" ? "bg-slate-100 text-slate-600 border border-slate-200" : "bg-green-100 text-green-700 border border-green-200"}`}>
                                {srv.status === "unpublished" ? "Unpublished" : "Published"}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right pr-6 whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleToggleServiceStatus(srv)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${srv.status === "unpublished" ? "text-slate-400 hover:text-green-600 hover:bg-green-50" : "text-green-600 hover:text-slate-500 hover:bg-slate-100"}`}
                                  title={srv.status === "unpublished" ? "Publish Service" : "Unpublish Service"}
                                >
                                  {srv.status === "unpublished" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button onClick={() => handleOpenEditService(srv)} className="w-8 h-8 rounded-lg text-[#7004DC] hover:bg-violet-100/70 flex items-center justify-center transition" title="Edit Service">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => { setDeleteServiceTarget({ id: srv.id, name: srv.name }); setDeleteServiceError(""); }} className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition" title="Delete Service">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── QUESTION DETAIL + REPLY PANEL ── */}
        {activeTab === "Forums" && (selectedQuestion || questionDetailLoading) && (
          <div className="fixed right-0 top-0 h-full w-[420px] bg-white border-l border-gray-100 shadow-2xl z-40 flex flex-col" style={{ top: 0 }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <h3 className="font-extrabold text-base text-[#1A1C1C]">Question Detail</h3>
              <button onClick={() => setSelectedQuestion(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            {questionDetailLoading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedQuestion && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 border-b border-gray-100 shrink-0 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${selectedQuestion.question.isDeleted ? "bg-red-100 text-red-600" : selectedQuestion.question.status === "SOLVED" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                      {selectedQuestion.question.isDeleted ? "Deleted" : selectedQuestion.question.status === "SOLVED" ? "Solved" : "Unsolved"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#F3F3F3] text-[10px] font-bold text-[#4B4355]">{selectedQuestion.question.category}</span>
                  </div>
                  <h4 className="font-extrabold text-base text-[#1A1C1C] leading-5">{selectedQuestion.question.title}</h4>
                  {selectedQuestion.question.description && (
                    <p className="text-sm text-[#4B4355] leading-5">{selectedQuestion.question.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-[#7D7387]">
                    <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" /> {selectedQuestion.question.authorName}</span>
                    <span>👁 {selectedQuestion.question.views} views</span>
                    <span>🕐 {selectedQuestion.question.createdAt}</span>
                  </div>
                  {!selectedQuestion.question.isDeleted && (
                    <button
                      onClick={() => deleteQuestion(selectedQuestion.question.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete question
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {selectedQuestion.answers.length} {selectedQuestion.answers.length === 1 ? "ANSWER" : "ANSWERS"}
                  </p>
                  {selectedQuestion.answers.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">No answers yet. Be the first to reply.</p>
                  )}
                  {selectedQuestion.answers.map((answer) => (
                    <div key={answer.id} className={`rounded-xl p-4 border ${answer.authorEmail === "admin@digiability.com" ? "border-[#7004DC]/20 bg-violet-50" : "border-gray-100 bg-[#F7F5FA]"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-[#EDDCFF] text-[#7004DC] flex items-center justify-center text-xs font-bold shrink-0">
                          {answer.authorName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#1A1C1C] truncate">{answer.authorName}</p>
                          <p className="text-[10px] text-[#7D7387]">{answer.createdAt}</p>
                        </div>
                        {answer.authorEmail === "admin@digiability.com" && (
                          <span className="px-2 py-0.5 rounded-full bg-[#7004DC] text-white text-[9px] font-bold uppercase shrink-0">Admin</span>
                        )}
                        {answer.isAccepted && (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-[#1A1C1C] leading-5">{answer.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#7D7387]">
                        <span>👍 {answer.upvotes}</span>
                        <span>👎 {answer.downvotes}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {!selectedQuestion.question.isDeleted && (
                  <div className="p-5 border-t border-gray-100 shrink-0 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ADMIN REPLY</p>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write an official admin reply..."
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#7004DC] resize-none"
                    />
                    <button
                      onClick={postReply}
                      disabled={!replyText.trim() || replyPosting}
                      className="w-full h-11 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-200 text-white font-bold text-sm transition flex items-center justify-center gap-2"
                    >
                      {replyPosting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Post Reply</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>{/* end content wrapper */}

      {/* ────────────────── CREATE / EDIT SERVICE MODAL ────────────────── */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">
                  {editingServiceId ? "Edit Professional Service" : "Publish New Professional Service"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingServiceId ? "Modify verified provider and contact details" : "Add a new therapist, vendor, or support provider for mobile community users"}
                </p>
              </div>
              <button
                onClick={() => setIsServiceModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveService} className="flex-1 overflow-y-auto p-6 space-y-5">
              {serviceErrorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-semibold">
                  {serviceErrorMsg}
                </div>
              )}
              {serviceSuccessMsg && (
                <div className="p-3.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {serviceSuccessMsg}
                </div>
              )}

              {/* COVER IMAGE OR LOGO */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Provider Image / Logo <span className="normal-case font-normal text-slate-400">(Upload from Device)</span>
                </label>

                {serviceFormData.image ? (
                  <div className="relative rounded-2xl border-2 border-violet-200 overflow-hidden bg-slate-50 p-2 flex items-center gap-4">
                    <img
                      src={serviceFormData.image}
                      alt="Provider Preview"
                      className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-sm"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-[#1A1C1C]">Image attached</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Displays in the mobile services feed</p>
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
                          onClick={() => setServiceFormData(prev => ({ ...prev, image: "" }))}
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
                    className="border-2 border-dashed border-slate-300 hover:border-[#7004DC] rounded-2xl p-5 text-center cursor-pointer bg-[#FBF9FE] transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mx-auto mb-2 text-[#7004DC] group-hover:scale-110 transition">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-[#1A1C1C]">Click to upload provider photo or logo</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WEBP up to 5MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </div>

              {/* TWO COLUMN GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Provider / Service Name *
                  </label>
                  <input
                    name="name"
                    required
                    value={serviceFormData.name}
                    onChange={e => setServiceFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Dr. Sarah Jenkins"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#7004DC]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Service Category *
                  </label>
                  <select
                    value={serviceFormData.category}
                    onChange={e => setServiceFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#7004DC] bg-white"
                  >
                    {serviceMasterCategories.length > 0
                      ? serviceMasterCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                      : [
                        "Therapists",
                        "Equipment Vendor",
                        "Respite Care",
                        "Legal Services",
                        "Transportation",
                        "Medical Support",
                      ].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Professional Title / Sub-type *
                  </label>
                  <input
                    name="type"
                    required
                    value={serviceFormData.type}
                    onChange={e => setServiceFormData(prev => ({ ...prev, type: e.target.value }))}
                    placeholder="e.g. Pediatric Occupational Therapist, Custom Wheelchair Specialist"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#7004DC]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Location &amp; Service Address *
                  </label>
                  <input
                    required
                    value={serviceFormData.location}
                    onChange={e => setServiceFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g. Downtown Clinic & Home Visits, Westside Hub"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#7004DC]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Description &amp; Specialties *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={serviceFormData.description}
                    onChange={e => setServiceFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Specialized in pediatric therapy, accessibility fittings, legal counsel..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#7004DC] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Pricing / Rate *
                  </label>
                  <input
                    required
                    value={serviceFormData.price}
                    onChange={e => setServiceFormData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="e.g. ₹500 - ₹1,500 / session, Free consultation"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#7004DC]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Availability *
                  </label>
                  <WeeklyScheduleEditor
                    value={serviceFormData.availabilitySchedule}
                    onChange={(next) => setServiceFormData(prev => ({ ...prev, availabilitySchedule: next }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Contact Phone <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={serviceFormData.contactPhone}
                    onChange={e => setServiceFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="+91 91xxxxxxxx"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#7004DC]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Contact Email <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={serviceFormData.contactEmail}
                    onChange={e => setServiceFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="provider@email.com"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#7004DC]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Website / Booking URL <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={serviceFormData.contactUrl}
                    onChange={e => setServiceFormData(prev => ({ ...prev, contactUrl: e.target.value }))}
                    placeholder="https://services.digiability.org/booking"
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#7004DC]"
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="verified"
                    checked={serviceFormData.verified}
                    onChange={e => setServiceFormData(prev => ({ ...prev, verified: e.target.checked }))}
                    className="w-4 h-4 rounded accent-[#7004DC] cursor-pointer"
                  />
                  <label htmlFor="verified" className="text-xs font-bold text-[#1A1C1C] cursor-pointer flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Verified Provider Badge (Recommended)
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Publish Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setServiceFormData(prev => ({ ...prev, status: "published" }))}
                      className={`h-11 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${serviceFormData.status === "published" ? "bg-green-50 text-green-700 border-green-500 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                    >
                      <Eye className="w-4 h-4" /> Published (Live on App)
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceFormData(prev => ({ ...prev, status: "unpublished" }))}
                      className={`h-11 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${serviceFormData.status === "unpublished" ? "bg-amber-50 text-amber-700 border-amber-500 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                    >
                      <EyeOff className="w-4 h-4" /> Unpublished (Draft / Hidden)
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={serviceSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#7004DC] text-white text-sm font-bold hover:bg-[#5c03b7] transition flex items-center gap-2 disabled:opacity-50"
                >
                  {serviceSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingServiceId ? "Save Changes" : "Publish Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE SERVICE CONFIRMATION */}
      <ConfirmModal
        open={!!deleteServiceTarget}
        title="Delete this service?"
        message={
          deleteServiceTarget
            ? `"${deleteServiceTarget.name}" will be permanently removed from the directory and will no longer appear in the mobile app. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete Service"
        destructive
        busy={deletingService}
        error={deleteServiceError}
        icon={Trash2}
        onConfirm={handleDeleteService}
        onCancel={() => { setDeleteServiceTarget(null); setDeleteServiceError(""); }}
      />
    </div>
  );
}
