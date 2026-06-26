import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useChatStore, Conversation, ConversationParticipant } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { chatService } from '../../services/chatService';
import './GroupInfoPanel.css';

interface Props {
  conversationId: string;
  onClose: () => void;
}

type RoleOption = 'MEMBER' | 'ADMIN' | 'CAREGIVER' | 'MENTOR' | 'PROFESSIONAL';

const GroupInfoPanel: React.FC<Props> = ({ conversationId, onClose }) => {
  const user = useAuthStore((s) => s.user);
  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const updateConversation = useChatStore((s) => s.updateConversation);

  const [isUpdating, setIsUpdating] = useState(false);
  const [memberMenuOpen, setMemberMenuOpen] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const searchTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (!showAddSearch || addSearch.trim().length < 1) {
      setAddResults([]);
      return;
    }
    if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    searchTimeout.current = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await chatService.searchUsers(addSearch.trim());
        const existingIds = new Set((conversation?.participants || []).map((p) => p.userId));
        setAddResults(results.filter((r) => !existingIds.has(r.id)));
      } catch {
        setAddResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, [addSearch, showAddSearch, conversation?.participants]);

  if (!conversation) return null;

  const isCareCircle = conversation.subType === 'CARE_CIRCLE';
  const myParticipant = conversation.participants?.find((p) => p.userId === user?.id);
  const myRole = myParticipant?.role;
  const isOwner = myRole === 'OWNER';
  const hasAdminRights = isCareCircle
    ? myRole === 'OWNER' || myRole === 'CAREGIVER'
    : myRole === 'OWNER' || myRole === 'ADMIN';
  const canAddMembers = conversation.addMembers === 'ALL_MEMBERS' || hasAdminRights;

  const handleToggleSetting = async (
    setting: 'editGroupInfo' | 'addMembers' | 'sendMessages',
    current?: string
  ) => {
    if (!hasAdminRights) return;
    const newVal = current === 'ALL_MEMBERS' ? 'ADMINS_ONLY' : 'ALL_MEMBERS';
    updateConversation(conversationId, { [setting]: newVal });
    setIsUpdating(true);
    try {
      await chatService.updateGroupSettings(conversationId, { [setting]: newVal });
    } catch {
      updateConversation(conversationId, { [setting]: current });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleApprove = async () => {
    if (!hasAdminRights) return;
    const newVal = !(conversation.approveNewMembers ?? false);
    updateConversation(conversationId, { approveNewMembers: newVal });
    setIsUpdating(true);
    try {
      await chatService.updateGroupSettings(conversationId, { approveNewMembers: newVal });
    } catch {
      updateConversation(conversationId, { approveNewMembers: !newVal });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInvite = async (member: { id: string; name: string }) => {
    try {
      await chatService.sendInvite(conversationId, member.id, 'MEMBER', `Join ${conversation.name}!`);
      setShowAddSearch(false);
      setAddSearch('');
      setAddResults([]);
      alert(`Invite sent to ${member.name}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send invite');
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      await chatService.updateMemberRole(conversationId, memberId, newRole);
      setMemberMenuOpen(null);
      const updated = (conversation.participants || []).map((p) =>
        p.userId === memberId ? { ...p, role: newRole as any } : p
      );
      updateConversation(conversationId, { participants: updated });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to change role');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from the group?`)) return;
    try {
      await chatService.removeMember(conversationId, memberId);
      setMemberMenuOpen(null);
      updateConversation(conversationId, {
        participants: (conversation.participants || []).filter((p) => p.userId !== memberId),
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleTransferOwnership = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Transfer ownership to ${memberName}? You will become an Admin.`)) return;
    try {
      await chatService.transferOwnership(conversationId, memberId);
      setMemberMenuOpen(null);
      alert(`Ownership transferred to ${memberName}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to transfer ownership');
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm(`Leave "${conversation.name}"?`)) return;
    try {
      await chatService.removeMember(conversationId, user!.id);
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to leave group');
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const roleOptions: RoleOption[] = isCareCircle
    ? ['MEMBER', 'CAREGIVER', 'MENTOR', 'PROFESSIONAL']
    : ['MEMBER', 'ADMIN'];

  return (
    <aside className="group-info-panel">
      <div className="gip-header">
        <h3 className="gip-title">Group Info</h3>
        <button className="gip-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <div className="gip-body">
        {/* Profile */}
        <div className="gip-profile">
          <div className="gip-avatar">{isCareCircle ? '🦽' : '👥'}</div>
          <h4 className="gip-name">{conversation.name}</h4>
          <p className="gip-meta">
            {isCareCircle ? 'Care Circle' : 'General Group'} &bull;{' '}
            {(conversation.participants || []).length} members
          </p>
          {conversation.description && (
            <p className="gip-description">{conversation.description}</p>
          )}
        </div>

        {/* Settings */}
        {hasAdminRights && (
          <section className="gip-section">
            <h5 className="gip-section-title">Group Settings</h5>
            <div className="gip-settings-card">
              {[
                { key: 'editGroupInfo' as const, label: 'Edit Group Info', sub: 'Who can edit name & description', val: conversation.editGroupInfo },
                { key: 'addMembers' as const, label: 'Add Members', sub: 'Who can invite new members', val: conversation.addMembers },
                { key: 'sendMessages' as const, label: 'Send Messages', sub: 'Who can send messages', val: conversation.sendMessages },
              ].map(({ key, label, sub, val }, i) => (
                <React.Fragment key={key}>
                  {i > 0 && <div className="gip-divider" />}
                  <div className="gip-setting-row">
                    <div className="gip-setting-info">
                      <span className="gip-setting-label">{label}</span>
                      <span className="gip-setting-sub">{sub}</span>
                    </div>
                    <label className="gip-toggle">
                      <input
                        type="checkbox"
                        checked={val === 'ALL_MEMBERS'}
                        onChange={() => handleToggleSetting(key, val)}
                        disabled={isUpdating}
                      />
                      <span className="gip-toggle-slider" />
                    </label>
                  </div>
                </React.Fragment>
              ))}
              <div className="gip-divider" />
              <div className="gip-setting-row">
                <div className="gip-setting-info">
                  <span className="gip-setting-label">Approve New Members</span>
                  <span className="gip-setting-sub">Admin must approve before joining</span>
                </div>
                <label className="gip-toggle">
                  <input
                    type="checkbox"
                    checked={conversation.approveNewMembers ?? false}
                    onChange={handleToggleApprove}
                    disabled={isUpdating}
                  />
                  <span className="gip-toggle-slider" />
                </label>
              </div>
            </div>
          </section>
        )}

        {/* Members */}
        <section className="gip-section">
          <div className="gip-section-header">
            <h5 className="gip-section-title">Members</h5>
            {canAddMembers && (
              <button className="gip-add-btn" onClick={() => setShowAddSearch(!showAddSearch)}>
                {showAddSearch ? '✕' : '+ Add'}
              </button>
            )}
          </div>

          {showAddSearch && (
            <div className="gip-add-search">
              <input
                type="text"
                className="gip-search-input"
                placeholder="Search by name..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                autoFocus
              />
              {isSearching && <p className="gip-search-hint">Searching...</p>}
              {addResults.map((r) => (
                <div key={r.id} className="gip-search-result" onClick={() => handleInvite(r)}>
                  <div className="gip-member-avatar">{getInitials(r.name)}</div>
                  <div className="gip-member-info">
                    <span className="gip-member-name">{r.name}</span>
                    <span className="gip-member-sub">{r.email}</span>
                  </div>
                  <span className="gip-invite-btn">Invite</span>
                </div>
              ))}
            </div>
          )}

          <div className="gip-members-list">
            {(conversation.participants || []).map((p) => {
              const name = p.user?.name || 'Unknown';
              const isMe = p.userId === user?.id;
              const canAct = hasAdminRights && !isMe && p.role !== 'OWNER';

              return (
                <div key={p.userId} className="gip-member-row">
                  <div className="gip-member-avatar">{getInitials(name)}</div>
                  <div className="gip-member-info">
                    <span className="gip-member-name">
                      {name} {isMe && <span className="gip-you">(you)</span>}
                    </span>
                    {p.role !== 'MEMBER' && (
                      <span className={`gip-role-badge gip-role-${p.role.toLowerCase()}`}>
                        {p.role}
                      </span>
                    )}
                  </div>
                  {canAct && (
                    <div className="gip-member-menu-wrapper">
                      <button
                        className="gip-member-menu-btn"
                        onClick={() => setMemberMenuOpen(memberMenuOpen === p.userId ? null : p.userId)}
                      >
                        <ChevronDown size={16} />
                      </button>
                      {memberMenuOpen === p.userId && (
                        <div className="gip-dropdown">
                          {roleOptions.filter((r) => r !== p.role).map((r) => (
                            <button key={r} className="gip-dropdown-item" onClick={() => handleChangeRole(p.userId, r)}>
                              Set as {r.charAt(0) + r.slice(1).toLowerCase()}
                            </button>
                          ))}
                          {isOwner && (
                            <button
                              className="gip-dropdown-item"
                              onClick={() => handleTransferOwnership(p.userId, name)}
                            >
                              Transfer Ownership
                            </button>
                          )}
                          <div className="gip-dropdown-divider" />
                          <button
                            className="gip-dropdown-item gip-dropdown-danger"
                            onClick={() => handleRemoveMember(p.userId, name)}
                          >
                            Remove from Group
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Leave Group */}
        {!isOwner && (
          <section className="gip-section">
            <button className="gip-leave-btn" onClick={handleLeaveGroup}>
              Leave Group
            </button>
          </section>
        )}
      </div>
    </aside>
  );
};

export default GroupInfoPanel;
