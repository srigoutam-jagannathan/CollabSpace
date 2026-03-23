/**
 * usePVS — Phase 2 stub hook.
 *
 * In Phase 2 this hook will subscribe to collaboration_events via Supabase
 * Realtime and call the compute-pvs Edge Function to return a live score.
 *
 * For now it returns the stored pvs_score from the profiles table.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function usePVS(userId: string | undefined) {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    supabase
      .from("profiles")
      .select("pvs_score")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        setScore(data?.pvs_score ?? null);
        setLoading(false);
      });
  }, [userId]);

  return { score, loading };
}
