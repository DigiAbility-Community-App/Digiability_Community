import { useState, useEffect, useCallback } from "react";
import { Star, MapPin, MessageCircle, Search, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { chatService } from "../../services/chatService";
import "./MentorsPage.css";

interface MentorMatch {
  mentorId: string;
  userId: string;
  name: string;
  bio: string | null;
  skills: string[];
  disabilitySpecialties: string[];
  city: string | null;
  state: string | null;
  avgRating: number;
  reviewCount: number;
  matchPercentage: number;
}

const SPECIALTY_COLORS: Record<string, { bg: string; text: string }> = {
  visual:     { bg: "#EEF2FF", text: "#4338CA" },
  hearing:    { bg: "#FEF3C7", text: "#92400E" },
  physical:   { bg: "#ECFDF5", text: "#065F46" },
  cognitive:  { bg: "#FFF1F2", text: "#9F1239" },
  multiple:   { bg: "#F3E8FF", text: "var(--color-primary)" },
};

const getSpecialtyColor = (specialty: string) => {
  const key = specialty.toLowerCase().trim();
  return SPECIALTY_COLORS[key] || { bg: "var(--bg-base)", text: "var(--text-secondary)" };
};

const MentorsPage = () => {
  const navigate = useNavigate();
  const [mentors, setMentors] = useState<MentorMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectingUserId, setConnectingUserId] = useState<string | null>(null);

  const fetchMentors = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/api/users/mentors/match");
      setMentors(res.data.data || []);
    } catch (err) {
      console.warn("Failed to fetch mentors:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const handleConnect = async (mentor: MentorMatch) => {
    setConnectingUserId(mentor.userId);
    try {
      const conversation = await chatService.createDirectChat(mentor.userId);
      navigate(`/app/chats/${conversation.id}`);
    } catch (err: any) {
      alert(err?.message || "Failed to start conversation");
    } finally {
      setConnectingUserId(null);
    }
  };

  const MatchBadge = ({ percentage }: { percentage: number }) => {
    const color = percentage >= 70 ? "#059669" : percentage >= 40 ? "#D97706" : "var(--text-secondary)";
    const bgColor = percentage >= 70 ? "#ECFDF5" : percentage >= 40 ? "#FFFBEB" : "var(--bg-surface-hover)";
    return (
      <span className="match-badge" style={{ backgroundColor: bgColor, color }}>
        {percentage}% match
      </span>
    );
  };

  const StarRating = ({ rating, count }: { rating: number; count: number }) => {
    const stars = Array.from({ length: 5 }, (_, i) => i + 1);
    return (
      <div className="rating-row">
        {stars.map((i) => (
          <Star
            key={i}
            size={14}
            color={i <= Math.round(rating) ? "#F59E0B" : "var(--border-color)"}
            fill={i <= Math.round(rating) ? "#F59E0B" : "transparent"}
          />
        ))}
        <span className="rating-text">{rating > 0 ? rating.toFixed(1) : "—"}</span>
        <span className="review-count">({count} {count === 1 ? "review" : "reviews"})</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="center-container">
        <h3>Finding your best mentors...</h3>
        <p>Please wait while we match you with the right people.</p>
      </div>
    );
  }

  if (mentors.length === 0) {
    return (
      <div className="center-container">
        <div className="empty-icon-box">
          <UserCheck size={44} color="#500088" />
        </div>
        <h3>No Mentors Available</h3>
        <p>There are currently no mentors matching your profile.</p>
        <p>Check back later or update your profile for better matches.</p>
        <button className="refresh-btn" onClick={fetchMentors}>
          <Search size={16} /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="mentors-container">
      <div className="mentors-header">
        <h2>Suggested Mentors</h2>
        <p>Matched based on your disability, location & reviews</p>
      </div>
      
      <div className="mentors-grid">
        {mentors.map((mentor) => (
          <div key={mentor.mentorId} className="mentor-card">
            <div className="card-header">
              <div className="avatar-circle">
                <span className="avatar-text">
                  {mentor.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                </span>
              </div>
              <div className="header-info">
                <div className="name-row">
                  <h4 className="mentor-name">{mentor.name}</h4>
                  <MatchBadge percentage={mentor.matchPercentage} />
                </div>
                {(mentor.city || mentor.state) && (
                  <div className="location-row">
                    <MapPin size={12} />
                    <span>{[mentor.city, mentor.state].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>
            </div>

            {mentor.bio && <p className="bio">{mentor.bio}</p>}

            {mentor.disabilitySpecialties.length > 0 && (
              <div className="badge-row">
                {mentor.disabilitySpecialties.map((spec, idx) => {
                  const colors = getSpecialtyColor(spec);
                  return (
                    <span key={idx} className="specialty-badge" style={{ backgroundColor: colors.bg, color: colors.text }}>
                      {spec}
                    </span>
                  );
                })}
              </div>
            )}

            {mentor.skills.length > 0 && (
              <div className="skills-row">
                {mentor.skills.slice(0, 3).map((skill, idx) => (
                  <span key={idx} className="skill-chip">{skill}</span>
                ))}
                {mentor.skills.length > 3 && (
                  <span className="skill-chip">+{mentor.skills.length - 3} more</span>
                )}
              </div>
            )}

            <div className="card-footer">
              <StarRating rating={mentor.avgRating} count={mentor.reviewCount} />
              <button 
                className="connect-btn" 
                onClick={() => handleConnect(mentor)}
                disabled={connectingUserId === mentor.userId}
              >
                <MessageCircle size={14} />
                {connectingUserId === mentor.userId ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MentorsPage;
