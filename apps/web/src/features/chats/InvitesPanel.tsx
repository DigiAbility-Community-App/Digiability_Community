import React, { useEffect, useState } from 'react';
import { X, Check, XCircle } from 'lucide-react';
import { useChatStore, GroupInvite } from '../../store/chatStore';
import { chatService } from '../../services/chatService';
import { useNavigate } from 'react-router-dom';
import './InvitesPanel.css';

interface Props {
  onClose: () => void;
}

const InvitesPanel: React.FC<Props> = ({ onClose }) => {
  const pendingInvites = useChatStore((s) => s.pendingInvites);
  const removePendingInvite = useChatStore((s) => s.removePendingInvite);
  const setConversations = useChatStore((s) => s.setConversations);
  const [responding, setResponding] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    chatService.getPendingInvites().then((invites) => {
      useChatStore.getState().setPendingInvites(invites);
    }).catch(console.error);
  }, []);

  const handleRespond = async (invite: GroupInvite, action: 'accept' | 'decline') => {
    setResponding(invite.id);
    try {
      await chatService.respondToInvite(invite.id, action);
      removePendingInvite(invite.id);
      if (action === 'accept') {
        const convos = await chatService.getConversations();
        setConversations(convos);
        const subType = invite.conversation?.subType;
        const base = subType === 'CARE_CIRCLE' ? '/app/chats' : '/app/groups';
        navigate(`${base}/${invite.conversationId}`);
        onClose();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to respond to invite');
    } finally {
      setResponding(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ip-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ip-header">
          <h3 className="ip-title">Pending Invites</h3>
          <button className="ip-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="ip-body">
          {pendingInvites.length === 0 ? (
            <div className="ip-empty">
              <p>No pending invites</p>
              <span>When someone invites you to a group, it will appear here.</span>
            </div>
          ) : (
            pendingInvites.map((invite) => {
              const groupName = invite.conversation?.name || 'Unknown Group';
              const isCareCircle = invite.conversation?.subType === 'CARE_CIRCLE';
              const isResponding = responding === invite.id;

              return (
                <div key={invite.id} className="ip-invite-card">
                  <div className="ip-invite-icon">{isCareCircle ? '🦽' : '👥'}</div>
                  <div className="ip-invite-info">
                    <span className="ip-invite-name">{groupName}</span>
                    <span className="ip-invite-role">
                      Invited as <strong>{invite.role.charAt(0) + invite.role.slice(1).toLowerCase()}</strong>
                    </span>
                    {invite.message && (
                      <span className="ip-invite-message">"{invite.message}"</span>
                    )}
                    <span className="ip-invite-expires">Expires {formatDate(invite.expiresAt)}</span>
                  </div>
                  <div className="ip-invite-actions">
                    <button
                      className="ip-btn ip-btn-accept"
                      disabled={isResponding}
                      onClick={() => handleRespond(invite, 'accept')}
                      aria-label="Accept"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className="ip-btn ip-btn-decline"
                      disabled={isResponding}
                      onClick={() => handleRespond(invite, 'decline')}
                      aria-label="Decline"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default InvitesPanel;
