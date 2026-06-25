import { useState } from "react";
import { MapPin, Phone, Star, ShieldCheck, Clock } from "lucide-react";
import "./ServicesPage.css";

// Rich Mock Data for Services
const MOCK_SERVICES = [
  {
    id: "srv-1",
    name: "Dr. Sarah Jenkins",
    type: "Occupational Therapist",
    category: "therapists",
    logo: "👩‍⚕️",
    description: "Specialized in pediatric occupational therapy and sensory integration for children with autism and developmental delays.",
    location: "Downtown Clinic & Home Visits",
    rating: 4.9,
    reviews: 124,
    verified: true,
    price: "$80 - $150 / session",
    availability: "Next available: Tomorrow"
  },
  {
    id: "srv-2",
    name: "Mobility Solutions Inc.",
    type: "Equipment Vendor",
    category: "equipment",
    logo: "🦽",
    description: "Rental and purchase of wheelchairs, walkers, and custom-fitted seating systems. Same-day delivery available.",
    location: "Westside Hub",
    rating: 4.7,
    reviews: 89,
    verified: true,
    price: "Varies by equipment",
    availability: "Open 9AM - 6PM"
  },
  {
    id: "srv-3",
    name: "CareBridge Support",
    type: "Respite Care",
    category: "care",
    logo: "🤝",
    description: "Professional respite care providers offering short-term relief for primary caregivers. Background-checked and certified.",
    location: "All City Areas",
    rating: 4.8,
    reviews: 210,
    verified: true,
    price: "$25 - $40 / hour",
    availability: "24/7 Availability"
  },
  {
    id: "srv-4",
    name: "Legal Advocates for Disability",
    type: "Legal Services",
    category: "legal",
    logo: "⚖️",
    description: "Assistance with disability claims, appeals, and educational advocacy (IEP meetings).",
    location: "City Center",
    rating: 4.6,
    reviews: 45,
    verified: true,
    price: "Free consultation",
    availability: "By appointment"
  },
  {
    id: "srv-5",
    name: "Accessible Transit Co.",
    type: "Transportation",
    category: "transport",
    logo: "🚐",
    description: "Wheelchair-accessible vans and specialized transport services for medical appointments and daily commuting.",
    location: "Metro Area",
    rating: 4.9,
    reviews: 312,
    verified: true,
    price: "$2.50 / mile",
    availability: "Book 24h in advance"
  }
];

const CATEGORIES = [
  { id: "all", label: "All Services" },
  { id: "therapists", label: "Therapists" },
  { id: "equipment", label: "Equipment & Aids" },
  { id: "care", label: "Respite & Care" },
  { id: "legal", label: "Legal Support" },
  { id: "transport", label: "Transportation" },
];

const ServicesPage = () => {
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredServices = MOCK_SERVICES.filter(
    s => activeCategory === "all" || s.category === activeCategory
  );

  return (
    <div className="services-container">
      <div className="services-header">
        <h2>Professional Services Directory</h2>
        <p>Find verified healthcare providers, legal advocates, and essential services near you.</p>
      </div>

      <div className="categories-bar">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`service-category-btn ${activeCategory === cat.id ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="services-grid">
        {filteredServices.map(service => (
          <div key={service.id} className="service-card">
            <div className="service-header">
              <div className="provider-logo">{service.logo}</div>
              <div className="provider-info">
                <h3>
                  {service.name}
                  {service.verified && (
                    <ShieldCheck size={16} color="#059669" style={{ marginLeft: 6, display: 'inline' }} />
                  )}
                </h3>
                <span className="provider-type">{service.type}</span>
              </div>
            </div>

            <p className="service-desc">{service.description}</p>

            <div className="service-meta">
              <div className="meta-item">
                <MapPin size={14} />
                <span>{service.location}</span>
              </div>
              <div className="meta-item">
                <Clock size={14} />
                <span>{service.availability}</span>
              </div>
              <div className="meta-item">
                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                <span style={{ color: '#1A1B20', fontWeight: 600 }}>{service.rating}</span>
                <span>({service.reviews} reviews)</span>
              </div>
            </div>

            <div className="service-footer">
              <span className="service-price">{service.price}</span>
              <button 
                className="contact-btn"
                onClick={() => alert(`Contacting ${service.name}...`)}
              >
                <Phone size={14} /> Contact
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServicesPage;
