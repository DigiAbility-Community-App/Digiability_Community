"use client";

import { useState, useEffect } from "react";
import {
  Search, X, Trash2,
  RefreshCw, MessageSquare, CheckCircle2,
  User, Send, ChevronLeft, ChevronRight,
} from "lucide-react";
import { DateRangePicker, isWithinDateRange } from "@/components/shared/DateRangePicker";
import { ConfirmModal } from "@/components/shared/ConfirmModal";

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

const DELETED_PAGE_SIZE = 15;

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function CommunityPage() {
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
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [deleteQuestionError, setDeleteQuestionError] = useState("");

  // ── Deleted Questions pagination ──
  const [deletedPage, setDeletedPage] = useState(1);

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

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    setDeletedPage(1);
  }, [search, dateFrom, dateTo]);

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

  const handleDeleteQuestion = async () => {
    if (!deleteQuestionTarget) return;
    setDeletingQuestion(true);
    setDeleteQuestionError("");
    try {
      await deleteQuestion(deleteQuestionTarget.id);
      setDeleteQuestionTarget(null);
    } catch (e) {
      console.error(e);
      setDeleteQuestionError("Failed to delete question");
    } finally {
      setDeletingQuestion(false);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = !search || q.title.toLowerCase().includes(search.toLowerCase()) || q.authorName.toLowerCase().includes(search.toLowerCase());
    const matchesDate = isWithinDateRange(q.createdAtISO, dateFrom, dateTo);
    return matchesSearch && matchesDate;
  });

  // Active vs deleted are now shown in separate sections instead of mixed
  // together (dimmed) in one table.
  const activeQuestions = filteredQuestions.filter(q => !q.isDeleted);
  const deletedQuestions = filteredQuestions.filter(q => q.isDeleted);

  const deletedTotalPages = Math.max(1, Math.ceil(deletedQuestions.length / DELETED_PAGE_SIZE));
  const deletedSafePage = Math.min(deletedPage, deletedTotalPages);
  const pagedDeletedQuestions = deletedQuestions.slice(
    (deletedSafePage - 1) * DELETED_PAGE_SIZE,
    deletedSafePage * DELETED_PAGE_SIZE
  );
  const deletedPageNumbers = (() => {
    const pages: (number | "...")[] = [];
    if (deletedTotalPages <= 7) {
      for (let i = 1; i <= deletedTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (deletedSafePage > 3) pages.push("...");
      for (let i = Math.max(2, deletedSafePage - 1); i <= Math.min(deletedTotalPages - 1, deletedSafePage + 1); i++) pages.push(i);
      if (deletedSafePage < deletedTotalPages - 2) pages.push("...");
      pages.push(deletedTotalPages);
    }
    return pages;
  })();

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] w-full max-w-full overflow-x-hidden">

      {/* TOP HEADER */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-5 border-b border-gray-100 bg-white">
        <div>
          <h1 className="text-xl font-extrabold text-[#1A1C1C]">Discussions & Q&A</h1>
          <p className="text-xs text-[#7D7387] mt-0.5">Monitor questions, provide verified answers, and moderate discussion content</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchQuestions} className="h-10 px-4 rounded-xl border border-gray-200 text-[#4B4355] font-bold text-sm flex items-center gap-2 transition hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex items-center gap-3 px-8 py-4 bg-white border-b border-gray-100 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions or authors..."
            className="w-full h-9 rounded-xl bg-[#F7F5FA] pl-9 pr-3 text-sm outline-none border border-transparent focus:border-[#8A38F5]"
          />
        </div>

        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          className="h-9 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] bg-white outline-none focus:border-[#7004DC]"
        />
      </div>

      {/* CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 overflow-y-auto p-8 ${selectedQuestion ? "xl:mr-[440px]" : ""}`}>
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
                ) : activeQuestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <MessageSquare className="w-12 h-12 mb-3 text-slate-300" />
                    <p className="font-semibold">No active questions match your filters</p>
                  </div>
                ) : activeQuestions.map(q => (
                    <div
                      key={q.id}
                      onClick={() => openQuestion(q.id)}
                      className={`grid grid-cols-[3fr_1fr_80px_80px_100px_100px] items-center border-b border-gray-100 cursor-pointer transition ${selectedQuestion?.question.id === q.id ? "bg-violet-50" : "hover:bg-[#FAFAFA]"}`}
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
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${q.status === "SOLVED" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                          {q.status === "SOLVED" ? "Solved" : "Unsolved"}
                        </span>
                      </div>
                      <div className="px-4 py-3 text-xs text-[#7D7387]">{q.createdAt}</div>
                    </div>
                  ))}
              </div>
            )}

            {/* ── DELETED QUESTIONS (separate section, paginated) ── */}
            {deletedQuestions.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-extrabold text-[#1A1C1C] mb-3">Deleted Questions</h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[3fr_1fr_80px_80px_100px_100px] bg-[#F7F5FA] border-b border-gray-100">
                    {["QUESTION", "CATEGORY", "VIEWS", "ANSWERS", "STATUS", "POSTED"].map(h => (
                      <div key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D7387]">{h}</div>
                    ))}
                  </div>
                  {pagedDeletedQuestions.map(q => (
                    <div
                      key={q.id}
                      onClick={() => openQuestion(q.id)}
                      className={`grid grid-cols-[3fr_1fr_80px_80px_100px_100px] items-center border-b border-gray-100 cursor-pointer transition opacity-60 ${selectedQuestion?.question.id === q.id ? "bg-violet-50" : "hover:bg-[#FAFAFA]"}`}
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
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-600">Deleted</span>
                      </div>
                      <div className="px-4 py-3 text-xs text-[#7D7387]">{q.createdAt}</div>
                    </div>
                  ))}

                  {/* PAGINATION FOOTER */}
                  <div className="bg-[#F7F5FA] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100">
                    <span className="text-xs sm:text-sm text-[#7D7387]">
                      Showing {(deletedSafePage - 1) * DELETED_PAGE_SIZE + 1}–{Math.min(deletedSafePage * DELETED_PAGE_SIZE, deletedQuestions.length)} of {deletedQuestions.length} deleted questions
                    </span>
                    {deletedTotalPages > 1 && (
                      <div className="flex items-center gap-1.5 self-center sm:self-auto">
                        <button
                          onClick={() => setDeletedPage(p => Math.max(1, p - 1))}
                          disabled={deletedSafePage === 1}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-slate-400 flex items-center justify-center disabled:opacity-40"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {deletedPageNumbers.map((p, i) =>
                          p === "..." ? (
                            <span key={`ellipsis-${i}`} className="text-slate-400 text-sm px-1">...</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setDeletedPage(p as number)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition ${deletedSafePage === p
                                ? "bg-[#7004DC] text-white"
                                : "bg-white border border-gray-200 text-slate-500 hover:bg-[#F3F0FF]"
                                }`}
                            >
                              {p}
                            </button>
                          )
                        )}
                        <button
                          onClick={() => setDeletedPage(p => Math.min(deletedTotalPages, p + 1))}
                          disabled={deletedSafePage === deletedTotalPages}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-slate-400 flex items-center justify-center disabled:opacity-40"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── QUESTION DETAIL + REPLY PANEL ── */}
        {(selectedQuestion || questionDetailLoading) && (
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
                      onClick={() => setDeleteQuestionTarget({ id: selectedQuestion.question.id, title: selectedQuestion.question.title })}
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

      {/* DELETE QUESTION CONFIRMATION */}
      <ConfirmModal
        open={!!deleteQuestionTarget}
        title="Delete this question?"
        message={
          deleteQuestionTarget
            ? `"${deleteQuestionTarget.title}" and its answers will be removed from the forum. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete Question"
        destructive
        busy={deletingQuestion}
        error={deleteQuestionError}
        icon={Trash2}
        onConfirm={handleDeleteQuestion}
        onCancel={() => { setDeleteQuestionTarget(null); setDeleteQuestionError(""); }}
      />
    </div>
  );
}
