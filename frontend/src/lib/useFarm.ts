"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { fetchFarmByUserId, FarmRecord } from "./farm";

export function useFarm(userId?: string | null) {
  const { user } = useUser();
  const resolvedUserId = useMemo(() => userId ?? user?.id ?? null, [user, userId]);
  const [farm, setFarm] = useState<FarmRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!resolvedUserId) {
      setFarm(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const nextFarm = await fetchFarmByUserId(resolvedUserId);
      setFarm(nextFarm);
      return nextFarm;
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to load farm");
      return null;
    } finally {
      setLoading(false);
    }
  }, [resolvedUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    farm,
    loading,
    error,
    refresh,
    userId: resolvedUserId,
  };
}
