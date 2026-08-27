import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  History,
  Loader2,
  PieChart as PieChartIcon,
  Sparkles,
  Users,
  Settings as SettingsIcon,
  Receipt,
} from 'lucide-react';
import { dbService } from '../services/dbService';
import type { InvoiceData, UserSettings } from '../services/dbService';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { AppUser } from '../lib/authHelper';
import type { User } from 'firebase/auth';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  KES: 'KSh',
};

// Number of months shown in the revenue overview timeline.
const REVENUE_MONTH_WINDOW = 6;

/** Compact money formatting for axis ticks: 1250 -> "$1.3k". */
const formatCompactAxis = (val: number, symbol: string) => {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${symbol}${(val / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${symbol}${(val / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`;
  return `${symbol}${Math.round(val)}`;
};

interface RevenuePoint {
  /** Short month label, e.g. "Aug". */
  name: string;
  /** Sum of every invoice issued in the month. */
  billed: number;
  /** Sum of paid invoices in the month. */
  collected: number;
  /** Number of invoices issued in the month. */
  volume: number;
}

interface RevenueTooltipProps {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string }[];
  label?: string;
  symbol?: string;
  mode?: 'trend' | 'volume';
}

const RevenueTooltip = ({
  active,
  payload,
  label,
  symbol = '$',
  mode = 'trend',
}: RevenueTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const pick = (key: string) =>
    Number(payload.find(entry => entry.dataKey === key)?.value ?? 0);

  const rows =
    mode === 'trend'
      ? [
          { key: 'collected', label: 'Collected', color: 'bg-blue-600' },
          { key: 'billed', label: 'Billed', color: 'bg-indigo-400' },
        ]
      : [{ key: 'volume', label: 'Invoices', color: 'bg-indigo-500' }];

  return (
    <div className="bg-white dark:bg-zinc-900 p-4 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col gap-1 min-w-[140px]">
      <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
        {label}
      </p>
      {rows.map(row => (
        <div key={row.key} className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', row.color)} />
          <p className="text-sm font-black text-gray-900 dark:text-white">
            {row.label}:{' '}
            <span className="text-blue-600 dark:text-blue-400">
              {mode === 'volume'
                ? pick(row.key)
                : `${symbol}${pick(row.key).toLocaleString()}`}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
};

interface DashStatusSlice {
  name?: string;
  value?: number;
  color?: string;
  statusBreakdown?: { value?: number }[];
  [key: string]: unknown;
}

interface DashStat {
  label?: string;
  value?: string | number;
  tab?: string;
  [key: string]: unknown;
}

interface StatusTooltipProps {
  active?: boolean;
  payload?: {
    payload: { name: string; value: number; color: string; statusBreakdown?: { value: number }[] };
  }[];
}

const StatusTooltip = ({ active, payload }: StatusTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const total =
      data.statusBreakdown?.reduce((s: number, i: { value?: number }) => s + (i.value || 0), 0) ||
      0;
    const percentage = total > 0 ? ((data.value / total) * 100).toFixed(0) : 0;

    return (
      <div className="bg-white dark:bg-zinc-900 p-3 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-xl flex items-center gap-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
        <div className="flex flex-col">
          <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
            {data.name}
          </span>
          <span className="text-[10px] font-bold text-gray-400">
            {data.value} Invoices ({percentage}%)
          </span>
        </div>
      </div>
    );
  }
  return null;
};

interface DashboardData {
  revenueHistory: RevenuePoint[];
  statusBreakdown: DashStatusSlice[];
  stats: DashStat[];
  recentActivity: InvoiceData[];
}

export default function Dashboard({
  onAction,
  userSettings,
  user,
}: {
  onAction: (tab: string) => void;
  userSettings?: UserSettings;
  user?: AppUser | User | null;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    revenueHistory: [],
    statusBreakdown: [],
    stats: [],
    recentActivity: [],
  });

  const [isReady, setIsReady] = useState(false);
  const [revView, setRevView] = useState<'trend' | 'volume'>('trend');

  // Use the passed-in user (supports demo/local session users) with a fallback to Firebase auth
  const currentUser = user ?? auth.currentUser;

  const currencyCode = userSettings?.currency || 'USD';
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? '$';

  const fetchDashboardData = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    try {
      const userId = currentUser.uid;
      const [invoices, expenses] = await Promise.all([
        dbService.getInvoices(userId),
        dbService.getExpenses(userId),
      ]);

      // 1. Calculate General Stats
      const totalRevenue = invoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.total || 0), 0);

      const totalBurn = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

      const pendingRevenue = invoices
        .filter(inv => inv.status === 'sent')
        .reduce((sum, inv) => sum + (inv.total || 0), 0);

      const collectedCount = invoices.filter(inv => inv.status === 'paid').length;

      // 2. Status Breakdown for Pie Chart
      const statusCounts = invoices.reduce<Record<string, number>>((acc, inv) => {
        acc[inv.status || 'unknown'] = (acc[inv.status || 'unknown'] || 0) + 1;
        return acc;
      }, {});

      const statusBreakdown = [
        { name: 'Paid', value: statusCounts.paid || 0, color: '#10b981' },
        { name: 'Sent', value: statusCounts.sent || 0, color: '#3b82f6' },
        { name: 'Overdue', value: statusCounts.overdue || 0, color: '#ef4444' },
        { name: 'Draft', value: statusCounts.draft || 0, color: '#94a3b8' },
      ].filter(item => item.value > 0);

      // 3. Real revenue timeline: bucket invoices into the last N months
      //    (current month included), mirroring the approach used in Reports.tsx.
      const now = new Date();
      const monthLabelFmt = new Intl.DateTimeFormat('en-US', { month: 'short' });
      const monthSlots: RevenuePoint[] = [];
      const monthIndexByKey = new Map<string, number>();
      for (let i = REVENUE_MONTH_WINDOW - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthIndexByKey.set(`${d.getFullYear()}-${d.getMonth()}`, monthSlots.length);
        monthSlots.push({
          name: monthLabelFmt.format(d),
          billed: 0,
          collected: 0,
          volume: 0,
        });
      }

      invoices.forEach(inv => {
        const rawDate = inv.issueDate || inv.createdAt || inv.dueDate;
        if (!rawDate) return;
        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime())) return;
        const slotIdx = monthIndexByKey.get(
          `${parsed.getFullYear()}-${parsed.getMonth()}`
        );
        if (slotIdx === undefined) return;
        const slot = monthSlots[slotIdx];
        slot.billed += inv.total || 0;
        if (inv.status === 'paid') slot.collected += inv.total || 0;
        slot.volume += 1;
      });

      const revenueHistory = monthSlots;

      setData({
        stats: [
          {
            label: 'Total Revenue',
            value: `${symbol}${totalRevenue.toLocaleString()}`,
            change: '+12.5%',
            icon: ArrowUpRight,
            trend: 'up',
            tab: 'reports',
          },
          {
            label: 'Total Expenses',
            value: `${symbol}${totalBurn.toLocaleString()}`,
            change: 'Current',
            icon: ArrowDownRight,
            trend: 'down',
            tab: 'expenses',
          },
          {
            label: 'Pending',
            value: `${symbol}${pendingRevenue.toLocaleString()}`,
            change: 'Current',
            icon: Clock,
            trend: 'neutral',
            tab: 'invoices',
          },
          {
            label: 'Collected',
            value: collectedCount.toString(),
            change: 'Invoices',
            icon: CheckCircle2,
            trend: 'up',
            tab: 'invoices',
          },
        ],
        statusBreakdown,
        revenueHistory,
        recentActivity: invoices.slice(0, 5),
      });
    } catch (err) {
      console.error('Dashboard data load failed', err);
    } finally {
      setLoading(false);
      // Delay chart activation to ensure container dimensions are finalized
      setTimeout(() => setIsReady(true), 400);
    }
  }, [currentUser, symbol]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Derived aggregates for the revenue overview summary strip
  const totalBilled6M = data.revenueHistory.reduce((sum, p) => sum + p.billed, 0);
  const totalCollected6M = data.revenueHistory.reduce((sum, p) => sum + p.collected, 0);
  const collectionRate6M =
    totalBilled6M > 0 ? Math.round((totalCollected6M / totalBilled6M) * 100) : 0;
  const latestPoint = data.revenueHistory[data.revenueHistory.length - 1];
  const prevPoint = data.revenueHistory[data.revenueHistory.length - 2];
  const momDelta =
    latestPoint && prevPoint && prevPoint.collected > 0
      ? ((latestPoint.collected - prevPoint.collected) / prevPoint.collected) * 100
      : null;
  const hasRevenueData = data.revenueHistory.some(p => p.billed > 0 || p.collected > 0);
  const awaitingInvoiceCount = data.statusBreakdown
    .filter(s => s.name === 'Sent' || s.name === 'Overdue')
    .reduce((sum, s) => sum + (s.value || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Ambient glass backdrop */}
      <div className="dashboard-bg" aria-hidden="true" />

      <div className="space-y-8 pb-12 relative">
        {/* Welcome & Quick Actions */}
        <div className="flex flex-col xl:flex-row gap-6 items-stretch">
          <div className="flex-1 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 rounded-[2rem] p-6 sm:p-10 text-white relative overflow-hidden shadow-xl ring-1 ring-white/10">
            <div className="absolute top-0 right-0 p-8 opacity-20 hidden md:block">
              <Sparkles size={160} />
            </div>
            <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10 space-y-8">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-[0.9] font-display italic">
                  Welcome back, <br className="sm:hidden" />
                  {
                    (
                      userSettings?.displayName ||
                      currentUser?.displayName ||
                      currentUser?.email ||
                      userSettings?.email
                    )?.split(' ')[0]
                  }
                  !
                </h2>
                <p className="text-blue-100 font-medium text-base sm:text-lg mt-4 max-w-md">
                  You have{' '}
                  <span className="font-black underline decoration-2 underline-offset-4 decoration-blue-300">
                    {awaitingInvoiceCount} pending
                  </span>{' '}
                  invoices that need your attention.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onAction('create-invoice')}
                  className="group px-6 py-4 bg-white text-blue-600 font-black uppercase tracking-widest rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 text-xs"
                >
                  <Sparkles size={18} className="group-hover:animate-pulse" />
                  Build AI Invoice
                </button>
                <button
                  onClick={() => onAction('expenses')}
                  className="px-6 py-4 bg-white/10 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/20 transition-all border border-white/20 flex items-center justify-center gap-3 text-xs backdrop-blur-sm"
                >
                  <Receipt size={18} />
                  Expense Audit
                </button>
              </div>
            </div>
          </div>

          <div className="xl:w-80 grid grid-cols-2 gap-4">
            <button
              onClick={() => onAction('clients')}
              className="dashboard-card flex flex-col items-center justify-center p-6 hover:border-blue-300 dark:hover:border-blue-500/50 hover:-translate-y-1 group active:scale-95"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-700 dark:text-zinc-300">
                Add Client
              </span>
            </button>
            <button
              onClick={() => onAction('settings')}
              className="dashboard-card flex flex-col items-center justify-center p-6 hover:border-indigo-300 dark:hover:border-indigo-400/50 hover:-translate-y-1 group active:scale-95"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-slate-700 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-slate-500/30 group-hover:scale-110 transition-transform">
                <SettingsIcon size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-700 dark:text-zinc-300">
                Setup
              </span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {data.stats.map((stat, i: number) => (
            <button
              key={i}
              onClick={() => stat.tab && onAction(stat.tab)}
              className={cn(
                'dashboard-card p-5 group flex flex-col items-start text-left transition-all active:scale-95 hover:-translate-y-0.5',
                stat.tab
                  ? 'hover:border-blue-400 dark:hover:border-blue-500/50 cursor-pointer'
                  : 'cursor-default'
              )}
            >
              <div className="flex items-start justify-between w-full gap-2">
                <div className="min-w-0 pr-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-1 truncate">
                    {stat.label}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                    {stat.value}
                  </h3>
                  {stat.tab && (
                    <div className="mt-2 flex items-center gap-1 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] font-black uppercase tracking-tighter">
                        Enter Section
                      </span>
                      <ArrowUpRight size={10} />
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    'w-11 h-11 rounded-xl shrink-0 flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg',
                    stat.trend === 'up'
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-emerald-500/30'
                      : stat.trend === 'down'
                        ? 'bg-gradient-to-br from-rose-400 to-red-600 text-white shadow-red-500/30'
                        : 'bg-gradient-to-br from-blue-400 to-indigo-600 text-white shadow-blue-500/30'
                  )}
                >
                  <stat.icon size={18} />
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Main Revenue Chart */}
          <div className="lg:col-span-2 dashboard-card min-h-[350px] sm:h-[450px] flex flex-col p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  Revenue Overview
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-500 font-medium tracking-tight">
                  Last {REVENUE_MONTH_WINDOW} months · {currencyCode}
                </p>
              </div>
              <div className="flex p-1 bg-white/50 dark:bg-zinc-800/60 rounded-xl w-fit backdrop-blur border border-white/40 dark:border-zinc-700 shadow-inner">
                <button
                  onClick={() => setRevView('trend')}
                  aria-pressed={revView === 'trend'}
                  className={cn(
                    'px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase rounded-lg transition-all',
                    revView === 'trend'
                      ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                  )}
                >
                  Trend
                </button>
                <button
                  onClick={() => setRevView('volume')}
                  aria-pressed={revView === 'volume'}
                  className={cn(
                    'px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase rounded-lg transition-all',
                    revView === 'volume'
                      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                  )}
                >
                  Volume
                </button>
              </div>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
              <div className="rounded-xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 px-3 py-2.5 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 truncate">
                  Billed
                </p>
                <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight truncate mt-0.5">
                  {symbol}
                  {totalBilled6M.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 px-3 py-2.5 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 truncate">
                  Collected
                </p>
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 tracking-tight truncate mt-0.5">
                    {symbol}
                    {totalCollected6M.toLocaleString()}
                  </p>
                  {momDelta !== null && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter shrink-0',
                        momDelta >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      )}
                    >
                      {momDelta >= 0 ? (
                        <ArrowUpRight size={9} />
                      ) : (
                        <ArrowDownRight size={9} />
                      )}
                      {Math.abs(momDelta).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 px-3 py-2.5 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 truncate">
                  Collection Rate
                </p>
                <p
                  className={cn(
                    'text-sm sm:text-base font-black tracking-tight truncate mt-0.5',
                    collectionRate6M >= 70
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : collectionRate6M >= 40
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  {collectionRate6M}%
                </p>
              </div>
            </div>
            {/* Legend for trend mode */}
            {revView === 'trend' && hasRevenueData && (
              <div className="flex items-center gap-5 mt-4">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                  <span className="w-3 h-[3px] rounded-full bg-blue-600 inline-block" />
                  Collected
                </span>
                <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                  <span className="w-3 border-t-2 border-dashed border-indigo-400 inline-block" />
                  Billed
                </span>
              </div>
            )}

            <div className="w-full mt-3 h-[240px] sm:h-[260px] relative flex-1">
              {!hasRevenueData ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                    <Sparkles size={26} />
                  </div>
                  <h4 className="text-base font-black text-gray-900 dark:text-white tracking-tight">
                    No revenue recorded yet
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 font-medium max-w-[230px] mx-auto mt-1">
                    Issue your first invoice and your revenue trend will appear here.
                  </p>
                  <button
                    onClick={() => onAction('create-invoice')}
                    className="mt-5 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all active:scale-95 flex items-center gap-2 text-[10px]"
                  >
                    <Sparkles size={14} />
                    Create Invoice
                  </button>
                </div>
              ) : (
                isReady && (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    debounce={100}
                    minWidth={0}
                    minHeight={0}
                    initialDimension={{ width: 300, height: 300 }}
                  >
                    {revView === 'trend' ? (
                      <AreaChart
                        data={data.revenueHistory}
                        margin={{ left: 10, right: 10, top: 10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="rgba(148,163,184,0.16)"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                          width={56}
                          tickFormatter={val => formatCompactAxis(Number(val), symbol)}
                        />
                        <Tooltip
                          content={<RevenueTooltip symbol={symbol} mode="trend" />}
                          cursor={{
                            stroke: '#2563eb',
                            strokeWidth: 1,
                            strokeDasharray: '4 4',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="billed"
                          stroke="#818cf8"
                          strokeWidth={2}
                          strokeDasharray="6 5"
                          fill="transparent"
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 0, fill: '#818cf8' }}
                          animationDuration={1400}
                        />
                        <Area
                          type="monotone"
                          dataKey="collected"
                          stroke="#2563eb"
                          strokeWidth={4}
                          strokeLinecap="round"
                          fillOpacity={1}
                          fill="url(#colorRev)"
                          activeDot={{ r: 8, strokeWidth: 0, fill: '#2563eb' }}
                          animationDuration={1200}
                        />
                      </AreaChart>
                    ) : (
                      <BarChart
                        data={data.revenueHistory}
                        margin={{ left: 10, right: 10, top: 10, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="rgba(148,163,184,0.16)"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                          dy={10}
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                          width={36}
                        />
                        <Tooltip
                          content={<RevenueTooltip symbol={symbol} mode="volume" />}
                          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                        />
                        <Bar
                          dataKey="volume"
                          fill="#6366f1"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={30}
                          animationDuration={900}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )
              )}
            </div>
          </div>

          {/* Status Breakdown Circle */}
          <div className="dashboard-card flex flex-col min-h-[350px] sm:h-[450px] p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-2">
              <PieChartIcon size={18} className="text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Invoice Status
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-500 font-medium mb-6">
              Current distributions
            </p>

            <div className="w-full mt-4 h-[200px] relative">
              {isReady && (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  debounce={100}
                  minWidth={0}
                  minHeight={0}
                  initialDimension={{ width: 300, height: 300 }}
                >
                  <PieChart>
                    <Pie
                      data={data.statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius="65%"
                      outerRadius="85%"
                      paddingAngle={10}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1200}
                      stroke="none"
                    >
                      {data.statusBreakdown.map((entry, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          style={{ cursor: 'pointer', outline: 'none' }}
                          className="transition-opacity hover:opacity-80"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<StatusTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {isReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {data.statusBreakdown.reduce(
                      (s: number, i: DashStatusSlice) => s + (i.value || 0),
                      0
                    )}
                  </span>
                  <span className="text-[8px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                    Total
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {data.statusBreakdown.map(item => (
                <div
                  key={item.name || 'unknown'}
                  className="flex items-center gap-2 p-1.5 rounded-lg bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 backdrop-blur"
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] font-bold text-gray-600 dark:text-zinc-300 truncate">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 ml-auto">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Table */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <History size={18} className="text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Recent Invoices
              </h3>
            </div>
            <button className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition">
              View Full List
            </button>
          </div>
          <div className="space-y-4">
            {data.recentActivity.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-zinc-400 font-medium italic">
                No recent activity found.
              </div>
            ) : (
              data.recentActivity.map((inv, idx: number) => (
                <div
                  key={inv.id || idx}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/50 dark:hover:bg-white/5 border border-transparent hover:border-white/60 dark:hover:border-white/10 group transition-colors"
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg transition-transform group-hover:scale-110 shadow-lg',
                      inv.status === 'paid'
                        ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-emerald-500/30'
                        : 'bg-gradient-to-br from-blue-400 to-indigo-600 text-white shadow-blue-500/30'
                    )}
                  >
                    {inv.clientName?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {inv.clientName}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
                      #{inv.invoiceNumber} • {new Date(inv.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      ${inv.total?.toLocaleString()}
                    </p>
                    <span
                      className={cn(
                        'text-[10px] font-black uppercase tracking-tighter',
                        inv.status === 'paid'
                          ? 'text-emerald-500 dark:text-emerald-400'
                          : 'text-gray-400 dark:text-zinc-500'
                      )}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
