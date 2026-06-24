import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Send, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { chatService } from '../../services/chatService';
import { sendSocketMessage } from '../../services/socketService';
import { format } from 'date-fns';
import clsx from 'clsx';
import './ChatView.css';

const ChatView = () => {
  const { conversationId } = useParams();
  const user = useAuthStore(s => s.user);
  const conversation = useChatStore(s => conversationId ? s.conversations[conversationId] : null);
  const messages = useChatStore(s => conversationId ? s.messages[conversationId] || [] : []);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId && messages.length === 0) {
      chatService.getMessages(conversationId).then((fetchedMsgs) => {
        // Initialize messages via store logic if needed, or dispatch a SET_MESSAGES
        fetchedMsgs.forEach((m: any) => useChatStore.getState().addMessage(m));
      });
    }
  }, [conversationId, messages.length]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Handle read state
    if (conversationId && messages.length > 0) {
      const store = useChatStore.getState();
      const conv = store.conversations[conversationId];
      if (conv && conv.unreadCount > 0) {
        store.clearUnreadCount(conversationId);
        
        // Find the last message that is not ours
        const otherMessages = [...messages].reverse().filter(m => m.senderId !== user?.id);
        if (otherMessages.length > 0) {
          sendSocketMessage('message.read', {
            messageId: otherMessages[0].id,
            conversationId,
          });
        }
      }
    }
  }, [messages, conversationId, user?.id]);

  if (!conversation || !conversationId) return null;

  // Determine chat title
  let title = conversation.name;
  if (!title && conversation.type === 'DIRECT') {
    const other = conversation.participants?.find(p => p.userId !== user?.id);
    title = other?.user?.name || 'Unknown User';
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const clientMsgId = crypto.randomUUID();
    const newMsg = {
      id: clientMsgId,
      clientMessageId: clientMsgId,
      conversationId,
      senderId: user?.id || '',
      content: inputText.trim(),
      type: 'TEXT',
      status: 'sending' as const,
      createdAt: new Date().toISOString(),
    };

    useChatStore.getState().addMessage(newMsg);
    
    sendSocketMessage('message.send', {
      clientMessageId: clientMsgId,
      conversationId,
      content: inputText.trim(),
      type: 'TEXT',
    });

    setInputText('');
  };

  const renderStatus = (status: string) => {
    if (status === 'sending') return <span>...</span>;
    if (status === 'sent') return <Check size={14} />;
    if (status === 'delivered') return <CheckCheck size={14} />;
    if (status === 'read') return <CheckCheck size={14} color="#38bdf8" />;
    return null;
  };

  const myParticipant = conversation.participants?.find(p => p.userId === user?.id);
  const canSend = conversation.sendMessages === 'ALL_MEMBERS' || 
                 (conversation.sendMessages === 'ADMINS_ONLY' && (myParticipant?.role === 'OWNER' || myParticipant?.role === 'ADMIN' || myParticipant?.role === 'CAREGIVER'));

  return (
    <div className="chat-view-container">
      {/* Header */}
      <header className="chat-view-header">
        <div className="chat-view-header-info">
          <div className="header-avatar">
            {conversation.avatarUrl ? (
              <img src={conversation.avatarUrl} alt={title} />
            ) : (
              <span>{title?.substring(0, 2).toUpperCase() || 'CH'}</span>
            )}
          </div>
          <div className="header-title">
            <h3>{title}</h3>
            <p>{conversation.type === 'GROUP' ? `${conversation.participants?.length || 0} members` : 'Offline'}</p>
          </div>
        </div>
        <button className="icon-btn">
          <MoreVertical size={20} />
        </button>
      </header>

      {/* Messages Area */}
      <div className="chat-messages">
        {messages.map(msg => {
          const isMine = msg.senderId === user?.id;
          const senderParticipant = conversation.participants?.find(p => p.userId === msg.senderId);
          const senderName = senderParticipant?.user?.name || 'Unknown User';

          return (
            <div key={msg.id} className={clsx("message-row", { "is-mine": isMine, "is-other": !isMine })}>
              <div className="message-bubble">
                {!isMine && (
                  <div className="message-sender-name" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary-dark)', marginBottom: '4px' }}>
                    {senderName}
                  </div>
                )}
                <div className="message-content">{msg.content}</div>
                <div className="message-footer">
                  <span>{format(new Date(msg.createdAt), 'HH:mm')}</span>
                  {isMine && <span className="msg-status">{renderStatus(msg.status)}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      {canSend ? (
        <form className="chat-composer" onSubmit={handleSend}>
          <input
            type="text"
            className="composer-input"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button 
            type="submit" 
            className="send-btn" 
            disabled={!inputText.trim()}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>
      ) : (
        <div className="restricted-banner">
          🔒 Only admins can send messages
        </div>
      )}
    </div>
  );
};

export default ChatView;
