import React from 'react';
import { Card } from '../../../components/ui/erp/Card';
import { Button } from '../../../components/ui/erp/Button';
import { Settings, BrainCircuit, Gift, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { getManagerAnalytics } from '../../../lib/api/manager';
import { client, isTursoConfigured } from '../../../lib/turso';
import { getReferrals, getTotalPayroll } from '../../../lib/api/ceo';

export default function CEODashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = React.useState({ totalStudents: 0, totalLeads: 0, totalRevenue: 0, classesCompleted: 0 });
  const [referrals, setReferrals] = React.useState<any[]>([]);
  const [totalPayroll, setTotalPayroll] = React.useState<number>(0);

  React.useEffect(() => {
    getManagerAnalytics().then(setStats);
    
    if (isTursoConfigured && client) {
      getReferrals().then(setReferrals);
      getTotalPayroll().then(setTotalPayroll);
    }
  }, []);

  const conversionRate = stats.totalLeads > 0 ? ((stats.totalStudents / stats.totalLeads) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col px-2 py-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full min-w-0 overflow-y-auto pb-20 md:pb-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text">CEO Dashboard</h1>
            <p className="text-erp-text/70 font-medium mt-1">Global Academy Overview</p>
          </div>
          <Button className="flex items-center gap-2" variant="secondary" onClick={() => navigate('/ceo/settings')}>
            <Settings className="w-5 h-5" /> Dev Settings
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="flex flex-col border-t-erp-border border-r-erp-border border-b-erp-border border-l-4 border-l-green-500 dark:border-l-green-400">
            <h3 className="text-sm font-bold text-erp-text/50 uppercase">Total Revenue</h3>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-display font-bold text-erp-text font-mono">₹{stats.totalRevenue.toLocaleString()}</span>
            </div>
          </Card>
          
          <Card className="flex flex-col border-t-erp-border border-r-erp-border border-b-erp-border border-l-4 border-l-red-500 dark:border-l-red-400">
            <h3 className="text-sm font-bold text-erp-text/50 uppercase">Payroll / Staff</h3>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-display font-bold text-erp-text font-mono">₹{totalPayroll.toLocaleString()}</span>
            </div>
          </Card>
          
          <Card className="flex flex-col border-t-erp-border border-r-erp-border border-b-erp-border border-l-4 border-l-blue-500 dark:border-l-blue-400">
            <h3 className="text-sm font-bold text-erp-text/50 uppercase">Active Students</h3>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-display font-bold text-erp-text">{stats.totalStudents}</span>
            </div>
          </Card>

          <Card className="flex flex-col border-t-erp-border border-r-erp-border border-b-erp-border border-l-4 border-l-purple-500 dark:border-l-purple-400">
            <h3 className="text-sm font-bold text-erp-text/50 uppercase">Total Leads</h3>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-display font-bold text-erp-text">{stats.totalLeads}</span>
            </div>
          </Card>

          <Card className="flex flex-col border-t-erp-border border-r-erp-border border-b-erp-border border-l-4 border-l-blue-500 dark:border-l-blue-400">
            <h3 className="text-sm font-bold text-erp-text/50 uppercase">Conversion Rate</h3>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-3xl font-display font-bold text-erp-text">{conversionRate}%</span>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-blue-200 dark:border-blue-800/30 card-hover" onClick={() => navigate('/ceo/courses')}>
            <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" />
            <span className="font-bold text-erp-text text-sm text-center">Course Management</span>
          </Card>
          
          <Card className="flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-slate-50 dark:bg-zinc-900/50 dark:hover:bg-slate-800/50 transition-colors border-slate-200 dark:border-slate-700 card-hover" onClick={() => navigate('/ceo/settings')}>
            <Settings className="w-8 h-8 text-slate-600 dark:text-slate-400 mb-2" />
            <span className="font-bold text-erp-text text-sm text-center">Global Settings</span>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <Card className="border-t-erp-border border-r-erp-border border-b-erp-border border-l-4 border-l-blue-600 dark:border-l-blue-400">
            <h2 className="text-xl font-bold font-display text-erp-text mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-blue-500" /> Pending Referral Payouts
            </h2>
            <div className="space-y-4">
              {referrals.length === 0 ? <p className="text-sm text-erp-text/50 font-bold">No pending payouts.</p> : referrals.map(r => (
                <div key={r.id} className="flex justify-between items-center bg-erp-surface p-3 rounded-xl border border-erp-border">
                  <div>
                    <span className="font-bold text-sm block">Sale ID: {r.id}</span>
                    <span className="text-xs font-bold text-erp-text/50">Referred by: {r.referred_by_student_id}</span>
                  </div>
                  <Button className="h-8 text-xs bg-green-500 hover:bg-green-600">Mark Paid</Button>
                </div>
              ))}
            </div>
          </Card>
          
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
            <h2 className="text-xl font-bold font-display text-white mb-4 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-blue-400" /> AI Strategic Advisory
            </h2>
            <div className="space-y-4">
              <div className="bg-white/10 dark:bg-black/30 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <p className="text-sm text-blue-100 italic leading-relaxed font-medium">
                  "Based on last week's data, conversion rate is currently {conversionRate}%. I recommend assigning more tasks to follow up with Demo Leads to increase conversions, as there is a backlog in the 'Demo Scheduled' bucket."
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
