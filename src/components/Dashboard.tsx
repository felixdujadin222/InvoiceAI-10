import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, History, Loader2, PieChart as PieChartIcon, Sparkles, Users, Repeat, Settings as SettingsIcon, MessageSquare, Receipt } from 'lucide-react';
import { dbService } from '../services/dbService';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';

export default function Dashboard({ onAction, userSettings }: { onAction: (tab: string) => void, userSettings?: any }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    revenueHistory: [],
    statusBreakdown: [],
    stats: [],
    recentActivity: []
  });

  const [isReady, setIsReady] = useState(false);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-zinc-900 p-4 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col gap-1 min-w-[120px]">
          <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">{label}</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <p className="text-sm font-black text-gray-900 dark:text-white">
              Revenue: <span className="text-blue-600">{`$${payload[0].value.toLocaleString()}`}</span>
            </p>
          </div>
          <p className="text-[10px] text-gray-400 font-medium italic mt-1">+8.2% from start</p>
        </div>
      );
    }
    return null;
  };

  const StatusTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = data.statusBreakdown?.reduce((s: number, i: any) => s + i.value, 0) || 0;
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(0) : 0;
      
      return (
        <div className="bg-white dark:bg-zinc-900 p-3 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-xl flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
          <div className="flex flex-col">
            <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">{data.name}</span>
            <span className="text-[10px] font-bold text-gray-400">{data.value} Invoices ({percentage}%)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.currentUser) return;
      try {
        const userId = auth.currentUser.uid;
        const [invoices, expenses] = await Promise.all([
          dbService.getInvoices(userId) as Promise<any[]>,
          dbService.getExpenses(userId) as Promise<any[]>
        ]);
        
        // 1. Calculate General Stats
        const totalRevenue = invoices
          .filter((inv: any) => inv.status === 'paid')
          .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
        
        const totalBurn = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
        
        const pendingRevenue = invoices
          .filter((inv: any) => inv.status === 'sent')
          .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
          
        const overdueRevenue = invoices
          .filter((inv: any) => inv.status === 'overdue')
          .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);

        const collectedCount = invoices.filter((inv: any) => inv.status === 'paid').length;

        // 2. Status Breakdown for Pie Chart
        const statusCounts = invoices.reduce((acc: any, inv: any) => {
          acc[inv.status] = (acc[inv.status] || 0) + 1;
          return acc;
        }, {});

        const statusBreakdown = [
          { name: 'Paid', value: statusCounts.paid || 0, color: '#10b981' },
          { name: 'Sent', value: statusCounts.sent || 0, color: '#3b82f6' },
          { name: 'Overdue', value: statusCounts.overdue || 0, color: '#ef4444' },
          { name: 'Draft', value: statusCounts.draft || 0, color: '#94a3b8' },
        ].filter(item => item.value > 0);

        // 3. Simple Revenue Over Time
        const revenueHistory = [
          { name: 'W1', revenue: totalRevenue * 0.2 },
          { name: 'W2', revenue: totalRevenue * 0.45 },
          { name: 'W3', revenue: totalRevenue * 0.7 },
          { name: 'W4', revenue: totalRevenue },
        ];
        
        setData({
          stats: [
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, change: '+12.5%', icon: ArrowUpRight, trend: 'up', tab: 'reports' },
            { label: 'Total Expenses', value: `$${totalBurn.toLocaleString()}`, change: 'Current', icon: ArrowDownRight, trend: 'down', tab: 'expenses' },
            { label: 'Pending', value: `$${pendingRevenue.toLocaleString()}`, change: 'Current', icon: Clock, trend: 'neutral', tab: 'invoices' },
            { label: 'Collected', value: collectedCount.toString(), change: 'Invoices', icon: CheckCircle2, trend: 'up', tab: 'invoices' },
          ],
          statusBreakdown,
          revenueHistory,
          recentActivity: invoices.slice(0, 5)
        });
      } catch (err) {
        console.error("Dashboard data load failed", err);
      } finally {
        setLoading(false);
        // Delay chart activation to ensure container dimensions are finalized
        setTimeout(() => setIsReady(true), 400);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome & Quick Actions */}
      <div className="flex flex-col xl:flex-row gap-6 items-stretch">
        <div className="flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 sm:p-10 text-white relative overflow-hidden shadow-2xl shadow-blue-100 dark:shadow-none">
          <div className="absolute top-0 right-0 p-8 opacity-10 hidden md:block">
            <Sparkles size={160} />
          </div>
          <div className="relative z-10 space-y-8">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-[0.9] font-display italic">
                Welcome back, <br className="sm:hidden" />
                {(userSettings?.displayName || auth.currentUser?.displayName || auth.currentUser?.email)?.split(' ')[0]}!
              </h2>
              <p className="text-blue-100 font-medium text-base sm:text-lg mt-4 max-w-md">You have <span className="font-black underline decoration-2 underline-offset-4 decoration-blue-300">3 pending</span> invoices that need your attention.</p>
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
                className="px-6 py-4 bg-white/10 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/20 transition-all border border-white/20 flex items-center justify-center gap-3 text-xs"
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
            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-[2.5rem] hover:border-blue-200 dark:hover:border-blue-500/50 hover:shadow-2xl dark:hover:shadow-none transition-all group active:scale-95"
          >
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-700 dark:text-zinc-400">Add Client</span>
          </button>
          <button 
            onClick={() => onAction('settings')}
            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-[2.5rem] hover:border-blue-200 dark:hover:border-blue-500/50 hover:shadow-2xl dark:hover:shadow-none transition-all group active:scale-95"
          >
            <div className="w-12 h-12 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <SettingsIcon size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-700 dark:text-zinc-400">Setup</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {data.stats.map((stat: any, i: number) => (
          <button 
            key={i} 
            onClick={() => stat.tab && onAction(stat.tab)}
            className={cn(
              "dashboard-card border-l-4 p-5 group flex flex-col items-start text-left transition-all active:scale-95",
              stat.tab ? "hover:border-blue-500 hover:shadow-xl cursor-pointer" : "hover:border-gray-200 cursor-default",
              stat.trend === 'up' ? 'border-l-green-500' : 
              stat.trend === 'down' ? 'border-l-red-500' : 
              'border-l-blue-500'
            )}
          >
            <div className="flex items-start justify-between w-full gap-2">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-1 truncate">{stat.label}</p>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">{stat.value}</h3>
                {stat.tab && (
                  <div className="mt-2 flex items-center gap-1 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[8px] font-black uppercase tracking-tighter">Enter Section</span>
                    <ArrowUpRight size={10} />
                  </div>
                )}
              </div>
              <div className={cn(
                "p-2 rounded-lg shrink-0 transition-transform group-hover:scale-110",
                stat.trend === 'up' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400' : 
                stat.trend === 'down' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 
                'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
              )}>
                <stat.icon size={18} />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Main Revenue Chart */}
        <div className="lg:col-span-2 dashboard-card min-h-[350px] sm:h-[450px] flex flex-col p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Revenue Overview</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-500 font-medium tracking-tight">Financial performance trend</p>
            </div>
            <div className="flex p-1 bg-gray-50 dark:bg-zinc-800 rounded-xl w-fit">
              <button className="px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm">Growth</button>
              <button className="px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">Volume</button>
            </div>
          </div>
          <div className="flex-1 min-h-[300px] w-full relative mt-4">
            {isReady && (
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={0} minHeight={0}>
                  <AreaChart data={data.revenueHistory} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} 
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      cursor={{ stroke: '#2563eb', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#2563eb" 
                      strokeWidth={4} 
                      strokeLinecap="round"
                      fillOpacity={1} 
                      fill="url(#colorRev)" 
                      activeDot={{ r: 8, strokeWidth: 0, fill: '#2563eb' }}
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Status Breakdown Circle */}
        <div className="dashboard-card flex flex-col min-h-[350px] sm:h-[450px] p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <PieChartIcon size={18} className="text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Invoice Status</h3>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-500 font-medium mb-6">Current distributions</p>
          
          <div className="flex-1 w-full relative min-h-[200px]">
            {isReady && (
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={0} minHeight={0}>
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
                      {data.statusBreakdown.map((entry: any, index: number) => (
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
              </div>
            )}
            {isReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900 dark:text-white">
                  {data.statusBreakdown.reduce((s: number, i: any) => s + i.value, 0)}
                </span>
                <span className="text-[8px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Total</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            {data.statusBreakdown.map((item: any) => (
              <div key={item.name} className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] font-bold text-gray-600 dark:text-zinc-400 truncate">{item.name}</span>
                <span className="text-[10px] font-black text-gray-400 dark:text-zinc-600 ml-auto">{item.value}</span>
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Recent Invoices</h3>
          </div>
          <button className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition">View Full List</button>
        </div>
        <div className="space-y-4">
          {data.recentActivity.length === 0 ? (
            <div className="py-8 text-center text-gray-400 dark:text-zinc-600 font-medium italic">No recent activity found.</div>
          ) : (
            data.recentActivity.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-zinc-800 group">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg transition-transform group-hover:scale-110",
                  inv.status === 'paid' 
                    ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400' 
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600'
                )}>
                  {inv.clientName?.charAt(0)}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{inv.clientName}</h4>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium">#{inv.invoiceNumber} • {new Date(inv.dueDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-900 dark:text-white">${inv.total?.toLocaleString()}</p>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-tighter",
                    inv.status === 'paid' ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-zinc-600'
                  )}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
