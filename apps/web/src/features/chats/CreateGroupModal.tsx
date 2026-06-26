import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import { chatService } from '../../services/chatService';
import { useChatStore } from '../../store/chatStore';
import { useNavigate } from 'react-router-dom';
import './CreateGroupModal.css';

type GroupType = 'GENERAL' | 'CARE_CIRCLE';
type CareRole = 'MEMBER' | 'CAREGIVER' | 'MENTOR' | 'PROFESSIONAL';

interface UserResult {
  id: string;
  name: string;
  email: string;
}

interface SelectedMember extends UserResult {
  role: CareRole;
}

interface Props {
  initialType?: GroupType;
  onClose: () => void;
}

const CARE_ROLES: CareRole[] = ['MEMBER', 'CAREGIVER', 'MENTOR', 'PROFESSIONAL'];

const CreateGroupModal: React.FC<Props> = ({ initialType = 'GENERAL', onClose }) => {
  const [groupType, setGroupType] = useState<GroupType>(initialType);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const searchTimeout = useRef<number | null>(null);

  const addConversation = useChatStore((s) => s.addConversation);
  const navigate = useNavigate();

  useEffect(() => {
    if (search.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    searchTimeout.current = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await chatService.searchUsers(search.trim());
        const selectedIds = new Set(selectedMembers.map((m) => m.id));
        setSearchResults(results.filter((r) => !selectedIds.has(r.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, [search, selectedMembers]);

  const handleAddMember = useCallback((user: UserResult) => {
    setSelectedMembers((prev) => {
      if (prev.some((m) => m.id === user.id)) return prev;
      return [...prev, { ...user, role: 'MEMBER' }];
    });
    setSearch('');
    setSearchResults([]);
  }, []);

  const handleRemoveMember = (id: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleRoleChange = (id: string, role: CareRole) => {
    setSelectedMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return;

    setIsCreating(true);
    try {
      let convo;
      if (groupType === 'CARE_CIRCLE') {
        const memberRoles = selectedMembers.map((m) => ({ userId: m.id, role: m.role }));
        convo = await chatService.createCareCircle(groupName.trim(), description.trim(), memberRoles);
      } else {
        const memberIds = selectedMembers.map((m) => m.id);
        convo = await chatService.createGroup(groupName.trim(), description.trim(), memberIds);
      }

      // Send invites in parallel
      await Promise.allSettled(
        selectedMembers.map((m) =>
          chatService.sendInvite(convo.id, m.id, m.role, `Join ${groupName.trim()}!`)
        )
      );

      onClose();
      navigate(`/app/${groupType === 'GENERAL' ? 'groups' : 'chats'}/${convo.id}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const isCareCircle = groupType === 'CARE_CIRCLE';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cgm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cgm-header">
          <h3 className="cgm-title">
            {isCareCircle ? 'New Care Circle' : 'New Group'}
          </h3>
          <button className="cgm-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="cgm-body">
          {/* Type Toggle */}
          <div className="cgm-type-toggle">
            <button
              className={`cgm-type-btn ${groupType === 'GENERAL' ? 'active' : ''}`}
              onClick={() => setGroupType('GENERAL')}
            >
              👥 General Group
            </button>
            <button
              className={`cgm-type-btn ${groupType === 'CARE_CIRCLE' ? 'active' : ''}`}
              onClick={() => setGroupType('CARE_CIRCLE')}
            >
              🦽 Care Circle
            </button>
          </div>

          {/* Group Name */}
          <div className="cgm-field">
            <label className="cgm-label">{isCareCircle ? 'Circle Name' : 'Group Name'}</label>
            <input
              type="text"
              className="cgm-input"
              placeholder={isCareCircle ? 'e.g. Mobility Support Circle' : 'e.g. Weekend Plans'}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="cgm-field">
            <label className="cgm-label">Description <span className="cgm-optional">(optional)</span></label>
            <textarea
              className="cgm-textarea"
              placeholder="What is this group for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          {/* Add Members */}
          <div className="cgm-field">
            <label className="cgm-label">Add Members</label>
            <div className="cgm-search-box">
              <Search size={16} className="cgm-search-icon" />
              <input
                type="text"
                className="cgm-search-input"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isSearching && <p className="cgm-hint">Searching...</p>}
            {searchResults.length > 0 && (
              <div className="cgm-results">
                {searchResults.map((r) => (
                  <div key={r.id} className="cgm-result-item" onClick={() => handleAddMember(r)}>
                    <div className="cgm-result-avatar">{getInitials(r.name)}</div>
                    <div className="cgm-result-info">
                      <span className="cgm-result-name">{r.name}</span>
                      <span className="cgm-result-email">{r.email}</span>
                    </div>
                    <span className="cgm-add-tag">+ Add</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Members */}
          {selectedMembers.length > 0 && (
            <div className="cgm-field">
              <label className="cgm-label">Selected ({selectedMembers.length})</label>
              <div className="cgm-chips">
                {selectedMembers.map((m) => (
                  <div key={m.id} className="cgm-chip">
                    <div className="cgm-chip-avatar">{getInitials(m.name)}</div>
                    <span className="cgm-chip-name">{m.name.split(' ')[0]}</span>
                    {isCareCircle && (
                      <select
                        className="cgm-role-select"
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as CareRole)}
                      >
                        {CARE_ROLES.map((r) => (
                          <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                    )}
                    <button className="cgm-chip-remove" onClick={() => handleRemoveMember(m.id)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCareCircle && (
            <div className="cgm-info-banner">
              💡 Care Circles help you stay connected with your support network. Members will receive an invite to join.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cgm-footer">
          <button className="cgm-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="cgm-create-btn"
            onClick={handleCreate}
            disabled={!groupName.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : (isCareCircle ? 'Create Care Circle' : 'Create Group')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
