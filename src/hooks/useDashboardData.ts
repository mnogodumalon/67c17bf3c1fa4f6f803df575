import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Ausgabenuebersicht, Einnahmenuebersicht } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [ausgabenuebersicht, setAusgabenuebersicht] = useState<Ausgabenuebersicht[]>([]);
  const [einnahmenuebersicht, setEinnahmenuebersicht] = useState<Einnahmenuebersicht[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [ausgabenuebersichtData, einnahmenuebersichtData] = await Promise.all([
        LivingAppsService.getAusgabenuebersicht(),
        LivingAppsService.getEinnahmenuebersicht(),
      ]);
      setAusgabenuebersicht(ausgabenuebersichtData);
      setEinnahmenuebersicht(einnahmenuebersichtData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [ausgabenuebersichtData, einnahmenuebersichtData] = await Promise.all([
          LivingAppsService.getAusgabenuebersicht(),
          LivingAppsService.getEinnahmenuebersicht(),
        ]);
        setAusgabenuebersicht(ausgabenuebersichtData);
        setEinnahmenuebersicht(einnahmenuebersichtData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  return { ausgabenuebersicht, setAusgabenuebersicht, einnahmenuebersicht, setEinnahmenuebersicht, loading, error, fetchAll };
}