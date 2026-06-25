import React from 'react';
import { Sparkles } from 'lucide-react';
import './ComingSoon.css';

interface ComingSoonProps {
  title: string;
  description: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ title, description }) => {
  return (
    <div className="coming-soon-container">
      <div className="coming-soon-card">
        <div className="coming-soon-icon">
          <Sparkles size={48} />
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        <button className="btn-primary" style={{ width: 'auto', marginTop: '24px' }}>
          Notify Me
        </button>
      </div>
    </div>
  );
};

export default ComingSoon;
