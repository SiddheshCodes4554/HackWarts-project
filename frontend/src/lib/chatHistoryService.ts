import { supabase } from './supabaseClient';

export interface ChatMessage {
  id: string;
  user_id: string;
  query: string;
  response: string;
  agent_type: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

/**
 * Save a chat message to Supabase
 */
export async function saveChatMessage(
  userId: string,
  query: string,
  response: string,
  agentType: string = 'general'
): Promise<ChatMessage | null> {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .insert([
        {
          user_id: userId,
          query,
          response,
          agent_type: agentType,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving chat message:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error saving chat:', err);
    return null;
  }
}

/**
 * Fetch chat history for a user
 */
export async function fetchChatHistory(userId: string, limit: number = 50): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching chat history:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching chat history:', err);
    return [];
  }
}

/**
 * Delete a specific chat message
 */
export async function deleteChatMessage(messageId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting chat message:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error deleting chat:', err);
    return false;
  }
}

/**
 * Clear all chat history for a user
 */
export async function clearChatHistory(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error clearing chat history:', err);
    return false;
  }
}

/**
 * Get chat statistics for a user
 */
export async function getChatStats(userId: string) {
  try {
    const { data, error, count } = await supabase
      .from('chat_history')
      .select('agent_type', { count: 'exact' })
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting chat stats:', error);
      return { total: 0, byType: {}, count: 0 };
    }

    const byType: Record<string, number> = {};
    (data || []).forEach((item: ChatMessage) => {
      const type = item.agent_type || 'general';
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total: count || 0,
      byType,
    };
  } catch (err) {
    console.error('Error getting chat stats:', err);
    return { total: 0, byType: {} };
  }
}
