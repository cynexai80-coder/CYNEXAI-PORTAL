import React, { useEffect, useState } from 'react';
import { isTursoConfigured } from '../../lib/turso';
import { getAdminStats } from '../../lib/api/admin';
import { Card } from '../../components/ui/erp/Card';
import { Users, BookOpen, IndianRupee, TrendingUp } from 'lucide-react';
import { AttendanceButton } from '../../components/ui/AttendanceButton';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalSales: 0,
    totalRevenue: 0,
    activeStudents: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (isTursoConfigured) {
        const data = await getAdminStats();
        setStats(data);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-4 sm:px-6 lg:px-8 min-h-screen bg-erp-background pb-32">
      <AttendanceButton />
      <h1 className="text-3xl font-display font-bold text-erp-text mb-6">Admin Overview</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-erp-primary/10 border-erp-primary">
          <div className="flex items-center gap-2 text-erp-primary mb-2">
            <IndianRupee className="w-5 h-5" />
            <span className="font-bold text-xs uppercase">Revenue</span>
          </div>
          <div className="text-2xl font-bold text-erp-text">₹{stats.totalRevenue.toLocaleString()}</div>
        </Card>
        
        <Card className="bg-erp-secondary/10 border-erp-secondary">
          <div className="flex items-center gap-2 text-sky-700 dark:text-erp-secondary mb-2">
            <Users className="w-5 h-5" />
            <span className="font-bold text-xs uppercase">Leads</span>
          </div>
          <div className="text-2xl font-bold text-erp-text">{stats.totalLeads}</div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-erp-text/70 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-bold text-xs uppercase">Sales</span>
          </div>
          <div className="text-2xl font-bold text-erp-text">{stats.totalSales}</div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-erp-text/70 mb-2">
            <BookOpen className="w-5 h-5" />
            <span className="font-bold text-xs uppercase">Students</span>
          </div>
          <div className="text-2xl font-bold text-erp-text">{stats.activeStudents}</div>
        </Card>
      </div>

      <h2 className="text-xl font-bold text-erp-text mb-4">Quick Actions</h2>
      <div className="flex flex-col gap-3">
        <Card className="flex items-center justify-between cursor-pointer active:scale-95 transition-transform">
          <span className="font-bold">Manage Users (Roles)</span>
          <span className="text-erp-text/50">→</span>
        </Card>
        <Card className="flex items-center justify-between cursor-pointer active:scale-95 transition-transform">
          <span className="font-bold">Course Catalog</span>
          <span className="text-erp-text/50">→</span>
        </Card>
        <Card className="flex items-center justify-between cursor-pointer active:scale-95 transition-transform">
          <span className="font-bold">Batch Engine Settings</span>
          <span className="text-erp-text/50">→</span>
        </Card>
      </div>
    </div>
  );
}
