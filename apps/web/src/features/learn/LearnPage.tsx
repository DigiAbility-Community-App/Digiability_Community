import { Play, Clock, Star } from "lucide-react";
import "./LearnPage.css";

const MOCK_COURSES = [
  {
    id: "crs-1",
    title: "Introduction to Assistive Technologies",
    instructor: "Dr. Emily Chen",
    level: "Beginner",
    duration: "2h 15m",
    rating: 4.8,
    reviews: 142,
    emoji: "💻",
  },
  {
    id: "crs-2",
    title: "Navigating Disability Rights in the Workplace",
    instructor: "Legal Advocates Group",
    level: "Intermediate",
    duration: "1h 45m",
    rating: 4.9,
    reviews: 89,
    emoji: "⚖️",
  },
  {
    id: "crs-3",
    title: "Inclusive Design Principles",
    instructor: "Alex Rivera, UX Lead",
    level: "Advanced",
    duration: "3h 30m",
    rating: 4.7,
    reviews: 210,
    emoji: "🎨",
  },
  {
    id: "crs-4",
    title: "Self-Advocacy Masterclass",
    instructor: "Sarah Jenkins",
    level: "All Levels",
    duration: "1h 20m",
    rating: 4.9,
    reviews: 315,
    emoji: "🗣️",
  },
  {
    id: "crs-5",
    title: "Caregiver Support: Stress Management",
    instructor: "Wellness Institute",
    level: "Beginner",
    duration: "2h 00m",
    rating: 4.6,
    reviews: 56,
    emoji: "🧘",
  },
  {
    id: "crs-6",
    title: "Financial Planning with Disability Benefits",
    instructor: "Mark Thompson, CPA",
    level: "Intermediate",
    duration: "4h 10m",
    rating: 4.8,
    reviews: 178,
    emoji: "📊",
  }
];

const LearnPage = () => {
  return (
    <div className="learn-container">
      <div className="learn-header">
        <h2>Learning Academy</h2>
        <p>Enhance your skills with accessible, community-led courses.</p>
      </div>

      <div className="learn-grid">
        {MOCK_COURSES.map(course => (
          <div key={course.id} className="course-card">
            <div className="course-image">
              {course.emoji}
              <div className="course-duration">
                <Clock size={12} />
                {course.duration}
              </div>
            </div>
            
            <div className="course-content">
              <span className="course-level">{course.level}</span>
              <h3 className="course-title">{course.title}</h3>
              <p className="course-instructor">by {course.instructor}</p>
              
              <div className="course-meta">
                <div className="course-rating">
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <span>{course.rating}</span>
                  <span style={{ color: '#94A3B8', fontWeight: 400 }}>({course.reviews})</span>
                </div>
                <button className="start-btn">
                  <Play size={14} fill="currentColor" /> Start
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LearnPage;
