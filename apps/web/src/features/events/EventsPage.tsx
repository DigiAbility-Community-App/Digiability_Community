import { useState, useEffect } from "react";
import { Calendar, MapPin, Clock, Users } from "lucide-react";
import { apiClient } from "../../services/apiClient";
import "./EventsPage.css";

interface EventModel {
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

const EventsPage = () => {
  const [events, setEvents] = useState<EventModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await apiClient.get("/api/events");
        setEvents(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getEventFallbackEmoji = (category: string) => {
    const map: Record<string, string> = {
      workshop: "🎓",
      meetup: "👥",
      sports: "🏃",
      support: "🤝",
    };
    return map[category.toLowerCase()] || "📅";
  };

  if (loading) {
    return (
      <div className="events-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p>Loading events...</p>
      </div>
    );
  }

  return (
    <div className="events-container">
      <div className="events-header">
        <h2>Local Events & Meetups</h2>
        <p>Discover accessible events, workshops, and community gatherings near you</p>
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <h3>No Upcoming Events</h3>
          <p>Check back later for new accessible events in your area.</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map((evt) => (
            <div key={evt.id} className="event-card">
              <div 
                className="event-image" 
                style={evt.image ? { backgroundImage: `url(${evt.image})` } : {}}
              >
                {!evt.image && getEventFallbackEmoji(evt.category)}
                <span className="event-category-badge">{evt.category.toUpperCase()}</span>
              </div>
              
              <div className="event-content">
                <h3 className="event-title">{evt.title}</h3>
                
                <div className="event-details">
                  <div className="event-detail-item">
                    <Calendar size={16} />
                    <span>{formatDate(evt.date)}</span>
                  </div>
                  {evt.time && (
                    <div className="event-detail-item">
                      <Clock size={16} />
                      <span>{evt.time}</span>
                    </div>
                  )}
                  <div className="event-detail-item">
                    <MapPin size={16} />
                    <span>{evt.location}</span>
                  </div>
                </div>

                <div className="event-footer">
                  <span className={`spots-text ${evt.spots === 0 ? 'full' : ''}`}>
                    {evt.spots > 0 ? `${evt.spots} spots left` : 'Fully Booked'}
                  </span>
                  <button 
                    className="register-btn"
                    disabled={evt.spots === 0}
                    onClick={() => {
                      if (evt.externalUrl) {
                        window.open(evt.externalUrl, '_blank');
                      } else {
                        alert("Registration logic would go here!");
                      }
                    }}
                  >
                    {evt.buttonType || "Register Now"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsPage;
