import { useDashboardData } from '@/hooks/useDashboardData';
import type { Ausgabenuebersicht, Einnahmenuebersicht } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AusgabenuebersichtDialog } from '@/components/dialogs/AusgabenuebersichtDialog';
import { EinnahmenuebersichtDialog } from '@/components/dialogs/EinnahmenuebersichtDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconTrendingUp, IconTrendingDown,
  IconWallet, IconChartBar, IconArrowUpRight, IconArrowDownRight,
  IconCalendar,
} from '@tabler/icons-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

const APPGROUP_ID = '67c17bf3c1fa4f6f803df575';
const REPAIR_ENDPOINT = '/claude/build/repair';

type ActiveTab = 'ausgaben' | 'einnahmen';

export default function DashboardOverview() {
  const {
    ausgabenuebersicht, einnahmenuebersicht,
    loading, error, fetchAll,
  } = useDashboardData();

  const [activeTab, setActiveTab] = useState<ActiveTab>('ausgaben');
  const [ausgabenDialogOpen, setAusgabenDialogOpen] = useState(false);
  const [einnahmenDialogOpen, setEinnahmenDialogOpen] = useState(false);
  const [editAusgabe, setEditAusgabe] = useState<Ausgabenuebersicht | null>(null);
  const [editEinnahme, setEditEinnahme] = useState<Einnahmenuebersicht | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'ausgabe' | 'einnahme' } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  const now = new Date();

  // Build monthly chart data (last 6 months)
  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const key = format(d, 'yyyy-MM');
      const label = format(d, 'MMM', { locale: de });
      const start = startOfMonth(d);
      const end = endOfMonth(d);

      const ausgaben = ausgabenuebersicht
        .filter(a => {
          const datum = a.fields.datum;
          if (!datum) return false;
          try { return isWithinInterval(parseISO(datum), { start, end }); } catch { return false; }
        })
        .reduce((sum, a) => sum + (a.fields.ausgaben_betrag ?? 0), 0);

      const einnahmen = einnahmenuebersicht
        .filter(e => {
          const datum = e.fields.datum;
          if (!datum) return false;
          try { return isWithinInterval(parseISO(datum), { start, end }); } catch { return false; }
        })
        .reduce((sum, e) => sum + (e.fields.einnahmen_betrag ?? 0), 0);

      return { key, label, ausgaben, einnahmen, saldo: einnahmen - ausgaben };
    });
    return months;
  }, [ausgabenuebersicht, einnahmenuebersicht]);

  // Current month stats
  const currentMonthData = useMemo(() => {
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const ausgaben = ausgabenuebersicht.filter(a => {
      if (!a.fields.datum) return false;
      try { return isWithinInterval(parseISO(a.fields.datum), { start, end }); } catch { return false; }
    });

    const einnahmen = einnahmenuebersicht.filter(e => {
      if (!e.fields.datum) return false;
      try { return isWithinInterval(parseISO(e.fields.datum), { start, end }); } catch { return false; }
    });

    const totalAusgaben = ausgaben.reduce((s, a) => s + (a.fields.ausgaben_betrag ?? 0), 0);
    const totalEinnahmen = einnahmen.reduce((s, e) => s + (e.fields.einnahmen_betrag ?? 0), 0);
    const saldo = totalEinnahmen - totalAusgaben;

    // Prev month for comparison
    const prevStart = startOfMonth(subMonths(now, 1));
    const prevEnd = endOfMonth(subMonths(now, 1));
    const prevAusgaben = ausgabenuebersicht
      .filter(a => { try { return a.fields.datum && isWithinInterval(parseISO(a.fields.datum), { start: prevStart, end: prevEnd }); } catch { return false; } })
      .reduce((s, a) => s + (a.fields.ausgaben_betrag ?? 0), 0);
    const prevEinnahmen = einnahmenuebersicht
      .filter(e => { try { return e.fields.datum && isWithinInterval(parseISO(e.fields.datum), { start: prevStart, end: prevEnd }); } catch { return false; } })
      .reduce((s, e) => s + (e.fields.einnahmen_betrag ?? 0), 0);

    return { totalAusgaben, totalEinnahmen, saldo, prevAusgaben, prevEinnahmen };
  }, [ausgabenuebersicht, einnahmenuebersicht]);

  // Filtered records for selected month
  const filteredRecords = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const start = startOfMonth(d);
    const end = endOfMonth(d);

    const ausgaben = ausgabenuebersicht.filter(a => {
      if (!a.fields.datum) return false;
      try { return isWithinInterval(parseISO(a.fields.datum), { start, end }); } catch { return false; }
    }).sort((a, b) => (b.fields.datum ?? '').localeCompare(a.fields.datum ?? ''));

    const einnahmen = einnahmenuebersicht.filter(e => {
      if (!e.fields.datum) return false;
      try { return isWithinInterval(parseISO(e.fields.datum), { start, end }); } catch { return false; }
    }).sort((a, b) => (b.fields.datum ?? '').localeCompare(a.fields.datum ?? ''));

    return { ausgaben, einnahmen };
  }, [ausgabenuebersicht, einnahmenuebersicht, selectedMonth]);

  // Ausgaben by category for current month
  const ausgabenByKategorie = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.ausgaben.forEach(a => {
      const kat = a.fields.ausgaben_kategorie?.label ?? 'Sonstige';
      map[kat] = (map[kat] ?? 0) + (a.fields.ausgaben_betrag ?? 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredRecords.ausgaben]);

  // Available months from data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    ausgabenuebersicht.forEach(a => { if (a.fields.datum) months.add(a.fields.datum.slice(0, 7)); });
    einnahmenuebersicht.forEach(e => { if (e.fields.datum) months.add(e.fields.datum.slice(0, 7)); });
    months.add(format(now, 'yyyy-MM'));
    return Array.from(months).sort().reverse();
  }, [ausgabenuebersicht, einnahmenuebersicht]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'ausgabe') {
      await LivingAppsService.deleteAusgabenuebersichtEntry(deleteTarget.id);
    } else {
      await LivingAppsService.deleteEinnahmenuebersichtEntry(deleteTarget.id);
    }
    setDeleteTarget(null);
    fetchAll();
  };

  const pct = (val: number, prev: number) => {
    if (prev === 0) return null;
    return Math.round(((val - prev) / prev) * 100);
  };

  const ausgabenPct = pct(currentMonthData.totalAusgaben, currentMonthData.prevAusgaben);
  const einnahmenPct = pct(currentMonthData.totalEinnahmen, currentMonthData.prevEinnahmen);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budgetverwaltung</h1>
          <p className="text-sm text-muted-foreground">{format(now, 'MMMM yyyy', { locale: de })}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => { setEditEinnahme(null); setEinnahmenDialogOpen(true); }}>
            <IconPlus size={14} className="mr-1 shrink-0" />
            <span>Einnahme</span>
          </Button>
          <Button size="sm" onClick={() => { setEditAusgabe(null); setAusgabenDialogOpen(true); }}>
            <IconPlus size={14} className="mr-1 shrink-0" />
            <span>Ausgabe</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Einnahmen (Monat)"
          value={formatCurrency(currentMonthData.totalEinnahmen)}
          description={einnahmenPct !== null
            ? `${einnahmenPct >= 0 ? '+' : ''}${einnahmenPct}% vs. Vormonat`
            : 'Kein Vormonat'}
          icon={<IconTrendingUp size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Ausgaben (Monat)"
          value={formatCurrency(currentMonthData.totalAusgaben)}
          description={ausgabenPct !== null
            ? `${ausgabenPct >= 0 ? '+' : ''}${ausgabenPct}% vs. Vormonat`
            : 'Kein Vormonat'}
          icon={<IconTrendingDown size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Saldo (Monat)"
          value={formatCurrency(currentMonthData.saldo)}
          description={currentMonthData.saldo >= 0 ? 'Positiv' : 'Negativ'}
          icon={<IconWallet size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* 6-Month Chart */}
      <div className="rounded-2xl border bg-card p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <IconChartBar size={16} className="text-muted-foreground shrink-0" />
          <h2 className="font-semibold text-foreground text-sm">Verlauf (6 Monate)</h2>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-einnahmen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-ausgaben" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
              formatter={(value: number) => [formatCurrency(value), '']}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Area type="monotone" dataKey="einnahmen" name="Einnahmen" stroke="var(--primary)" strokeWidth={2} fill="url(#grad-einnahmen)" dot={false} />
            <Area type="monotone" dataKey="ausgaben" name="Ausgaben" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#grad-ausgaben)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Month picker + Tabs + Records */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Month + Tab bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b">
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            <button
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ausgaben' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('ausgaben')}
            >
              Ausgaben
            </button>
            <button
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'einnahmen' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('einnahmen')}
            >
              Einnahmen
            </button>
          </div>
          <div className="flex items-center gap-2">
            <IconCalendar size={14} className="text-muted-foreground shrink-0" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="text-sm border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {format(parseISO(m + '-01'), 'MMMM yyyy', { locale: de })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Records list */}
        <div className="divide-y divide-border">
          {activeTab === 'ausgaben' && (
            <>
              {filteredRecords.ausgaben.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <IconTrendingDown size={40} className="text-muted-foreground" stroke={1.5} />
                  <p className="text-sm text-muted-foreground">Keine Ausgaben in diesem Monat</p>
                  <Button size="sm" variant="outline" onClick={() => { setEditAusgabe(null); setAusgabenDialogOpen(true); }}>
                    <IconPlus size={14} className="mr-1" />Ausgabe erfassen
                  </Button>
                </div>
              ) : (
                filteredRecords.ausgaben.map(item => (
                  <div key={item.record_id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                      <IconArrowDownRight size={16} className="text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.fields.ausgaben_beschreibung || '—'}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {item.fields.ausgaben_kategorie && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{item.fields.ausgaben_kategorie.label}</span>
                        )}
                        {item.fields.datum && (
                          <span className="text-xs text-muted-foreground">{formatDate(item.fields.datum)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-destructive">−{formatCurrency(item.fields.ausgaben_betrag)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditAusgabe(item); setAusgabenDialogOpen(true); }}
                        title="Bearbeiten"
                      >
                        <IconPencil size={14} />
                      </button>
                      <button
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: item.record_id, type: 'ausgabe' })}
                        title="Löschen"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'einnahmen' && (
            <>
              {filteredRecords.einnahmen.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <IconTrendingUp size={40} className="text-muted-foreground" stroke={1.5} />
                  <p className="text-sm text-muted-foreground">Keine Einnahmen in diesem Monat</p>
                  <Button size="sm" variant="outline" onClick={() => { setEditEinnahme(null); setEinnahmenDialogOpen(true); }}>
                    <IconPlus size={14} className="mr-1" />Einnahme erfassen
                  </Button>
                </div>
              ) : (
                filteredRecords.einnahmen.map(item => (
                  <div key={item.record_id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <IconArrowUpRight size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.fields.einnahmen_beschreibung || '—'}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {item.fields.einnahmen_kategorie && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{item.fields.einnahmen_kategorie.label}</span>
                        )}
                        {item.fields.datum && (
                          <span className="text-xs text-muted-foreground">{formatDate(item.fields.datum)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-primary">+{formatCurrency(item.fields.einnahmen_betrag)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditEinnahme(item); setEinnahmenDialogOpen(true); }}
                        title="Bearbeiten"
                      >
                        <IconPencil size={14} />
                      </button>
                      <button
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: item.record_id, type: 'einnahme' })}
                        title="Löschen"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* Month total footer */}
        {(activeTab === 'ausgaben' && filteredRecords.ausgaben.length > 0) && (
          <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/20">
            <span className="text-sm text-muted-foreground">{filteredRecords.ausgaben.length} Einträge</span>
            <span className="text-sm font-semibold text-destructive">
              −{formatCurrency(filteredRecords.ausgaben.reduce((s, a) => s + (a.fields.ausgaben_betrag ?? 0), 0))}
            </span>
          </div>
        )}
        {(activeTab === 'einnahmen' && filteredRecords.einnahmen.length > 0) && (
          <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/20">
            <span className="text-sm text-muted-foreground">{filteredRecords.einnahmen.length} Einträge</span>
            <span className="text-sm font-semibold text-primary">
              +{formatCurrency(filteredRecords.einnahmen.reduce((s, e) => s + (e.fields.einnahmen_betrag ?? 0), 0))}
            </span>
          </div>
        )}
      </div>

      {/* Ausgaben by Kategorie */}
      {ausgabenByKategorie.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <IconChartBar size={16} className="text-muted-foreground shrink-0" />
            <h2 className="font-semibold text-foreground text-sm">
              Ausgaben nach Kategorie — {format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: de })}
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ausgabenByKategorie} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                formatter={(value: number) => [formatCurrency(value), 'Betrag']}
              />
              <Bar dataKey="value" name="Ausgaben" fill="hsl(var(--destructive))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dialogs */}
      <AusgabenuebersichtDialog
        open={ausgabenDialogOpen}
        onClose={() => { setAusgabenDialogOpen(false); setEditAusgabe(null); }}
        onSubmit={async (fields) => {
          if (editAusgabe) {
            await LivingAppsService.updateAusgabenuebersichtEntry(editAusgabe.record_id, fields);
          } else {
            await LivingAppsService.createAusgabenuebersichtEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editAusgabe?.fields}
        recordId={editAusgabe?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Ausgabenuebersicht']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Ausgabenuebersicht']}
      />

      <EinnahmenuebersichtDialog
        open={einnahmenDialogOpen}
        onClose={() => { setEinnahmenDialogOpen(false); setEditEinnahme(null); }}
        onSubmit={async (fields) => {
          if (editEinnahme) {
            await LivingAppsService.updateEinnahmenuebersichtEntry(editEinnahme.record_id, fields);
          } else {
            await LivingAppsService.createEinnahmenuebersichtEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editEinnahme?.fields}
        recordId={editEinnahme?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Einnahmenuebersicht']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Einnahmenuebersicht']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
