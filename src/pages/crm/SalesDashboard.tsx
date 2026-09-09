import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { getCurrentUser } from '../../lib/auth';
import { getCRMAnalytics } from '../../lib/api/crm';
import { Calendar, TrendingUp, Users, Target, Phone, Filter, Percent, Source } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AttendanceButton } from '../../components/ui/AttendanceButton';

const getStatusColor = (status: string) => {
  switch(status) {
    case 'Admission Completed': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800/30';
    case 'Closed Won': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30';
    case 'Closed Lost': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/30';
    case 'Interested': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/30';
    case 'Not Interested': return 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 border-rose-200 dark:border-rose-800/30';
    case 'Busy': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/30';
    case 'Not answering': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800/30';
    case 'Invalid number': return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-800/30';
    case 'New': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800/30';
    case 'Demo Scheduled': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/30';
    case 'Demo Completed': return 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400 border-teal-200 dark:border-teal-800/30';
    case 'Onboarding completed': return 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/30';
    default: return 'text-erp-text bg-erp-surface border-erp-border';
  }
};

export default function SalesDashboard() {
  const user = getCurrentUser();
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [chartData, setChartData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    activeAdmissions: 0,
    demoScheduled: 0,
    demoCompleted: 0,
    totalRevenue: 0,
    collectedRevenue: 0,
    leadSources: [] as {name: string, value: number}[],
    conversionRate: { overall: "0.0", demoToAdmission: "0.0" },
    statusCounts: [] as {name: string, value: number}[],
    executivePerformance: [] as {name: string, leadsAssigned: number, salesClosed: number}[]
  });
  
  useEffect(() => {
    // Load and crunch data
    const loadData = async () => {
      const endDateTime = endDate ? `${endDate}T23:59:59.999Z` : undefined;
      const startDateTime = startDate ? `${startDate}T00:00:00.000Z` : undefined;
      
      const isSalesHR = user?.role === 'Sales/HR';
      const analytics = await getCRMAnalytics(startDateTime, endDateTime, isSalesHR ? user.id : undefined);
      
      setMetrics({
        totalLeads: analytics.totalLeads,
        activeAdmissions: analytics.activeAdmissions,
        demoScheduled: analytics.demoScheduled,
        demoCompleted: analytics.demoCompleted,
        totalRevenue: analytics.totalRevenue,
        collectedRevenue: analytics.collectedRevenue,
        leadSources: analytics.leadSources || [],
        conversionRate: analytics.conversionRate || { overall: "0.0", demoToAdmission: "0.0" },
        statusCounts: analytics.statusCounts || [],
        executivePerformance: analytics.executivePerformance || []
      });

      // Use real data or empty array if none
      setChartData(analytics.monthlyData || []);
    };
    loadData();
  }, [startDate, endDate]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-20 md:pb-8">
        
        <AttendanceButton />
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text">Sales Dashboard</h1>
            <p className="text-erp-text/70 font-medium mt-1">Advanced metrics and pipeline performance</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-erp-surface p-2 rounded-xl border-2 border-erp-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-erp-text/50 uppercase">Start:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-erp-background border border-erp-border rounded-lg px-2 py-1 text-sm font-bold text-erp-text focus:outline-none focus:border-erp-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-erp-text/50 uppercase">End:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-erp-background border border-erp-border rounded-lg px-2 py-1 text-sm font-bold text-erp-text focus:outline-none focus:border-erp-primary"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Status Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="flex flex-col items-center justify-center p-4 border-erp-primary text-center">
            <div className="bg-erp-primary/10 p-3 rounded-full text-erp-primary mb-2">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Total Leads</p>
            <h3 className="text-2xl font-display font-bold text-erp-text">{metrics.totalLeads}</h3>
          </Card>
          
          {metrics.statusCounts.map(status => {
            const colorClass = getStatusColor(status.name);
            return (
              <Card key={status.name} className={`flex flex-col items-center justify-center p-4 border-2 text-center ${colorClass}`}>
                <h3 className="text-2xl font-display font-bold mb-1">{status.value}</h3>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">{status.name}</p>
              </Card>
            );
          })}
        </div>

        {/* Financial Metrics (Managers/CEO only) */}
        {(user?.role === 'Manager' || user?.role === 'CEO') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="flex items-center gap-4 bg-gradient-to-r from-green-50 to-green-100/50 border-green-200">
              <div className="bg-green-500 p-4 rounded-xl text-white shadow-lg shadow-green-500/30">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-green-700 dark:text-white/70 uppercase tracking-wider">Total Pipeline Value</p>
                <h3 className="text-3xl font-display font-bold text-green-800 dark:text-white">₹{metrics.totalRevenue.toLocaleString()}</h3>
              </div>
            </Card>
            
            <Card className="flex items-center gap-4 bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-200">
              <div className="bg-blue-500 p-4 rounded-xl text-white shadow-lg shadow-blue-500/30">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-700 dark:text-white/70 uppercase tracking-wider">Revenue Collected</p>
                <h3 className="text-3xl font-display font-bold text-blue-800 dark:text-white">₹{metrics.collectedRevenue.toLocaleString()}</h3>
              </div>
            </Card>
          </div>
        )}

        {/* Charts and Funnel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Revenue Chart */}
          {(user?.role === 'Manager' || user?.role === 'CEO') && (
            <Card className="col-span-1 lg:col-span-2">
              <h3 className="text-xl font-bold font-display text-erp-text mb-6">Revenue Performance</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{fill: '#333', fontWeight: 'bold'}} />
                    <YAxis tick={{fill: '#333', fontWeight: 'bold'}} />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontWeight: 'bold', border: '2px solid #e5e7eb' }} />
                    <Legend wrapperStyle={{ fontWeight: 'bold', paddingTop: '20px' }} />
                    <Bar dataKey="target" name="Target Revenue (₹)" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" name="Collected Revenue (₹)" fill="#b8ff22" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Pipeline Funnel */}
          <Card className={`col-span-1 ${(user?.role === 'Manager' || user?.role === 'CEO') ? '' : 'lg:col-span-3'} flex flex-col`}>
            <h3 className="text-xl font-bold font-display text-erp-text mb-6">Conversion Funnel</h3>
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="flex flex-col items-center">
                <div className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 flex justify-between items-center relative z-10 shadow-sm">
                  <span className="font-bold text-erp-text/70 text-sm">1. Leads Generated</span>
                  <span className="font-bold text-erp-text bg-white dark:bg-black px-2 py-1 rounded-md">{metrics.totalLeads}</span>
                </div>
                <div className="w-0.5 h-6 bg-erp-border"></div>
                
                <div className="w-5/6 bg-erp-surface border-2 border-erp-border rounded-xl p-3 flex justify-between items-center relative z-10 shadow-sm">
                  <span className="font-bold text-erp-text/70 text-sm">2. Demo Scheduled</span>
                  <span className="font-bold text-erp-text bg-white dark:bg-black px-2 py-1 rounded-md">{metrics.demoScheduled}</span>
                </div>
                <div className="w-0.5 h-6 bg-erp-border"></div>
                
                <div className="w-4/6 bg-erp-surface border-2 border-erp-border rounded-xl p-3 flex justify-between items-center relative z-10 shadow-sm">
                  <span className="font-bold text-erp-text/70 text-sm">3. Demo Completed</span>
                  <span className="font-bold text-erp-text bg-white dark:bg-black px-2 py-1 rounded-md">{metrics.demoCompleted}</span>
                </div>
                <div className="w-0.5 h-6 bg-erp-border"></div>
                
                <div className="w-3/6 bg-erp-primary text-white border-2 border-erp-primary rounded-xl p-3 flex justify-between items-center relative z-10 shadow-md transform hover:scale-105 transition-transform">
                  <span className="font-bold text-sm">4. Admissions</span>
                  <span className="font-bold bg-white dark:bg-black text-erp-primary px-2 py-1 rounded-md">{metrics.activeAdmissions}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Lead Sources & Conversion Rates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Conversion Rates */}
          <Card className="col-span-1">
            <h3 className="text-xl font-bold font-display text-erp-text mb-6">Conversion Rates</h3>
            <div className="flex flex-col gap-6">
              <div className="bg-erp-surface border-2 border-erp-border rounded-xl p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-xl text-blue-700 dark:text-white">
                    <Percent className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-erp-text text-lg">Overall Conversion</h4>
                    <p className="text-sm font-bold text-erp-text/50">Lead to Closed Won</p>
                  </div>
                </div>
                <h3 className="text-3xl font-display font-bold text-erp-primary">{metrics.conversionRate.overall}%</h3>
              </div>
              <div className="bg-erp-surface border-2 border-erp-border rounded-xl p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="bg-orange-100 p-3 rounded-xl text-orange-700">
                    <Target className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-erp-text text-lg">Demo Conversion</h4>
                    <p className="text-sm font-bold text-erp-text/50">Demo to Admission</p>
                  </div>
                </div>
                <h3 className="text-3xl font-display font-bold text-erp-primary">{metrics.conversionRate.demoToAdmission}%</h3>
              </div>
            </div>
          </Card>

          {/* Lead Sources */}
          <Card className="col-span-1">
            <h3 className="text-xl font-bold font-display text-erp-text mb-6">Lead Sources</h3>
            <div className="h-[250px] w-full flex justify-center items-center">
              {metrics.leadSources.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.leadSources}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {metrics.leadSources.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#4ade80', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', fontWeight: 'bold', border: '2px solid #e5e7eb' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-erp-text/50 font-bold">No lead sources data available.</p>
              )}
            </div>
          </Card>
        </div>
        
        {/* Executive Performance Table */}
        {(user?.role === 'Manager' || user?.role === 'CEO') && metrics.executivePerformance.length > 0 && (
          <Card className="mb-8 p-0 overflow-hidden border-2 border-erp-border">
            <div className="p-6 border-b-2 border-erp-border bg-slate-50 dark:bg-zinc-900/50">
              <h3 className="text-xl font-bold font-display text-erp-text">Sales Executive Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-erp-background/50">
                  <tr>
                    <th className="p-4 font-bold text-erp-text/70 uppercase text-xs tracking-wider">Executive Name</th>
                    <th className="p-4 font-bold text-erp-text/70 uppercase text-xs tracking-wider text-center">Leads Assigned</th>
                    <th className="p-4 font-bold text-erp-text/70 uppercase text-xs tracking-wider text-center">Sales Closed</th>
                    <th className="p-4 font-bold text-erp-text/70 uppercase text-xs tracking-wider text-right">Conversion %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-erp-border/50">
                  {metrics.executivePerformance.map((exec, idx) => (
                    <tr key={idx} className="hover:bg-erp-primary/5 transition-colors">
                      <td className="p-4 font-bold text-erp-text">{exec.name}</td>
                      <td className="p-4 text-center font-bold text-erp-text/70">{exec.leadsAssigned}</td>
                      <td className="p-4 text-center font-bold text-erp-primary">{exec.salesClosed}</td>
                      <td className="p-4 text-right font-bold text-erp-text/80">
                        {exec.leadsAssigned > 0 ? ((exec.salesClosed / exec.leadsAssigned) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
