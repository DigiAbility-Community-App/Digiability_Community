import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { AccessibleText } from './AccessibleText';
import { useTheme } from '../../theme/ThemeContext';
import { formatUserDisplayName } from '../../utils/formatUserName';

export interface ForumQuestion {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  tags?: { id: string; name: string }[];
  views: number;
  answerCount: number;
  status: 'SOLVED' | 'UNSOLVED';
  createdAt: string | Date;
  author: {
    id: string;
    name: string;
    role?: string | null;
    forumStats?: { reputation: number } | null;
    isSuspended?: boolean | null;
    deletedAt?: string | null;
  };
}

interface ForumQuestionCardProps {
  question: ForumQuestion;
  onPress: () => void;
  style?: ViewStyle;
  dyslexiaMode?: boolean;
}

export const ForumQuestionCard: React.FC<ForumQuestionCardProps> = ({
  question,
  onPress,
  style,
  dyslexiaMode = false
}) => {
  const { colors, spacing } = useTheme();
  const isSolved = question.status === 'SOLVED';

  // Format date helper (Standard DD/MM/YYYY)
  const formatDate = (dateInput: string | Date) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const authorRole = question.author?.role ? String(question.author.role).toUpperCase() : null;

  // Custom typography settings for Dyslexia Mode
  const textStyle = dyslexiaMode
    ? { letterSpacing: 1.5, lineHeight: 24, fontWeight: '700' as const }
    : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isSolved ? '#10B981' : colors.border,
          borderLeftWidth: isSolved ? 5 : 1,
        },
        style
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Question: ${question.title}. Category: ${question.category}. Status: ${
        isSolved ? 'Resolved' : 'Open'
      }. Asked by ${question.author?.name}.`}
    >
      <View style={styles.header}>
        <View style={styles.authorRow}>
          <View style={styles.avatarPlaceholder}>
            <AccessibleText style={styles.avatarLetter}>
              {question.author?.name ? question.author.name.charAt(0).toUpperCase() : '?'}
            </AccessibleText>
          </View>
          <View style={styles.authorDetails}>
            <View style={styles.nameRow}>
              <AccessibleText style={[styles.authorName, textStyle]}>
                {question.author ? formatUserDisplayName(question.author) : 'Anonymous'}
              </AccessibleText>
              {authorRole && (
                <View style={[styles.roleBadge, { backgroundColor: colors.surface }]}>
                  <AccessibleText style={[styles.roleText, { color: colors.primary }]}>
                    {authorRole}
                  </AccessibleText>
                </View>
              )}
            </View>
            <AccessibleText style={styles.date}>
              {formatDate(question.createdAt)}
            </AccessibleText>
          </View>
        </View>

        <View style={[styles.statusIndicator, { backgroundColor: isSolved ? '#E6FBF3' : '#F3F4F6' }]}>
          <AccessibleText style={[styles.statusText, { color: isSolved ? '#10B981' : '#6B7280' }]}>
            {isSolved ? '✓ Solved' : 'Open'}
          </AccessibleText>
        </View>
      </View>

      <AccessibleText style={[styles.title, textStyle]} variant="title" numberOfLines={2}>
        {question.title}
      </AccessibleText>

      {question.description ? (
        <AccessibleText style={[styles.description, textStyle]} numberOfLines={2}>
          {question.description}
        </AccessibleText>
      ) : null}

      {question.tags && question.tags.length > 0 ? (
        <View style={styles.tagsContainer}>
          {question.tags.slice(0, 3).map(tag => (
            <View key={tag.id} style={[styles.tag, { backgroundColor: colors.surface }]}>
              <AccessibleText style={[styles.tagText, { color: colors.primary }]}>
                #{tag.name.toLowerCase()}
              </AccessibleText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.categoryBadge}>
          <AccessibleText style={styles.categoryText}>
            {question.category}
          </AccessibleText>
        </View>

        <View style={styles.stats}>
          <AccessibleText style={styles.statText}>
            👁 {question.views} views
          </AccessibleText>
          <AccessibleText style={[styles.statText, { marginLeft: spacing.md }]}>
            💬 {question.answerCount} answers
          </AccessibleText>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  authorDetails: {
    marginLeft: 8,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  roleBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginLeft: 6,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  date: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  statusIndicator: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 22,
  },
  description: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
