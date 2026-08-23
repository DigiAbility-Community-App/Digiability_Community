import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { chatService } from '../../services/chatService';
import { useNavigate } from 'react-router-dom';
import './NewChatModal.css';

interface UserResult {
  id: string;
  name: string;
  email: string;
}

interface NewChatModalProps {
  onClose: () => void;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch all users on mount so user can see them immediately
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const results = await chatService.searchUsers('');
        setUsers(results);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!searchQuery) return;
    
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await chatService.searchUsers(searchQuery);
        setUsers(results);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleStartChat = async (userId: string) => {
    try {
      const convo = await chatService.createDirectChat(userId);
      onClose();
      navigate(`/app/chats/${convo.id}`);
    } catch (err) {
      console.error('Failed to start chat:', err);
      alert('Failed to start chat. Please try again.');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Chat</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="search-box">
            <Search size={18} color="#999" />
            <input 
              type="text" 
              placeholder="Search by name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="users-list">
            {isLoading && <div className="loading-text">Loading...</div>}
            {!isLoading && users.length === 0 && (
              <div className="empty-text">No members found</div>
            )}
            {!isLoading && users.map(user => (
              <div key={user.id} className="user-item" onClick={() => handleStartChat(user.id)}>
                <div className="user-avatar">
                  {getInitials(user.name)}
                </div>
                <div className="user-details">
                  <span className="user-name">{user.name}</span>
                  <span className="user-email">{user.email}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer" style={{ padding: '16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', background: '#f0ecf5', border: 'none', color: '#666', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;
