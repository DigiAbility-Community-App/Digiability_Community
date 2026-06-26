import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams, useLocation } from 'react-router-dom';
import { Edit, Search, MessageSquare, Users, Bell, HeartHandshake } from 'lucide-react';
import clsx from 'clsx';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { chatService } from '../../services/chatService';
import NewChatModal from './NewChatModal';
import CreateGroupModal from './CreateGroupModal';
import InvitesPanel from './InvitesPanel';
import './ChatsLayout.css';

type Section = 'chats' | 'groups' | 'care-circles';

const ChatsLayout = () => {
  const { conversationId } = useParams();
  const conversations = useChatStore(s => s.conversations);
  const setConversations = useChatStore(s => s.setConversations);
  const pendingInvites = useChatStore(s => s.pendingInvites);
  const currentUser = useAuthStore(s => s.user);

  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isInvitesPanelOpen, setIsInvitesPanelOpen] = useState(false);

  const location = useLocation();
  const section: Section = location.pathname.includes('/app/groups')
    ? 'groups'
    : location.pathname.includes('/app/care-circles')
      ? 'care-circles'
      : 'chats';

  const isGroupsRoute      = section === 'groups';
  const isCareCirclesRoute = section === 'care-circles';
  const isChatsRoute       = section === 'chats';

  useEffect(() => {
    chatService.getConversations().then(convos => setConversations(convos));
    chatService.getPendingInvites().then(invites => {
      useChatStore.getState().setPendingInvites(invites);
    }).catch(console.error);
  }, [setConversations, section]); // re-fetch when switching sections

  // Filter conversations based on active section
  const convoList = Object.values(conversations)
    .filter(c => {
      if (isGroupsRoute)      return c.type === 'GROUP' && c.subType === 'GENERAL';
      if (isCareCirclesRoute) return c.type === 'GROUP' && c.subType === 'CARE_CIRCLE';
      return c.type === 'DIRECT'; // chats = DMs only
    })
    .sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

  const sectionTitle = isGroupsRoute ? 'Groups' : isCareCirclesRoute ? 'Care Circles' : 'Chats';
  const navBase      = isGroupsRoute ? '/app/groups' : isCareCirclesRoute ? '/app/care-circles' : '/app/chats';

  const createGroupType = isGroupsRoute ? 'GENERAL' : 'CARE_CIRCLE';

  return (
    <div className="chats-container">
      {isNewChatModalOpen && (
        <NewChatModal onClose={() => setIsNewChatModalOpen(false)} />
      )}
      {isCreateGroupOpen && (
        <CreateGroupModal
          initialType={createGroupType}
          onClose={() => setIsCreateGroupOpen(false)}
        />
      )}
      {isInvitesPanelOpen && (
        <InvitesPanel onClose={() => setIsInvitesPanelOpen(false)} />
      )}

      {/* Sidebar: conversation list */}
      <aside className="chats-sidebar">
        <div className="chats-header">
          <h2>{sectionTitle}</h2>
          <div className="chats-actions">
            {/* Invite bell with badge */}
            <button
              className="icon-btn chats-invite-btn"
              aria-label="Pending invites"
              onClick={() => setIsInvitesPanelOpen(true)}
              title="Pending invites"
            >
              <Bell size={18} />
              {pendingInvites.length > 0 && (
                <span className="invite-count-badge">{pendingInvites.length}</span>
              )}
            </button>

            {/* Section-appropriate action buttons */}
            {isChatsRoute && (
              <button className="icon-btn" aria-label="New Chat" onClick={() => setIsNewChatModalOpen(true)} title="New Chat">
                <Edit size={18} />
              </button>
            )}
            {isGroupsRoute && (
              <button className="icon-btn" aria-label="New Group" onClick={() => setIsCreateGroupOpen(true)} title="New Group">
                <Users size={18} />
              </button>
            )}
            {isCareCirclesRoute && (
              <button className="icon-btn" aria-label="New Care Circle" onClick={() => setIsCreateGroupOpen(true)} title="New Care Circle">
                <HeartHandshake size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="chats-search">
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input type="text" className="search-input" placeholder={`Search ${sectionTitle.toLowerCase()}...`} />
          </div>
        </div>

        <div className="chats-list">
          {convoList.map(convo => {
            let title = convo.name;
            if (!title && convo.type === 'DIRECT') {
              const other = (convo.participants || []).find(p => p.userId !== currentUser?.id);
              title = other?.user?.name || 'Unknown User';
            }

            return (
              <NavLink
                key={convo.id}
                to={`${navBase}/${convo.id}`}
                className={({ isActive }) => clsx('chat-item', { active: isActive })}
              >
                <div className="chat-avatar">
                  {convo.avatarUrl ? (
                    <img src={convo.avatarUrl} alt={title} />
                  ) : (
                    <span>{title?.substring(0, 2).toUpperCase() || 'CH'}</span>
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

      {/* Main pane */}
      <section className="chat-main">
        {conversationId ? (
          <Outlet />
        ) : (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              {isCareCirclesRoute ? <HeartHandshake size={32} /> : <MessageSquare size={32} />}
            </div>
            <h3>{sectionTitle}</h3>
            <p>Select a conversation to get started.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default ChatsLayout;
