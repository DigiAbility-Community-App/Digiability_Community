import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Send, MoreVertical, Check, CheckCheck, Info, Trash2, Volume2, Image as ImageIcon, Mic, Square, X, Lock } from 'lucide-react';
import { MessageMedia } from './MessageMedia';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { chatService } from '../../services/chatService';
import { sendSocketMessage } from '../../services/socketService';
import { format } from 'date-fns';
import clsx from 'clsx';
import GroupInfoPanel from './GroupInfoPanel';
import './ChatView.css';

// Format a presence "last seen" ISO timestamp into a short relative string.
function formatLastSeen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

interface ContextMenu {
  messageId: string;
  clientMessageId: string;
  isMine: boolean;
  canDeleteEveryone: boolean;
  content: string;
  msgType: string;
  senderId: string;
  x: number;
  y: number;
}

const ChatView = () => {
  const { conversationId } = useParams();
  const user = useAuthStore(s => s.user);
  const conversation = useChatStore(s => conversationId ? s.conversations[conversationId] : null);
  const messages = useChatStore(s => conversationId ? s.messages[conversationId] || [] : []);
  const removeMessage = useChatStore(s => s.removeMessage);
  const presenceMap = useChatStore(s => s.presence);
  const typingIds = useChatStore(s => (conversationId ? s.typing[conversationId] : undefined));
  const updatePresence = useChatStore(s => s.updatePresence);

  const [inputText, setInputText] = useState('');
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDmMenu, setShowDmMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingActiveRef = useRef(false);

  // Emit typing.start while the user types; auto-stop after idle.
  const emitTypingStop = () => {
    if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      sendSocketMessage('typing.stop', { conversationId });
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
  };
  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      if (!isTypingActiveRef.current) {
        isTypingActiveRef.current = true;
        sendSocketMessage('typing.start', { conversationId });
      }
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingStopTimer.current = setTimeout(emitTypingStop, 2500);
    } else {
      emitTypingStop();
    }
  };

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

  // Presence isn't pushed over WS — fetch the DM peer's presence on open + refresh.
  useEffect(() => {
    if (!conversationId) return;
    const conv = useChatStore.getState().conversations[conversationId];
    if (conv?.type !== 'DIRECT') return;
    const peer = conv.participants?.find(p => p.userId !== user?.id)?.userId;
    if (!peer) return;
    let active = true;
    const fetchP = async () => {
      const p = await chatService.getPresence(peer);
      if (active && p) updatePresence(peer, p.status, p.lastSeen);
    };
    fetchP();
    const iv = setInterval(fetchP, 30000);
    return () => { active = false; clearInterval(iv); };
  }, [conversationId, user?.id, updatePresence]);

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
    emitTypingStop();
  };

  // Optimistically insert a media message, then fire the real send.
  const sendMedia = (type: 'IMAGE' | 'AUDIO', url: string, metadata: Record<string, unknown>) => {
    if (!conversationId) return;
    const clientMsgId = crypto.randomUUID();
    const metaStr = JSON.stringify(metadata);
    useChatStore.getState().addMessage({
      id: clientMsgId,
      clientMessageId: clientMsgId,
      conversationId,
      senderId: user?.id || '',
      content: url,
      type,
      metadata: metaStr,
      status: 'sending' as const,
      createdAt: new Date().toISOString(),
    });
    sendSocketMessage('message.send', {
      clientMessageId: clientMsgId,
      conversationId,
      content: url,
      type,
      metadata: metaStr,
    });
  };

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const altText = window.prompt('Describe this image (for screen readers):', '') || '';
    setIsUploading(true);
    try {
      const { url } = await chatService.uploadMedia(file, 'image', file.name);
      sendMedia('IMAGE', url, { altText: altText.trim() });
    } catch (err) {
      console.error('image upload failed', err);
      alert('Could not send image.');
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationMs = Date.now() - recordStartRef.current;
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (durationMs < 500 || blob.size === 0) return;
        setIsUploading(true);
        try {
          const { url } = await chatService.uploadMedia(blob, 'audio', `voice-${Date.now()}.webm`);
          sendMedia('AUDIO', url, { durationMs });
        } catch (err) {
          console.error('voice upload failed', err);
          alert('Could not send voice note.');
        } finally {
          setIsUploading(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recordStartRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('mic access failed', err);
      alert('Microphone access is required to record a voice note.');
    }
  };

  const stopRecording = (send: boolean) => {
    const recorder = mediaRecorderRef.current;
    setIsRecording(false);
    if (!recorder) return;
    if (!send) recorder.onstop = () => recorder.stream.getTracks().forEach((t) => t.stop());
    recorder.stop();
    mediaRecorderRef.current = null;
  };

  const handleReadAloud = () => {
    if (!contextMenu) return;
    if ('speechSynthesis' in window && contextMenu.content) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(contextMenu.content));
    }
    setContextMenu(null);
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    msg: { id: string; clientMessageId: string; senderId: string; content: string; type: string }
  ) => {
    e.preventDefault();
    const myRole = conversation?.participants?.find(p => p.userId === user?.id)?.role;
    const isAdmin = myRole === 'OWNER' || myRole === 'ADMIN' || myRole === 'CAREGIVER';
    const mine = msg.senderId === user?.id;
    setContextMenu({
      messageId: msg.id,
      clientMessageId: msg.clientMessageId,
      isMine: mine,
      canDeleteEveryone: mine || isAdmin,
      content: msg.content,
      msgType: msg.type,
      senderId: msg.senderId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // ── Block / Report (safety) ───────────────────────────────
  const otherUserId = conversation?.participants?.find(p => p.userId !== user?.id)?.userId;
  const peerPresence = otherUserId ? presenceMap[otherUserId] : undefined;
  const someoneTyping = (typingIds || []).some(id => id !== user?.id);

  const handleReportMessage = () => {
    if (!contextMenu) return;
    const reason = window.prompt('Why are you reporting this message?', '');
    setContextMenu(null);
    if (!reason?.trim()) return;
    chatService
      .reportUser({
        reportedUserId: contextMenu.senderId,
        conversationId,
        messageId: contextMenu.messageId,
        reason: reason.trim(),
      })
      .then(() => alert('Report submitted. Our team will review this.'))
      .catch(() => alert('Could not submit the report.'));
  };

  const handleBlockUser = () => {
    setShowDmMenu(false);
    if (!otherUserId) return;
    if (!window.confirm(`Block ${title}? They won't be able to message you, and you won't be able to message them.`)) return;
    chatService
      .blockUser(otherUserId)
      .then(() => alert(`You have blocked ${title}.`))
      .catch(() => alert('Could not block this user.'));
  };

  const handleReportUser = () => {
    setShowDmMenu(false);
    if (!otherUserId) return;
    const reason = window.prompt(`Why are you reporting ${title}?`, '');
    if (!reason?.trim()) return;
    chatService
      .reportUser({ reportedUserId: otherUserId, conversationId, reason: reason.trim() })
      .then(() => alert('Report submitted. Our team will review this.'))
      .catch(() => alert('Could not submit the report.'));
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
                  : someoneTyping
                  ? 'typing…'
                  : peerPresence?.status === 'online'
                  ? 'Online'
                  : peerPresence?.lastSeen
                  ? `Last seen ${formatLastSeen(peerPresence.lastSeen)}`
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
          {conversation.type === 'DIRECT' && (
            <div className="dm-menu-wrap">
              <button
                className="icon-btn"
                onClick={() => setShowDmMenu(v => !v)}
                aria-label="More options"
                title="More options"
              >
                <MoreVertical size={20} />
              </button>
              {showDmMenu && (
                <div className="dm-menu">
                  <button className="dm-menu-item" onClick={handleReportUser}>Report user</button>
                  <button className="dm-menu-item dm-menu-danger" onClick={handleBlockUser}>Block user</button>
                </div>
              )}
            </div>
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
                onContextMenu={(e) => handleContextMenu(e, msg as any)}
              >
                <div className="message-bubble">
                  {!isMine && conversation.type === 'GROUP' && (
                    <div className="message-sender-name">
                      {senderName}
                    </div>
                  )}
                  {msg.type === 'IMAGE' || msg.type === 'AUDIO' ? (
                    <MessageMedia message={msg} isMine={isMine} />
                  ) : (
                    <div className="message-content">{msg.content}</div>
                  )}
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
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePickImage}
            />
            <button
              type="button"
              className="composer-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isRecording}
              aria-label="Share an image"
              title="Share an image"
            >
              <ImageIcon size={18} />
            </button>
            {isRecording ? (
              <>
                <span className="recording-indicator" aria-live="polite">● Recording…</span>
                <button
                  type="button"
                  className="composer-icon-btn recording-cancel"
                  onClick={() => stopRecording(false)}
                  aria-label="Cancel recording"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
                <button
                  type="button"
                  className="send-btn"
                  onClick={() => stopRecording(true)}
                  aria-label="Send voice note"
                  title="Send voice note"
                >
                  <Square size={18} />
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  className="composer-input"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                />
                {inputText.trim() ? (
                  <button
                    type="submit"
                    className="send-btn"
                    aria-label="Send message"
                  >
                    <Send size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="composer-icon-btn"
                    onClick={startRecording}
                    disabled={isUploading}
                    aria-label="Record a voice note"
                    title="Record a voice note"
                  >
                    <Mic size={18} />
                  </button>
                )}
              </>
            )}
          </form>
        ) : (
          <div className="restricted-banner">
            <Lock size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
            Only admins can send messages
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
          {contextMenu.msgType === 'TEXT' && contextMenu.content && (
            <button className="msg-context-item" onClick={handleReadAloud}>
              <Volume2 size={14} />
              Read aloud
            </button>
          )}
          {!contextMenu.isMine && (
            <button className="msg-context-item" onClick={handleReportMessage}>
              <MoreVertical size={14} />
              Report message
            </button>
          )}
          <button className="msg-context-item" onClick={handleDeleteForMe}>
            <Trash2 size={14} />
            Delete for Me
          </button>
          {contextMenu.canDeleteEveryone && (
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
