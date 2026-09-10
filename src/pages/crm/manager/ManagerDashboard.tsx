import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingApprovals, PendingApproval, getManagerAnalytics } from '../../../lib/api/manager';
import { Card } from '../../../components/ui/erp/Card';
import { CheckCircle, Users, BookOpen, CheckSquare, Settings, Calendar, GraduationCap } from 'lucide-react';

import { AttendanceButton } from '../../../components/ui/AttendanceButton';

export default function ManagerDashboard() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalLeads: 0, totalRevenue: 0, classesCompleted: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    getPendingApprovals().then(setApprovals);
    getManagerAnalytics().then(setStats);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col px-2 py-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full min-w-0 overflow-y-auto pb-20 md:pb-8">
        <AttendanceButton />
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text">Manager Hub</h1>
            <p className="text-erp-text/70 font-medium mt-1">Global operations and analytics</p>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-erp-surface border-erp-border border-l-4 border-indigo-500 dark:border-indigo-400 p-4">
            <h3 className="text-xs font-bold text-erp-text/50 uppercase">Total Revenue</h3>
            <p className="text-2xl font-bold text-erp-text mt-1 font-mono">₹{stats.totalRevenue.toLocaleString()}</p>
          </Card>
          <Card className="bg-erp-surface border-erp-border border-l-4 border-emerald-500 dark:border-emerald-400 p-4">
            <h3 className="text-xs font-bold text-erp-text/50 uppercase">Active Students</h3>
            <p className="text-2xl font-bold text-erp-text mt-1">{stats.totalStudents}</p>
          </Card>
          <Card className="bg-erp-surface border-erp-border border-l-4 border-blue-500 dark:border-blue-400 p-4">
            <h3 className="text-xs font-bold text-erp-text/50 uppercase">Total Leads</h3>
            <p className="text-2xl font-bold text-erp-text mt-1">{stats.totalLeads}</p>
          </Card>
          <Card className="bg-erp-surface border-erp-border border-l-4 border-orange-500 dark:border-orange-400 p-4">
            <h3 className="text-xs font-bold text-erp-text/50 uppercase">Classes Completed</h3>
            <p className="text-2xl font-bold text-erp-text mt-1">{stats.classesCompleted}</p>
          </Card>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="flex flex-col items-center justify-center p-5 cursor-pointer hover:bg-erp-hover transition-colors border-erp-border card-hover" onClick={() => navigate('/manager/students')}>
            <GraduationCap className="w-7 h-7 text-indigo-500 mb-2" />
            <span className="font-bold text-erp-text text-xs text-center">Students</span>
          </Card>

          <Card className="flex flex-col items-center justify-center p-5 cursor-pointer hover:bg-erp-hover transition-colors border-erp-border card-hover" onClick={() => navigate('/manager/attendance')}>
            <Users className="w-7 h-7 text-emerald-500 mb-2" />
            <span className="font-bold text-erp-text text-xs text-center">Attendance</span>
          </Card>

          <Card className="flex flex-col items-center justify-center p-5 cursor-pointer hover:bg-erp-hover transition-colors border-erp-border card-hover" onClick={() => navigate('/manager/courses')}>
            <BookOpen className="w-7 h-7 text-erp-primary mb-2" />
            <span className="font-bold text-erp-text text-xs text-center">Course CMS</span>
          </Card>
          
          <Card className="flex flex-col items-center justify-center p-5 cursor-pointer hover:bg-erp-hover transition-colors border-erp-border card-hover" onClick={() => navigate('/manager/timetable')}>
            <Calendar className="w-7 h-7 text-purple-500 mb-2" />
            <span className="font-bold text-erp-text text-xs text-center">Timetable</span>
          </Card>
          
          <Card className="flex flex-col items-center justify-center p-5 cursor-pointer hover:bg-erp-hover transition-colors border-erp-border card-hover" onClick={() => navigate('/manager/users')}>
            <Users className="w-7 h-7 text-green-500 mb-2" />
            <span className="font-bold text-erp-text text-xs text-center">Staff Mgmt</span>
          </Card>
          
          <Card className="flex flex-col items-center justify-center p-5 cursor-pointer hover:bg-erp-hover transition-colors border-erp-border card-hover" onClick={() => navigate('/manager/tasks')}>
            <CheckSquare className="w-7 h-7 text-orange-500 mb-2" />
            <span className="font-bold text-erp-text text-xs text-center">Assign Tasks</span>
          </Card>
        </div>

        {/* Approvals Section */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold font-display text-erp-text">Pending Approvals</h2>
            <div className="bg-erp-primary text-white font-bold px-3 py-1 rounded-full text-xs">
              {approvals.length} Action Needed
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {approvals.length === 0 ? (
              <div className="col-span-full text-center p-10 text-erp-text/50 font-bold border-2 border-dashed border-erp-border rounded-3xl">
                You're all caught up!
              </div>
            ) : (
              approvals.map(app => (
                <Card key={app.id} className="cursor-pointer active:translate-y-1 active:shadow-none transition-transform" onClick={() => navigate(`/manager/approvals/${app.id}`)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-xl text-erp-text">{app.lead_name}</h3>
                      <p className="text-erp-text/70 font-medium text-sm">{app.course.toUpperCase()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="bg-erp-secondary/10 text-erp-secondary font-bold px-3 py-1 rounded-xl text-xs">
                        ₹{app.amount_paid} / ₹{app.total_fee}
                      </div>
                      {app.amount_paid >= app.total_fee && (
                        <div className="flex items-center text-green-500 text-[10px] font-bold">
                          <CheckCircle className="w-3 h-3 mr-1" /> FULLY PAID
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
