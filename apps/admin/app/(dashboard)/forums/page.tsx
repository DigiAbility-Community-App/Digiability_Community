"use client";

import { useEffect, useState } from "react";
import {
  Search, ChevronDown, X, Shield, Trash2,
  RefreshCw, AlertTriangle, Users, MessageSquare, CheckCircle2,
  MoreHorizontal, Star, ChevronRight, Ban,
} from "lucide-react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface Report {
  id: string;
  reason: string;
  createdAt: string;
  type: "question" | "answer";
  questionId: string | null;
  answerId: string | null;
  questionTitle: string | null;
  answerContent: string | null;
  reporterName: string;
  reporterEmail: string;
}

interface Group {
  id: string;
  name: string | null;
  description: string | null;
  subType: "GENERAL" | "CARE_CIRCLE" | null;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  maxMembers: number;
  memberCount: string;
}

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

const SUCCESS_STORIES = [
  { id: "s1", img: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&q=80", banner: "PENDING REVIEW", bannerColor: "bg-[#D2A500]", category: "EDUCATION MILESTONE", categoryColor: "bg-[#7004DC]", author: "Liam Peterson", role: "PWD·STUDENT", title: "Overcoming Barriers: My Graduation Day Journey", desc: "After four years of dedicated study and navigating complex accessibility challenges, I finally...", time: "Submitted 2 days ago", celebrates: "245 Celebrates", status: "pending" },
  { id: "s2", img: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&q=80", banner: "PUBLISHED", bannerColor: "bg-green-500", category: "EMPLOYMENT", categoryColor: "bg-green-600", author: "Sarah Jenkins", role: "EDUCATOR", title: "Finding My Voice through Digital Design", desc: "Adaptive tools changed everything for Sarah. Learn how she secured her first full-time role as a junior...", time: "Published 1 week ago", celebrates: "1.2k Celebrates", status: "published" },
  { id: "s3", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80", banner: "REJECTED", bannerColor: "bg-red-500", category: "COMMUNITY", categoryColor: "bg-orange-500", author: "Mike Chen", role: "CAREGIVER", title: "Lessons in Group Support Dynamics", desc: "While the support group was helpful, there were some significant hurdles we faced in organizing the...", time: "Rejected 3 days ago", celebrates: "", status: "rejected", rejectionReason: "Reason: Promotional Content" },
  { id: "s4", img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80", banner: "PENDING REVIEW", bannerColor: "bg-[#D2A500]", category: "INDEPENDENCE", categoryColor: "bg-[#7004DC]", author: "Emma Wilson", role: "PWD·SELF-ADVOCATE", title: "Mastering My Kitchen: My First Independent Meal", desc: "It started with a simple grilled cheese, but for me, it was a massive victory. After months of...", time: "Submitted 5 hours ago", celebrates: "89 Celebrates", status: "pending" },
];

const GROUP_CARDS = [
  { id: "g1", bg: "bg-gradient-to-br from-[#7004DC] to-[#4a0099]", icon: "🧠", name: "Neuro-Inclusion Network", category: "Support", desc: "A peer support group focusing on navigating corporate...", members: "1,248", postsToday: "42", status: "Active" },
  { id: "g2", bg: "bg-gradient-to-br from-slate-600 to-slate-800", icon: "</>", name: "Accessible Coding", category: "Education", desc: "Learning and sharing best practices for WCAG 2.2...", members: "856", postsToday: "15", status: "Active" },
  { id: "g3", bg: "bg-gradient-to-br from-red-400 to-orange-300", icon: "📢", name: "Advocacy Leaders", category: "Community", desc: "Global advocacy group organizing digital awareness...", members: "3,412", postsToday: "118", status: "Under Review" },
  { id: "g4", bg: "bg-gradient-to-br from-violet-400 to-purple-300", icon: "🏋", name: "Adaptive Sports Hub", category: "Social", desc: "Connecting athletes of all abilities to find local teams,...", members: "529", postsToday: "8", status: "Active" },
  { id: "g5", bg: "bg-gradient-to-br from-slate-300 to-slate-400", icon: "🕐", name: "Archived Tech 2022", category: "Archive", desc: "Former group for legacy system support. This group is currently...", members: "241", postsToday: "0", status: "Inactive" },
  { id: "g6", bg: "bg-gradient-to-br from-slate-400 to-slate-500", icon: "🎓", name: "Mentorship Circle", category: "Education", desc: "One-on-one and group mentoring for junior developers", members: "192", postsToday: "12", status: "Active" },
];

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<"Forums" | "Reported Content" | "Groups" | "Success Stories">("Forums");
  const [search, setSearch] = useState("");

  // Reports data
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Groups data
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Forum data — real questions from DB
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [forumStats, setForumStats] = useState({ total: 0, solved: 0, unsolved: 0, totalViews: 0, totalAnswers: 0 });
  const [selectedQuestion, setSelectedQuestion] = useState<ForumQuestionDetail | null>(null);
  const [questionDetailLoading, setQuestionDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);

  // Suspend Group modal
  const [suspendGroup, setSuspendGroup] = useState<(typeof GROUP_CARDS)[0] | null>(null);
  const [suspendReason, setSuspendReason] = useState("Spam/Harassment");
  const [suspendNote, setSuspendNote] = useState("");

  // Send Message modal
  const [messageGroup, setMessageGroup] = useState<typeof GROUP_CARDS[0] | null>(null);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgType, setMsgType] = useState("General Update");
  const [msgSendTo, setMsgSendTo] = useState<string[]>(["All Members"]);

  // Story modals
  const [approveStory, setApproveStory] = useState<typeof SUCCESS_STORIES[0] | null>(null);
  const [rejectStory, setRejectStory] = useState<typeof SUCCESS_STORIES[0] | null>(null);
  const [featureStory, setFeatureStory] = useState<typeof SUCCESS_STORIES[0] | null>(null);
  const [rejectReason, setRejectReason] = useState("Other");
  const [rejectNote, setRejectNote] = useState("");
  const [featureDuration, setFeatureDuration] = useState(14);

  // Stories state
  const [stories, setStories] = useState(SUCCESS_STORIES);
  const [storyFilter, setStoryFilter] = useState("All Stories");

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await fetch("/api/moderation");
      const data = await res.json();
      if (data.success) setReports(data.reports);
    } catch (e) { console.error(e); }
    finally { setReportsLoading(false); }
  };

  const fetchGroups = async () => {
    setGroupsLoading(true);
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (data.success) setGroups(data.groups);
    } catch (e) { console.error(e); }
    finally { setGroupsLoading(false); }
  };

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

  useEffect(() => {
    if (activeTab === "Reported Content") fetchReports();
    if (activeTab === "Groups") fetchGroups();
    if (activeTab === "Forums") fetchQuestions();
  }, [activeTab]);

  const handleReportAction = async (action: string, report: Report) => {
    await fetch("/api/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reportId: report.id, questionId: report.questionId }),
    });
    fetchReports();
    setSelectedReport(null);
  };

  const TABS = ["Forums", "Reported Content", "Groups", "Success Stories"] as const;

  return (
    <div className="flex flex-col h-full">

      {/* TOP HEADER */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-white">
        <h1 className="text-xl font-extrabold text-[#1A1C1C]">Community Management</h1>
        {activeTab === "Forums" && (
          <button onClick={fetchQuestions} className="h-10 px-4 rounded-xl border border-gray-200 text-[#4B4355] font-bold text-sm flex items-center gap-2 transition hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        )}
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-100 bg-white px-8">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`mr-8 py-4 text-sm font-semibold border-b-2 transition -mb-px ${activeTab === tab ? "border-[#7004DC] text-[#7004DC]" : "border-transparent text-[#7D7387] hover:text-[#1A1C1C]"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="flex items-center gap-3 px-8 py-4 bg-white border-b border-gray-100">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reported posts or users..." className="w-full h-9 rounded-xl bg-[#F7F5FA] pl-9 pr-3 text-sm outline-none border border-transparent focus:border-[#8A38F5]" />
        </div>
        <button className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] flex items-center gap-1.5">All Status <ChevronDown className="w-3 h-3" /></button>
        <button className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] flex items-center gap-1.5">Content Type <ChevronDown className="w-3 h-3" /></button>
        <button className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] flex items-center gap-1.5">📅 Date Range</button>
      </div>

      {/* CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 overflow-y-auto p-8 ${(selectedQuestion || selectedReport) ? "xl:mr-[440px]" : ""}`}>

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
                  ) : questions
                    .filter(q => !search || q.title.toLowerCase().includes(search.toLowerCase()) || q.authorName.toLowerCase().includes(search.toLowerCase()))
                    .map(q => (
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

          {/* ── REPORTED CONTENT TAB ── */}
          {activeTab === "Reported Content" && (
            <div>
              {reportsLoading ? (
                <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[2fr_3fr_1fr_120px] bg-[#F7F5FA] border-b border-gray-100">
                    {["REPORTER", "CONTENT PREVIEW", "REASON", "DATE"].map(h => (
                      <div key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387]">{h}</div>
                    ))}
                  </div>
                  {reports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Shield className="w-12 h-12 mb-3 text-slate-300" />
                      <p className="font-semibold">No reported content</p>
                    </div>
                  ) : reports.filter(r => !search || r.reporterName.toLowerCase().includes(search.toLowerCase()) || (r.questionTitle || "").toLowerCase().includes(search.toLowerCase())).map(report => (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                      className={`grid grid-cols-[2fr_3fr_1fr_120px] items-center border-b border-gray-100 cursor-pointer transition ${selectedReport?.id === report.id ? "bg-violet-50" : "hover:bg-[#FAFAFA]"}`}
                    >
                      <div className="px-5 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#EDDCFF] text-[#7004DC] flex items-center justify-center text-xs font-bold shrink-0">
                          {(report.reporterName || "?").charAt(0)}
                        </div>
                        <span className="text-sm font-semibold text-[#1A1C1C] truncate">
                          {(report.reporterName || "Unknown").split(" ")[0]}{" "}
                          {(report.reporterName || "").split(" ")[1]?.[0] ? `${(report.reporterName || "").split(" ")[1][0]}.` : ""}
                        </span>
                      </div>
                      <div className="px-5 py-4 text-sm text-[#4B4355] truncate">
                        "{(report.questionTitle || report.answerContent || "Content").substring(0, 40)}..."
                      </div>
                      <div className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${report.reason.toLowerCase().includes("spam") ? "bg-yellow-100 text-yellow-700" : report.reason.toLowerCase().includes("harassment") ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                          {report.reason.substring(0, 12)}
                        </span>
                      </div>
                      <div className="px-5 py-4 text-xs text-[#7D7387]">{report.createdAt}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── GROUPS TAB ── */}
          {activeTab === "Groups" && (
            <div>
              {groupsLoading ? (
                <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {(groups.length > 0 ? groups.map((g, i) => ({
                      id: g.id,
                      bg: ["bg-gradient-to-br from-[#7004DC] to-[#4a0099]", "bg-gradient-to-br from-slate-600 to-slate-800", "bg-gradient-to-br from-red-400 to-orange-300", "bg-gradient-to-br from-violet-400 to-purple-300", "bg-gradient-to-br from-slate-300 to-slate-400", "bg-gradient-to-br from-slate-400 to-slate-500"][i % 6],
                      icon: ["🧠", "</>", "📢", "🏋", "🕐", "🎓"][i % 6],
                      name: g.name || "Group",
                      category: g.subType === "CARE_CIRCLE" ? "Care Circle" : "General",
                      desc: g.description || "Community group",
                      members: g.memberCount,
                      postsToday: "—",
                      status: "Active",
                    })) : GROUP_CARDS).filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())).map(g => (
                      <div key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className={`h-24 ${g.bg} flex items-center justify-center relative`}>
                          <span className="text-4xl">{g.icon}</span>
                          <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="font-extrabold text-sm text-[#1A1C1C]">{g.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ml-2 shrink-0 ${g.status === "Active" ? "bg-green-100 text-green-700" : g.status === "Inactive" ? "bg-gray-100 text-gray-500" : "bg-orange-100 text-orange-700"}`}>
                              {g.status}
                            </span>
                          </div>
                          <span className="inline-block px-2 py-0.5 rounded-full bg-[#F3F3F3] text-[9px] font-bold uppercase text-[#4B4355] mb-2">{g.category}</span>
                          <p className="text-xs text-[#7D7387] line-clamp-2 mb-3">{g.desc}</p>
                          <div className="flex items-center gap-4 text-xs text-[#7D7387] mb-4">
                            <div><p className="text-[9px] font-bold uppercase tracking-wider">MEMBERS</p><p className="font-bold text-[#1A1C1C]">{g.members}</p></div>
                            <div><p className="text-[9px] font-bold uppercase tracking-wider">POSTS TODAY</p><p className="font-bold text-[#1A1C1C]">{g.postsToday}</p></div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setMessageGroup(g as any)} className="flex-1 h-9 rounded-xl border border-[#7004DC] text-[#7004DC] text-xs font-bold hover:bg-violet-50 transition flex items-center justify-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5" /> Message
                            </button>
                            {g.status === "Inactive" ? (
                              <button className="flex-1 h-9 rounded-xl bg-[#7004DC] text-white text-xs font-bold hover:bg-[#5c03b7] transition flex items-center justify-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5" /> Restore
                              </button>
                            ) : (
                              <button onClick={() => setSuspendGroup(g as any)} className="flex-1 h-9 rounded-xl border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition flex items-center justify-center gap-1.5">
                                <Ban className="w-3.5 h-3.5" /> Suspend
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-[#7D7387] mt-5">Showing 1–{Math.min(6, (groups.length || GROUP_CARDS.length))} of {groups.length || GROUP_CARDS.length} groups</p>
                </>
              )}
            </div>
          )}

          {/* ── SUCCESS STORIES TAB ── */}
          {activeTab === "Success Stories" && (
            <div>
              {/* SUB-TABS */}
              <div className="flex items-center gap-2 mb-4">
                {["All Stories", "Pending", "Approved", "Rejected"].map(f => (
                  <button
                    key={f}
                    onClick={() => setStoryFilter(f)}
                    className={`h-9 px-4 rounded-xl text-sm font-bold transition ${storyFilter === f ? "bg-[#1A1C1C] text-white" : "bg-[#F3F3F3] text-[#4B4355] hover:bg-[#EBEBEB]"}`}
                  >
                    {f}
                    {f === "Pending" && <span className="ml-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold inline-flex items-center justify-center">5</span>}
                  </button>
                ))}
                <div className="ml-auto flex gap-2">
                  <button className="h-9 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Batch Approve</button>
                  <button className="h-9 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-slate-400 flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Batch Feature</button>
                </div>
              </div>

              {/* FILTERS */}
              <div className="flex items-center gap-3 mb-5">
                <button className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] flex items-center gap-1.5">Category: All Milestones <ChevronDown className="w-3 h-3" /></button>
                <button className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] flex items-center gap-1.5">Date: This Month 📅</button>
                <button className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] flex items-center gap-1.5">Author: All Roles 👤</button>
                <button className="ml-auto text-xs font-bold text-[#7004DC] hover:underline">Clear all filters</button>
              </div>

              {/* STORY CARDS */}
              {(() => {
                const filtered = stories.filter(s => {
                  if (storyFilter === "Pending") return s.status === "pending";
                  if (storyFilter === "Approved") return s.status === "published";
                  if (storyFilter === "Rejected") return s.status === "rejected";
                  return true;
                });
                if (filtered.length === 0) return (
                  <div className="col-span-3 flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                    <Star className="w-10 h-10 text-slate-300" />
                    <p className="font-semibold">No stories in this category</p>
                  </div>
                );
                return null;
              })()}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {stories.filter(s => {
                  if (storyFilter === "Pending") return s.status === "pending";
                  if (storyFilter === "Approved") return s.status === "published";
                  if (storyFilter === "Rejected") return s.status === "rejected";
                  return true;
                }).map(story => (
                  <div key={story.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* IMAGE */}
                    <div className="relative">
                      <img src={story.img} alt={story.title} className="w-full h-44 object-cover" onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1517245386807?w=400&q=80"; }} />
                      <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase text-white ${story.bannerColor}`}>{story.banner}</div>
                      <div className={`absolute bottom-3 left-3 px-2 py-1 rounded-md text-[9px] font-bold uppercase text-white ${story.categoryColor}`}>{story.category}</div>
                    </div>
                    {/* CONTENT */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-[#EDDCFF] flex items-center justify-center text-[#7004DC] text-xs font-bold">{story.author[0]}</div>
                        <div><p className="text-xs font-bold text-[#1A1C1C]">{story.author}</p><p className="text-[9px] text-[#7D7387]">{story.role}</p></div>
                      </div>
                      <h3 className="font-extrabold text-sm text-[#1A1C1C] mb-1 line-clamp-2">{story.title}</h3>
                      <p className="text-xs text-[#7D7387] line-clamp-2 mb-2">{story.desc}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                        <span>{story.time}</span>
                        {story.celebrates && <span>🎉 {story.celebrates}</span>}
                        {story.rejectionReason && <span className="text-red-500 font-semibold">{story.rejectionReason}</span>}
                      </div>
                      {/* ACTIONS */}
                      {story.status === "pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => setApproveStory(story)} className="flex-1 h-8 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition">Approve</button>
                          <button onClick={() => setRejectStory(story)} className="flex-1 h-8 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition">Reject</button>
                          <button className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-slate-400 hover:bg-gray-50"><MoreHorizontal className="w-4 h-4" /></button>
                        </div>
                      )}
                      {story.status === "published" && (
                        <div className="flex gap-2">
                          <button className="flex-1 h-8 rounded-xl border border-[#7004DC] text-[#7004DC] text-xs font-bold hover:bg-violet-50 transition">View</button>
                          <button onClick={() => setFeatureStory(story)} className="flex-1 h-8 rounded-xl border border-[#D2A500] text-[#755B00] text-xs font-bold hover:bg-yellow-50 transition flex items-center justify-center gap-1"><Star className="w-3.5 h-3.5" /> Feature</button>
                          <button className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-slate-400 hover:bg-gray-50"><MoreHorizontal className="w-4 h-4" /></button>
                        </div>
                      )}
                      {story.status === "rejected" && (
                        <div className="flex gap-2">
                          <button className="flex-1 h-8 rounded-xl border border-gray-200 text-[#4B4355] text-xs font-bold hover:bg-gray-50 transition">Restore</button>
                          <button className="flex-1 h-8 rounded-xl border border-gray-200 text-[#4B4355] text-xs font-bold hover:bg-gray-50 transition">Edit Note</button>
                          <button className="w-8 h-8 rounded-xl border border-red-200 text-red-400 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
                {/* Question */}
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
                    <span>👤 {selectedQuestion.question.authorName}</span>
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

                {/* Answers */}
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

                {/* Admin Reply Box */}
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
                      {replyPosting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>➤ Post Reply</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CONTENT REVIEW PANEL ── */}
        {selectedReport && activeTab === "Reported Content" && (
          <div className="fixed right-0 top-0 h-full w-[360px] bg-white border-l border-gray-100 shadow-2xl z-40 overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-base text-[#1A1C1C]">Content Review</h3>
                <p className="text-xs text-[#7D7387] mt-0.5">Report ID: #{selectedReport.id.slice(-4)}</p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-bold uppercase">PENDING REVIEW</span>
              <div className="flex items-center gap-2 text-xs text-[#7D7387]">
                <span>📄</span> Content type: {selectedReport.type === "question" ? "Post" : "Answer"}
              </div>
              <div className="bg-[#F7F5FA] rounded-xl p-4">
                <p className="text-sm text-[#1A1C1C] leading-5">"{selectedReport.questionTitle || selectedReport.answerContent || "Reported content"}"</p>
                <button className="text-xs font-bold text-[#7004DC] mt-2 hover:underline">View full content ↓</button>
              </div>
              <div className="bg-[#F7F5FA] rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#EDDCFF] flex items-center justify-center text-[#7004DC] text-xs font-bold">{selectedReport.reporterName?.[0]}</div>
                <div>
                  <p className="text-sm font-bold text-[#1A1C1C]">{selectedReport.reporterName}</p>
                  <p className="text-xs text-green-600 font-semibold">✓ Trustworthy</p>
                </div>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase ${selectedReport.reason.toLowerCase().includes("spam") ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                {selectedReport.reason}
              </span>
              <div className="text-sm text-[#7D7387]">User reported potential violation of community guidelines.</div>
              <div className="bg-[#F7F5FA] rounded-xl p-3">
                <p className="text-xs font-bold text-[#1A1C1C]">{selectedReport.reporterName}</p>
                <p className="text-xs text-[#7D7387]">Community Member • Reporter</p>
              </div>
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleReportAction("dismiss", selectedReport)} className="h-11 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Approve</button>
                  <button onClick={() => handleReportAction("delete_post", selectedReport)} className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Remove</button>
                </div>
                <button className="w-full h-11 rounded-xl bg-[#D2A500] hover:bg-[#b89300] text-[#4F3D00] font-bold text-sm transition flex items-center justify-center gap-2">
                  ⚠ Warn User
                </button>
                <button onClick={() => handleReportAction("dismiss", selectedReport)} className="w-full h-11 rounded-xl border border-gray-200 text-[#4B4355] font-bold text-sm hover:bg-gray-50 transition">
                  No Action Required
                </button>
                <button className="w-full h-11 rounded-xl bg-[#1A1C1C] hover:bg-black text-white font-bold text-sm transition flex items-center justify-center gap-2">
                  🚫 Ban User Account
                </button>
              </div>
              <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7004DC] mb-1">MODERATION TIP</p>
                <p className="text-xs text-[#4B4355] leading-4">Accounts with more than 3 warnings in a 30-day period are automatically flagged for permanent suspension.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────── MODALS ────────────────── */}

      {/* SUSPEND GROUP MODAL */}
      {suspendGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-7 py-6">
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-xl font-extrabold text-red-600">Suspend This Group?</h3>
              </div>
              <div className="bg-[#F7F5FA] rounded-xl p-4 flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#EDDCFF] flex items-center justify-center text-lg">{suspendGroup.icon}</div>
                <div>
                  <p className="font-bold text-sm text-[#1A1C1C]">{suspendGroup.name}</p>
                  <p className="text-xs text-[#7D7387]">{suspendGroup.members} members</p>
                </div>
              </div>
              <div className="mb-5">
                <p className="text-sm font-semibold text-[#1A1C1C] mb-3">When you suspend a group:</p>
                <div className="space-y-2">
                  {["Members cannot post new messages", "New members cannot join", "Existing content remains visible", "Moderators can still manage content", "Group can be reactivated anytime"].map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm text-[#4B4355]">
                      <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" /> {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Reason for Suspension</label>
                <div className="relative">
                  <select value={suspendReason} onChange={e => setSuspendReason(e.target.value)} className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-red-400 bg-white appearance-none pr-8">
                    {["Spam/Harassment", "Misinformation", "Community Violation", "Inactive", "Other"].map(r => <option key={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Add optional note (visible to moderators only)</label>
                <textarea value={suspendNote} onChange={e => setSuspendNote(e.target.value)} rows={3} placeholder="Why is this group being suspended?" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-400 resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSuspendGroup(null)} className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => setSuspendGroup(null)} className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition">Suspend Group</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEND MESSAGE MODAL */}
      {messageGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-extrabold text-[#1A1C1C]">Send Message to Group</h3>
                <p className="text-xs text-[#7D7387] mt-0.5">Notify all {messageGroup.members} members in the community</p>
              </div>
              <button onClick={() => setMessageGroup(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="px-7 py-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Subject</label>
                <input value={msgSubject} onChange={e => setMsgSubject(e.target.value)} placeholder="Enter message subject..." className="w-full h-12 rounded-xl bg-[#F7F5FA] px-4 text-sm outline-none border border-transparent focus:border-[#8A38F5]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Message</label>
                <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={5} placeholder="Write your message to group members..." className="w-full rounded-xl bg-[#F7F5FA] px-4 py-3 text-sm outline-none border border-transparent focus:border-[#8A38F5] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-[#1A1C1C] mb-3">Message Type</p>
                  <div className="space-y-2">
                    {["General Update", "Urgent Alert", "Announcement"].map(type => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <div onClick={() => setMsgType(type)} className={`w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer ${msgType === type ? "border-[#7004DC]" : "border-gray-300"}`}>
                          {msgType === type && <div className="w-2 h-2 rounded-full bg-[#7004DC]" />}
                        </div>
                        <span className="text-sm text-[#4B4355]">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1C1C] mb-3">Send To</p>
                  <div className="space-y-2">
                    {["All Members", "Active Members Only", "Moderators Only"].map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={msgSendTo.includes(opt)} onChange={e => setMsgSendTo(prev => e.target.checked ? [...prev, opt] : prev.filter(x => x !== opt))} className="w-4 h-4 rounded accent-[#7004DC]" />
                        <span className="text-sm text-[#4B4355]">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* PREVIEW */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">MESSAGE PREVIEW:</p>
                <div className="bg-[#F7F5FA] rounded-xl p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#7004DC] flex items-center justify-center text-white shrink-0">📢</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#1A1C1C]">{msgSubject || "Important Group Update"}</p>
                      <span className="text-xs text-slate-400">Just now</span>
                    </div>
                    <p className="text-xs text-[#7D7387] mt-1">{msgBody || "Preview your message here as you type in the fields above..."}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-[#D2A500] text-[#4F3D00] text-[9px] font-bold uppercase">{msgType.split(" ")[0]}</span>
                    <span className="ml-2 text-[10px] text-slate-400">via DigiAbility Admin</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setMessageGroup(null)} className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => setMessageGroup(null)} disabled={!msgSubject.trim() || !msgBody.trim()} className="flex-1 h-12 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-200 text-white font-bold text-sm transition flex items-center justify-center gap-2">
                  ➤ Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE STORY MODAL */}
      {approveStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-7 py-6">
              <h3 className="text-xl font-extrabold text-[#1A1C1C] mb-4">Approve Story?</h3>
              <div className="bg-[#F7F5FA] rounded-xl p-4 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded bg-violet-100 text-[#7004DC] text-[9px] font-bold uppercase">NEW SUBMISSION</span>
                  <span className="text-xs text-slate-400">{approveStory.time}</span>
                </div>
                <h4 className="font-bold text-sm text-[#1A1C1C] mb-1">{approveStory.title}</h4>
                <p className="text-xs text-[#7D7387]">Author: {approveStory.author}</p>
                <p className="text-xs text-[#7D7387] mt-1 line-clamp-2">{approveStory.desc}</p>
              </div>
              <div className="flex items-center gap-2 mb-5 text-sm text-green-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Standard compliance check passed
              </div>
              <div className="flex gap-3">
                <button onClick={() => setApproveStory(null)} className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => { setStories(prev => prev.map(s => s.id === approveStory.id ? { ...s, status: "published", banner: "PUBLISHED", bannerColor: "bg-green-500" } : s)); setApproveStory(null); }} className="flex-1 h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition">Approve & Publish</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT STORY MODAL */}
      {rejectStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
              <h3 className="text-xl font-extrabold text-[#1A1C1C]">Reject Story</h3>
              <button onClick={() => setRejectStory(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="px-7 py-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-[#1A1C1C] mb-3">Reason for Rejection</p>
                <div className="space-y-2">
                  {["Inappropriate Content", "Promotional/Spam", "Offensive Language", "False Information", "Other"].map(r => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <div onClick={() => setRejectReason(r)} className={`w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer ${rejectReason === r ? "border-[#7004DC]" : "border-gray-300"}`}>
                        {rejectReason === r && <div className="w-2 h-2 rounded-full bg-[#7004DC]" />}
                      </div>
                      <span className="text-sm text-[#4B4355]">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Author Note</label>
                <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Explain why the story was rejected..." className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-400 resize-none" />
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setRejectStory(null)} className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => { setStories(prev => prev.map(s => s.id === rejectStory.id ? { ...s, status: "rejected", banner: "REJECTED", bannerColor: "bg-red-500", rejectionReason: `Reason: ${rejectReason}` } : s)); setRejectStory(null); }} className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition">Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE STORY MODAL */}
      {featureStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-xl font-extrabold text-[#1A1C1C] mb-4">Feature This Story</h3>
              <div className="relative mb-4">
                <img src={featureStory.img} alt="" className="w-full h-40 object-cover rounded-xl" />
                <span className="absolute top-2 left-2 px-2 py-1 rounded bg-[#D2A500] text-[#4F3D00] text-[9px] font-bold uppercase">PREMIUM SPOT</span>
              </div>
              <div className="mb-4">
                <p className="text-sm font-semibold text-[#1A1C1C] mb-3">Feature Duration</p>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map(d => (
                    <button key={d} onClick={() => setFeatureDuration(d)} className={`h-14 rounded-xl border-2 text-sm font-bold transition ${featureDuration === d ? "border-[#7004DC] bg-violet-50 text-[#7004DC]" : "border-gray-200 text-[#4B4355] hover:border-gray-300"}`}>
                      <div className="text-xl font-extrabold">{d}</div>
                      <div className="text-[9px] uppercase tracking-wider">DAYS</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200 mb-5 flex gap-2">
                <Star className="w-4 h-4 text-[#D2A500] shrink-0 mt-0.5" />
                <p className="text-xs text-[#755B00]">Featured stories get highlighted in the success stories carousel at the top of the community homepage.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setFeatureStory(null)} className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => setFeatureStory(null)} className="flex-1 h-11 rounded-xl bg-[#D2A500] hover:bg-[#b89300] text-[#4F3D00] font-bold text-sm flex items-center justify-center gap-1.5">
                  <Star className="w-4 h-4" /> Feature Story
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
