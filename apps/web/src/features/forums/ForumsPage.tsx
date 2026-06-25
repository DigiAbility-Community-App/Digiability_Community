import { useState, useEffect, useCallback } from "react";
import { Search, Plus, MessageSquare, Eye, Clock } from "lucide-react";
import { apiClient } from "../../services/apiClient";
import "./ForumsPage.css";

const CATEGORIES = [
  { id: "all", name: "All", emoji: "🌐" },
  { id: "Healthcare", name: "Healthcare", emoji: "🏥" },
  { id: "Government Schemes", name: "Schemes", emoji: "📜" },
  { id: "Accessibility", name: "Accessibility", emoji: "♿" },
  { id: "Education", name: "Education", emoji: "🎓" },
  { id: "Jobs", name: "Jobs", emoji: "💼" },
  { id: "Mental Health", name: "Mental Health", emoji: "🧠" },
  { id: "Legal Help", name: "Legal Help", emoji: "⚖️" },
  { id: "Assistive Technology", name: "Assistive Tech", emoji: "💻" },
  { id: "Caregiver Support", name: "Caregiver", emoji: "🤝" },
  { id: "Community", name: "Community", emoji: "👥" }
];

const ForumsPage = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { sort, limit: 20 };
      if (searchQuery) params.search = searchQuery;
      if (category !== "all") params.category = category;

      const res = await apiClient.get("/api/forum/questions", { params });
      setQuestions(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch questions:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, category, sort]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchQuestions();
    }
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="forums-container">
      <div className="search-section">
        <div className="search-bar">
          <Search size={18} color="#6B7280" style={{ marginRight: 8 }} />
          <input
            className="search-input"
            placeholder="Search questions... (Press Enter)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchSubmit}
          />
        </div>

        <div className="category-scroll">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`category-btn ${category === cat.id ? 'active-category-btn' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>

        <div className="sort-row">
          <span className="sort-label">SORT BY</span>
          <div className="sort-buttons">
            <button className={`sort-btn ${sort === 'newest' ? 'active-sort-btn' : ''}`} onClick={() => setSort('newest')}>
              Latest
            </button>
            <button className={`sort-btn ${sort === 'popular' ? 'active-sort-btn' : ''}`} onClick={() => setSort('popular')}>
              Top Views
            </button>
            <button className={`sort-btn ${sort === 'answers' ? 'active-sort-btn' : ''}`} onClick={() => setSort('answers')}>
              Comments
            </button>
          </div>
        </div>
      </div>

      <div className="questions-list">
        {loading ? (
          <div className="center-container">
            <p>Loading questions...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="center-container">
            <h3>No Questions Found</h3>
            <p>Be the first to ask a question in this category or start a discussion.</p>
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="question-card">
              <div className="question-header">
                <div className="author-info">
                  <div className="author-avatar">
                    {q.author?.name ? q.author.name.substring(0, 2).toUpperCase() : "??"}
                  </div>
                  <span className="author-name">{q.author?.name || "Unknown"}</span>
                  {q.status === 'SOLVED' && <span className="solved-badge">Solved</span>}
                </div>
                <div className="question-time">
                  <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                  {timeAgo(q.createdAt)}
                </div>
              </div>

              <h3 className="question-title">{q.title}</h3>
              {q.description && <p className="question-desc">{q.description}</p>}

              <div className="question-footer">
                <span className="tag-badge">{q.category}</span>
                <div className="stats-row">
                  <div className="stat-item">
                    <Eye size={16} />
                    <span>{q.views} views</span>
                  </div>
                  <div className="stat-item">
                    <MessageSquare size={16} />
                    <span>{q.answerCount} answers</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ForumsPage;
