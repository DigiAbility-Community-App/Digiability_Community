import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Users, Accessibility, SquarePen, Bell, BellOff, Plus } from 'lucide-react';
import { useChatStore, type Conversation, type ConversationParticipant } from '../../store/chatStore';
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

  // Edit group info form
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isSavingInfo, setIsSavingInfo] = useState(false);

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

  // ── Join requests (admin approval) ───────────────────────────
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAdminRights) return;
    chatService
      .getGroupInvites(conversationId)
      .then((invites) => setPendingRequests(invites.filter((i: any) => i.status === 'AWAITING_APPROVAL')))
      .catch((err) => console.error('Failed to load join requests', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, hasAdminRights]);

  const handleRespondToRequest = async (inviteId: string, approve: boolean) => {
    setProcessingRequestId(inviteId);
    try {
      await chatService.approveJoinRequest(inviteId, approve);
      setPendingRequests((prev) => prev.filter((r) => r.id !== inviteId));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not process the request.');
    } finally {
      setProcessingRequestId(null);
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

  const canEditInfo = conversation.editGroupInfo === 'ALL_MEMBERS' || hasAdminRights;

  const openEditInfo = () => {
    setEditName(conversation.name || '');
    setEditDesc(conversation.description || '');
    setIsEditingInfo(true);
  };

  const handleSaveInfo = async () => {
    const name = editName.trim();
    if (!name) { alert('Group name cannot be empty'); return; }
    setIsSavingInfo(true);
    const prev = { name: conversation.name, description: conversation.description };
    updateConversation(conversationId, { name, description: editDesc.trim() });
    try {
      await chatService.updateGroupInfo(conversationId, { name, description: editDesc.trim() });
      setIsEditingInfo(false);
    } catch (err: any) {
      updateConversation(conversationId, prev);
      alert(err?.response?.data?.message || 'Failed to update group info');
    } finally {
      setIsSavingInfo(false);
    }
  };

  const isMuted = myParticipant?.isMuted ?? false;
  const handleToggleMute = async () => {
    const newValue = !isMuted;
    const updated = (conversation.participants || []).map((p) =>
      p.userId === user?.id ? { ...p, isMuted: newValue } : p
    );
    updateConversation(conversationId, { participants: updated });
    try {
      await chatService.muteConversation(conversationId, newValue);
    } catch {
      updateConversation(conversationId, { participants: conversation.participants });
      alert('Failed to update mute setting');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Permanently delete "${conversation.name}"? This removes it for all members and cannot be undone.`)) return;
    try {
      await chatService.deleteGroup(conversationId);
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete group');
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
          <div className="gip-avatar">{isCareCircle ? <Accessibility size={30} /> : <Users size={30} />}</div>

          {isEditingInfo ? (
            <div className="gip-edit-form">
              <input
                className="gip-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Group name"
                maxLength={100}
                autoFocus
              />
              <textarea
                className="gip-edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Add a description (optional)"
                maxLength={500}
                rows={2}
              />
              <div className="gip-edit-actions">
                <button className="gip-edit-cancel" onClick={() => setIsEditingInfo(false)} disabled={isSavingInfo}>Cancel</button>
                <button className="gip-edit-save" onClick={handleSaveInfo} disabled={isSavingInfo}>
                  {isSavingInfo ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="gip-name-row">
                <h4 className="gip-name">{conversation.name}</h4>
                {canEditInfo && (
                  <button className="gip-edit-icon" onClick={openEditInfo} title="Edit group info"><SquarePen size={16} /></button>
                )}
              </div>
              <p className="gip-meta">
                {isCareCircle ? 'Care Circle' : 'General Group'} &bull;{' '}
                {(conversation.participants || []).length} members
              </p>
              {conversation.description && (
                <p className="gip-description">{conversation.description}</p>
              )}
            </>
          )}

          {/* Mute toggle — all members */}
          <button className="gip-mute-btn" onClick={handleToggleMute}>
            {isMuted ? <Bell size={15} /> : <BellOff size={15} />}
            {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
          </button>
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

        {/* Pending Join Requests (admins only) */}
        {hasAdminRights && pendingRequests.length > 0 && (
          <section className="gip-section">
            <h5 className="gip-section-title">Pending Requests ({pendingRequests.length})</h5>
            <div className="gip-members-list">
              {pendingRequests.map((req) => (
                <div key={req.id} className="gip-request-row">
                  <div className="gip-member-avatar">
                    {(req.inviteeName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="gip-member-info">
                    <span className="gip-member-name">{req.inviteeName}</span>
                    <span className="gip-member-sub">wants to join</span>
                  </div>
                  <div className="gip-request-actions">
                    <button
                      className="gip-request-reject"
                      disabled={processingRequestId === req.id}
                      onClick={() => handleRespondToRequest(req.id, false)}
                    >
                      Reject
                    </button>
                    <button
                      className="gip-request-approve"
                      disabled={processingRequestId === req.id}
                      onClick={() => handleRespondToRequest(req.id, true)}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Members */}
        <section className="gip-section">
          <div className="gip-section-header">
            <h5 className="gip-section-title">Members</h5>
            {canAddMembers && (
              <button className="gip-add-btn" onClick={() => setShowAddSearch(!showAddSearch)}>
                {showAddSearch ? <X size={15} /> : <><Plus size={15} /> Add</>}
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

        {/* Leave (non-owner) / Delete (owner) */}
        <section className="gip-section">
          {isOwner ? (
            <button className="gip-delete-btn" onClick={handleDeleteGroup}>
              Delete Group
            </button>
          ) : (
            <button className="gip-leave-btn" onClick={handleLeaveGroup}>
              Leave Group
            </button>
          )}
        </section>
      </div>
    </aside>
  );
};

export default GroupInfoPanel;
