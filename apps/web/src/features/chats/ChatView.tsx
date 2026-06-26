import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Send, MoreVertical, Check, CheckCheck, Info, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { chatService } from '../../services/chatService';
import { sendSocketMessage } from '../../services/socketService';
import { format } from 'date-fns';
import clsx from 'clsx';
import GroupInfoPanel from './GroupInfoPanel';
import './ChatView.css';

interface ContextMenu {
  messageId: string;
  clientMessageId: string;
  isMine: boolean;
  x: number;
  y: number;
}

const ChatView = () => {
  const { conversationId } = useParams();
  const user = useAuthStore(s => s.user);
  const conversation = useChatStore(s => conversationId ? s.conversations[conversationId] : null);
  const messages = useChatStore(s => conversationId ? s.messages[conversationId] || [] : []);
  const removeMessage = useChatStore(s => s.removeMessage);

  const [inputText, setInputText] = useState('');
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId && messages.length === 0) {
      chatService.getMessages(conversationId).then((fetchedMsgs) => {
        fetchedMsgs.forEach((m: any) => useChatStore.getState().addMessage(m));
      });
    }
  }, [conversationId, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    if (conversationId && messages.length > 0) {
      const store = useChatStore.getState();
      const conv = store.conversations[conversationId];
      if (conv && conv.unreadCount > 0) {
        store.clearUnreadCount(conversationId);
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

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  if (!conversation || !conversationId) return null;

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

  const handleContextMenu = (e: React.MouseEvent, msg: { id: string; clientMessageId: string; senderId: string }) => {
    e.preventDefault();
    setContextMenu({
      messageId: msg.id,
      clientMessageId: msg.clientMessageId,
      isMine: msg.senderId === user?.id,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleDeleteForMe = () => {
    if (!contextMenu) return;
    sendSocketMessage('message.delete', {
      messageId: contextMenu.messageId,
      conversationId,
      deleteFor: 'me',
    });
    removeMessage(conversationId, contextMenu.messageId);
    setContextMenu(null);
  };

  const handleDeleteForEveryone = () => {
    if (!contextMenu) return;
    sendSocketMessage('message.delete', {
      messageId: contextMenu.messageId,
      conversationId,
      deleteFor: 'everyone',
    });
    removeMessage(conversationId, contextMenu.messageId);
    setContextMenu(null);
  };

  const renderStatus = (status: string) => {
    if (status === 'sending') return <span>...</span>;
    if (status === 'sent') return <Check size={14} />;
    if (status === 'delivered') return <CheckCheck size={14} />;
    if (status === 'read') return <CheckCheck size={14} color="#38bdf8" />;
    return null;
  };

  const myParticipant = conversation.participants?.find(p => p.userId === user?.id);
  const isAdminOrOwner = myParticipant?.role === 'OWNER' || myParticipant?.role === 'ADMIN' || myParticipant?.role === 'CAREGIVER';
  const canSend = conversation.sendMessages === 'ALL_MEMBERS' || (conversation.sendMessages === 'ADMINS_ONLY' && isAdminOrOwner) || !conversation.sendMessages;

  return (
    <div className={clsx('chat-view-outer', { 'has-group-panel': showGroupInfo })}>
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
              <p>
                {conversation.type === 'GROUP'
                  ? `${conversation.participants?.length || 0} members`
                  : ''}
              </p>
            </div>
          </div>
          {conversation.type === 'GROUP' && (
            <button
              className={clsx('icon-btn', { active: showGroupInfo })}
              onClick={() => setShowGroupInfo(!showGroupInfo)}
              aria-label="Group info"
              title="Group info"
            >
              <Info size={20} />
            </button>
          )}
        </header>

        {/* Messages Area */}
        <div className="chat-messages">
          {messages.map(msg => {
            const isMine = msg.senderId === user?.id;
            const senderParticipant = conversation.participants?.find(p => p.userId === msg.senderId);
            const senderName = senderParticipant?.user?.name || 'Unknown User';

            return (
              <div
                key={msg.id}
                className={clsx('message-row', { 'is-mine': isMine, 'is-other': !isMine })}
                onContextMenu={(e) => handleContextMenu(e, msg)}
              >
                <div className="message-bubble">
                  {!isMine && conversation.type === 'GROUP' && (
                    <div className="message-sender-name">
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

      {/* Right Panel: Group Info */}
      {showGroupInfo && conversation.type === 'GROUP' && (
        <GroupInfoPanel
          conversationId={conversationId}
          onClose={() => setShowGroupInfo(false)}
        />
      )}

      {/* Message Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="msg-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="msg-context-item" onClick={handleDeleteForMe}>
            <Trash2 size={14} />
            Delete for Me
          </button>
          {contextMenu.isMine && (
            <button className="msg-context-item msg-context-danger" onClick={handleDeleteForEveryone}>
              <Trash2 size={14} />
              Delete for Everyone
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatView;
