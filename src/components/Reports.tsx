import React, { useMemo, useRef, useLayoutEffect, useState } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, DollarSign,
  Download, Zap, Target, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { getFinancialInsights } from '../services/geminiService';
import type { InvoiceData, UserSettings } from '../services/dbService';

interface ReportsProps {
  invoices: InvoiceData[];
  userSettings: UserSettings;
}

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#6366f1'];

// ---------------------------------------------------------------------------
// useMeasure â€“ tracks an element's pixel dimensions via ResizeObserver.
// Returns [ref, { width, height }].  width/height are 0 until the element
// has been laid out in the browser.
// ---------------------------------------------------------------------------
function useMeasure<T extends HTMLElement>(): [React.RefObject<T>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Read initial size synchronously so charts are ready on first meaningful paint.
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDims({ width: rect.width, height: rect.height });
    }

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setDims({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, dims];
}

export default function Reports({ invoices, userSettings }: ReportsProps) {
  const [aiInsight, setAiInsight] = React.useState<string>("");
  const [loadingAi, setLoadingAi] = React.useState(false);

  // Measure each chart wrapper before rendering the chart.
  const [areaRef, areaDims] = useMeasure<HTMLDivElement>();
  const [pieRef, pieDims] = useMeasure<HTMLDivElement>();

  React.useEffect(() => {
    const fetchInsight = async () => {
      if (invoices.length === 0) return;
      setLoadingAi(true);
      try {
        const insight = await getFinancialInsights(invoices, []);
        setAiInsight(insight);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAi(false);
      }
    };
    fetchInsight();
  }, [invoices]);

  const currency = userSettings?.currency || 'USD';
  const getCurrencySymbol = (code: string) => {
    const symbols: Record<string, string> = { 'USD': '$', 'EUR': 'â‚¬', 'GBP': 'Â£', 'NGN': 'â‚¦', 'KES': 'KSh' };
    return symbols[code] || '$';
  };

  const symbol = getCurrencySymbol(currency);

  const stats = useMemo(() => {
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const paidRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0);
    const pendingRevenue = invoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + (inv.total || 0), 0);
    const overdueRevenue = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.total || 0), 0);

    // Monthly data
    const monthlyMap = new Map();
    invoices.forEach(inv => {
      const parsed = inv.createdAt ? new Date(inv.createdAt) : null;
      const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
      const month = format(date, 'MMM yyyy');
      const current = monthlyMap.get(month) || { month, total: 0, paid: 0 };
      current.total += inv.total || 0;
      if (inv.status === 'paid') current.paid += inv.total || 0;
      monthlyMap.set(month, current);
    });

    const monthlyData = Array.from(monthlyMap.values()).reverse().slice(0, 6);

    // Status distribution
    const statusData = [
      { name: 'Paid', value: paidRevenue },
      { name: 'Pending', value: pendingRevenue },
      { name: 'Overdue', value: overdueRevenue },
    ].filter(d => d.value > 0);

    return {
      totalRevenue,
      paidRevenue,
      pendingRevenue,
      overdueRevenue,
      monthlyData,
      statusData,
      collectionRate: totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0
    };
  }, [invoices]);

  const handleExportCSV = () => {
    const headers = ['Invoice #', 'Client', 'Date', 'Amount', 'Status', 'Tax'];
    const rows = invoices.map(inv => [
      inv.invoiceNumber,
      inv.clientName,
      format(inv.createdAt && !Number.isNaN(new Date(inv.createdAt).getTime()) ? new Date(inv.createdAt) : new Date(), 'yyyy-MM-dd'),
      inv.total,
      inv.status,
      inv.tax
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financial_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic leading-none">Financial Intelligence</h2>
          <p className="text-gray-500 dark:text-zinc-400 font-medium mt-2">Deep analytics of your business performance</p>
        </div>
        <button 
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-zinc-800 text-white font-bold rounded-2xl hover:bg-black dark:hover:bg-zinc-700 transition-all active:scale-95 shadow-xl shadow-gray-200 dark:shadow-none"
        >
          <Download size={18} />
          Export Tax Data (CSV)
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3 sm:space-y-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Total Invoiced</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {symbol}{stats.totalRevenue.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3 sm:space-y-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 dark:bg-zinc-800 text-green-600 dark:text-green-400 rounded-xl sm:rounded-2xl flex items-center justify-center">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Revenue Collected</p>
            <p className="text-2xl font-black text-green-600 dark:text-green-400 tracking-tight">
              {symbol}{stats.paidRevenue.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3 sm:space-y-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-50 dark:bg-zinc-800 text-orange-600 dark:text-orange-400 rounded-xl sm:rounded-2xl flex items-center justify-center">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Outstanding</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {symbol}{(stats.pendingRevenue + stats.overdueRevenue).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3 sm:space-y-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 dark:bg-zinc-800 text-purple-600 dark:text-purple-400 rounded-xl sm:rounded-2xl flex items-center justify-center">
            <Target size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Collection Rate</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {stats.collectionRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Revenue Trends */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white italic tracking-tight">Revenue Trends</h3>
              <p className="text-xs text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Last 6 Months</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 px-3 py-1.5 rounded-full">
              <TrendingUp size={12} />
              Growth Chart
            </div>
          </div>
          {/* Wrapper measured by useMeasure â€“ chart only renders once dims are known */}
          <div ref={areaRef} className="h-[200px] sm:h-[300px] w-full">
            {areaDims.width > 0 && areaDims.height > 0 && (
              <AreaChart
                width={areaDims.width}
                height={areaDims.height}
                data={stats.monthlyData}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#9ca3af'}} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '1rem',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    backgroundColor: 'var(--card)',
                    color: 'var(--foreground)'
                  }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  formatter={(value: number | string) => [`${symbol}${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="paid" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" fill="transparent" />
              </AreaChart>
            )}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 shadow-sm">
          <div className="mb-8 text-center sm:text-left">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white italic tracking-tight">Status Mix</h3>
            <p className="text-xs text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Portfolio Breakdown</p>
          </div>
          {/* Wrapper measured by useMeasure */}
          <div ref={pieRef} className="h-[180px] sm:h-[250px] w-full">
            {pieDims.width > 0 && pieDims.height > 0 && (
              <PieChart width={pieDims.width} height={pieDims.height}>
                <Pie
                  data={stats.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '1rem',
                    border: 'none',
                    backgroundColor: 'var(--card)',
                    color: 'var(--foreground)'
                  }}
                />
              </PieChart>
            )}
          </div>
          <div className="space-y-3 mt-4">
            {stats.statusData.map((data, index) => (
              <div key={data.name} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs font-bold text-gray-600 dark:text-zinc-400 tracking-wider uppercase">{data.name}</span>
                </div>
                <span className="text-xs font-black text-gray-900 dark:text-white">{symbol}{data.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations / Insights */}
      <div className="bg-gray-900 dark:bg-zinc-900 rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-10 relative overflow-hidden text-white">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-600 rounded-full blur-[80px] opacity-30" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5 sm:gap-8">
          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-blue-600 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 flex-shrink-0">
            <Zap size={28} className="animate-pulse" />
          </div>
          <div className="flex-1 space-y-3">
            <h4 className="text-lg sm:text-2xl font-black tracking-tight leading-none italic uppercase">AI Growth Insights</h4>
            <div className="text-gray-300 dark:text-gray-400 font-medium max-w-2xl leading-relaxed min-h-[2rem] sm:min-h-[3rem] text-sm sm:text-base">
              {loadingAi ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin text-blue-500" size={16} />
                  <span>Analyzing portfolio dynamics...</span>
                </div>
              ) : (
                aiInsight || "Recording more invoices will unlock deeper strategic insights."
              )}
            </div>
          </div>
          <button 
            onClick={() => { /* TODO: wire to on-demand deep analysis run */ }}
            className="px-5 py-3 sm:px-8 sm:py-4 bg-white text-gray-900 font-black rounded-xl sm:rounded-2xl hover:bg-gray-100 transition-all uppercase tracking-widest text-[10px] sm:text-xs w-full sm:w-auto text-center"
          >
            Run Deep Analysis
          </button>
        </div>
      </div>
    </div>
  );
}


