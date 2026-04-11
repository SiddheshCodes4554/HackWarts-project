import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import {
  saveChatMessage,
  fetchChatHistory,
  clearChatHistory,
  getChatStats,
  ChatMessage,
} from './chatHistoryService';

export function useChatHistory() {
  const { user } = useUser();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, byType: {} });

  // Load chat history on mount
  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const messages = await fetchChatHistory(user.id);
        setHistory(messages);

        const chatStats = await getChatStats(user.id);
        setStats(chatStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chat history');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [user]);

  // Save a message to history
  const addToHistory = useCallback(
    async (query: string, response: string, agentType: string = 'general') => {
      if (!user) return null;

      try {
        const message = await saveChatMessage(user.id, query, response, agentType);
        if (message) {
          setHistory((prev) => [message, ...prev]);
          setStats((prev) => ({
            ...prev,
            total: prev.total + 1,
            byType: {
              ...prev.byType,
              [agentType]: (prev.byType[agentType as keyof typeof prev.byType] || 0) + 1,
            },
          }));
        }
        return message;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save message');
        return null;
      }
    },
    [user]
  );

  // Clear all history
  const clear = useCallback(async () => {
    if (!user) return false;

    try {
      const success = await clearChatHistory(user.id);
      if (success) {
        setHistory([]);
        setStats({ total: 0, byType: {} });
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history');
      return false;
    }
  }, [user]);

  // Refresh history from server
  const refresh = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const messages = await fetchChatHistory(user.id);
      setHistory(messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh history');
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    history,
    loading,
    error,
    stats,
    addToHistory,
    clear,
    refresh,
  };
}
