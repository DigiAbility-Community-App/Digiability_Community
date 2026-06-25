import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams, useLocation } from 'react-router-dom';
import { Edit, Search, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { chatService } from '../../services/chatService';
import NewChatModal from './NewChatModal';
import './ChatsLayout.css';

const ChatsLayout = () => {
  const { conversationId } = useParams();
  const conversations = useChatStore(s => s.conversations);
  const setConversations = useChatStore(s => s.setConversations);
  const currentUser = useAuthStore(s => s.user);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const location = useLocation();
  const isGroupsRoute = location.pathname.includes('/app/groups');

  useEffect(() => {
    chatService.getConversations().then((convos) => {
      setConversations(convos);
    });
  }, [setConversations]);

  const convoList = Object.values(conversations)
    .filter(c => {
      if (isGroupsRoute) {
        return c.type === 'GROUP' && c.subType === 'GENERAL';
      } else {
        return c.type === 'DIRECT' || c.subType === 'CARE_CIRCLE';
      }
    })
    .sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <div className="chats-container">
      {isNewChatModalOpen && (
        <NewChatModal onClose={() => setIsNewChatModalOpen(false)} />
      )}
      {/* Middle Pane: Conversation List */}
      <aside className="chats-sidebar">
        <div className="chats-header">
          <h2>{isGroupsRoute ? 'Groups' : 'Chats'}</h2>
          <div className="chats-actions">
            {!isGroupsRoute && (
              <button className="icon-btn" aria-label="New Chat" onClick={() => setIsNewChatModalOpen(true)}>
                <Edit size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="chats-search">
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search chats..." 
            />
          </div>
        </div>

        <div className="chats-list">
          {convoList.map(convo => {
            let title = convo.name;
            if (!title && convo.type === 'DIRECT') {
              // Extract the other participant's name
              const other = (convo.participants || []).find(p => p.userId !== currentUser?.id);
              title = other?.user?.name || 'Unknown User';
            }

            return (
              <NavLink 
                key={convo.id}
                to={`/app/chats/${convo.id}`}
                className={({ isActive }: { isActive: boolean }) => clsx("chat-item", { active: isActive })}
              >
                <div className="chat-avatar">
                  {convo.avatarUrl ? (
                    <img src={convo.avatarUrl} alt={title} />
                  ) : (
                    <span>{title?.substring(0,2).toUpperCase() || 'CH'}</span>
                  )}
                </div>
                <div className="chat-info">
                  <div className="chat-top-row">
                    <span className="chat-name">{title}</span>
                    {convo.lastMessageAt && (
                      <span className="chat-time">
                        {new Date(convo.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="chat-bottom-row">
                    <span className="chat-preview">
                      {convo.type === 'GROUP' && convo.lastMessage?.senderId && convo.lastMessage.senderId !== currentUser?.id
                        ? `${(convo.participants || []).find(p => p.userId === convo.lastMessage?.senderId)?.user?.name || 'Unknown'}: ` 
                        : ''}
                      {convo.lastMessageText || 'No messages yet'}
                    </span>
                    {convo.unreadCount > 0 && (
                      <span className="unread-badge">{convo.unreadCount}</span>
                    )}
                  </div>
                </div>
              </NavLink>
            );
          })}
        </div>
      </aside>

      {/* Main Pane: Active Chat */}
      <section className="chat-main">
        {conversationId ? (
          <Outlet />
        ) : (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <MessageSquare size={32} />
            </div>
            <h3>Your Messages</h3>
            <p>Select a chat to start messaging.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default ChatsLayout;
