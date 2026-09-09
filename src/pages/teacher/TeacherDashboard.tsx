import React, { useState } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { Video, BookOpen, Users, Calendar, Play, Zap, AlertCircle, Filter, Settings, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../lib/auth';
import { AttendanceButton } from '../../components/ui/AttendanceButton';
import { getTeacherTimetables, getTeacherFirstCourse, getCourseModulesMap, getCourseClassesMap } from '../../lib/api/teacher';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseCourseJSON = (str: string) => {
  if (!str || str === '[]') return '';
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      return parsed.length > 0 ? parsed.join(', ') : '';
    }
    return str;
  } catch { return str; }
};

const parseBatchJSON = (str: string) => {
  if (!str || str === '[]') return '';
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
       return parsed.length > 0 ? parsed.join(', ') : '';
    }
    if (typeof parsed === 'object' && parsed !== null) {
       const allBatches = Object.values(parsed).flat() as string[];
       return allBatches.length > 0 ? [...new Set(allBatches)].join(', ') : '';
    }
    return str;
  } catch { return str; }
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const today = new Date().getDay();

  const [selectedDay, setSelectedDay] = useState(today === 0 || today === 6 ? 1 : today); // default to Mon if weekend
  const [selectedBatchId, setSelectedBatchId] = useState<string | 'all'>('all');
  const [realBatches, setRealBatches] = useState<any[]>([]);

  const [rawTimetable, setRawTimetable] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchTimetableAndProgress = async () => {
      import('../../lib/turso').then(async ({ client, isTursoConfigured }) => {
        if (!isTursoConfigured || !client) return;
        
        try {
          // Fetch timetable by user ID (teacher_id stores the user's id)
          let matchedRows = await getTeacherTimetables(user?.id || '');

          // If none found by ID, fall back to all timetables
          if (matchedRows.length === 0) {
            matchedRows = await getTeacherTimetables('');
          }

          const dayMap: Record<string, number> = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };
          
          const formattedTimetable = matchedRows.map((r: any) => ({
            id: r.id,
            batchId: r.batch_id,
            batchName: parseBatchJSON(r.batch_id),
            course: parseCourseJSON(r.course_name) || parseBatchJSON(r.batch_id),
            time: r.timing || `${r.start_time} - ${r.end_time}`,
            day: dayMap[r.day_of_week as string] || 1
          }));
          
          setRawTimetable(formattedTimetable.length > 0 ? formattedTimetable : []);

          // Fetch course + modules/progress independently (don't bail if course null)
          const course = await getTeacherFirstCourse(user?.id || '');
          if (!course) {
            // Still show batches from timetable even without a course
            const uniqueBatches: string[] = Array.from(new Set(formattedTimetable.map((t: any) => t.batchId as string)));
            setRealBatches(uniqueBatches.map((bId: string) => ({
              id: bId as string,
              name: parseBatchJSON(bId as string) || 'All Batches',
              course: formattedTimetable.find((t: any) => t.batchId === bId)?.course || 'Data Science with AI',
              progress: { modules: [] }
            })));
            return;
          }

          const mRows = await getCourseModulesMap(course.id as string);
          const cRows = await getCourseClassesMap(course.id as string);

          const dynamicModules = mRows.map((m: any) => {
            const mClasses = cRows.filter((c: any) => c.module_id === m.id);
            const completed = mClasses.filter((c: any) => c.status === 'completed').length;
            return {
              title: m.title,
              total: mClasses.length,
              completed: completed
            };
          });

          // Build batch list from timetable slots
          const uniqueBatches: string[] = Array.from(new Set(formattedTimetable.map((t: any) => t.batchId as string)));
          setRealBatches(uniqueBatches.map((bId: string) => ({
            id: bId as string,
            name: parseBatchJSON(bId as string) || 'All Batches',
            course: course.title,
            progress: { modules: dynamicModules }
          })));
        } catch(e) {
          console.error(e);
        }
      });
    };
    fetchTimetableAndProgress();
  }, [user?.id]);

  // Group timetable by day (1=Mon ... 5=Fri)
  const schedule: Record<number, any[]> = {};
  for (let d = 1; d <= 5; d++) {
    schedule[d] = rawTimetable.filter((t: any) => t.day === d && (selectedBatchId === 'all' || t.batchId === selectedBatchId));
  }

  // Find next class for today
  const todaySlots = schedule[selectedDay] || [];
  const nextClass = todaySlots.length > 0 ? todaySlots[0] : null;

  const displayBatches = selectedBatchId === 'all' 
    ? (realBatches.length > 0 ? realBatches : []) 
    : (realBatches.length > 0 ? realBatches : []).filter((b: any) => b.id === selectedBatchId);

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background subtle-watermark">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-32">
        <AttendanceButton />
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text">Teacher Portal</h1>
            <p className="text-erp-text/70 font-medium mt-1">{FULL_DAYS[today]}, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Quick Nav */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-erp-primary/5 transition-colors border-erp-primary" onClick={() => navigate('/teacher/live')}>
            <Video className="w-8 h-8 text-erp-primary mb-2" />
            <span className="font-bold text-erp-text text-sm text-center">Teacher Studio</span>
          </Card>
          <Card className="flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-purple-500/5 transition-colors" onClick={() => navigate('/teacher/cms')}>
            <BookOpen className="w-8 h-8 text-purple-400 mb-2" />
            <span className="font-bold text-erp-text text-sm text-center">Course CMS</span>
          </Card>
          <Card className="flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-green-500/5 transition-colors" onClick={() => navigate('/teacher/attendance')}>
            <Users className="w-8 h-8 text-green-400 mb-2" />
            <span className="font-bold text-erp-text text-sm text-center">Attendance</span>
          </Card>
          <Card className="flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-amber-500/5 transition-colors border-amber-500/30" onClick={() => navigate('/teacher/student-progress')}>
            <TrendingUp className="w-8 h-8 text-amber-500 mb-2" />
            <span className="font-bold text-erp-text text-sm text-center">Student Progress</span>
          </Card>
          <Card className="flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-blue-500/5 transition-colors" onClick={() => navigate('/teacher/timetable')}>
            <Calendar className="w-8 h-8 text-blue-400 mb-2" />
            <span className="font-bold text-erp-text text-sm text-center">My Schedule</span>
          </Card>
          <Card className="flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-violet-500/5 transition-colors" onClick={() => navigate('/teacher/settings')}>
            <Settings className="w-8 h-8 text-violet-400 mb-2" />
            <span className="font-bold text-erp-text text-sm text-center">AI Settings</span>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Upcoming Class Banner */}
            <Card className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-blue-800/50 p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <Zap className="w-5 h-5 text-yellow-500 dark:text-yellow-400 animate-pulse" />
                <h2 className="font-bold text-slate-900 dark:text-white text-lg">Next Upcoming Class</h2>
              </div>

              {nextClass ? (
                <div className="relative z-10">
                  <div className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-5 mb-5 backdrop-blur-sm">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-300 uppercase tracking-widest">{nextClass.batchName || 'Unassigned Batch'}</p>
                      <span className="text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full">{nextClass.time}</span>
                    </div>
                    <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">{nextClass.course || 'Ad-hoc Class'}</h3>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => navigate(`/teacher/live?classId=${nextClass.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white border-green-700 font-bold py-4 text-base"
                    >
                      <Video className="w-5 h-5" /> Launch Teacher Studio
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 py-4 relative z-10">
                  No upcoming classes scheduled today. You're all caught up!
                </div>
              )}
            </Card>

            {/* My Modules Progress */}
            <Card>
              <div className="p-4 border-b-2 border-erp-border flex items-center justify-between">
                <h2 className="font-bold text-erp-text flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-erp-primary" /> 
                  My Batches
                </h2>
                
                {/* BATCH FILTER */}
                <div className="flex items-center gap-2 bg-erp-background border border-erp-border rounded-lg p-1">
                  <Filter className="w-4 h-4 text-erp-text/50 ml-2" />
                  <select 
                    className="bg-transparent text-sm font-bold text-erp-text border-none outline-none cursor-pointer pr-2"
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                  >
                    <option value="all">All Batches</option>
                    {realBatches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name} - {b.course}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {displayBatches.length === 0 && (
                  <div className="text-center p-8 text-erp-text/50">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p>No batches assigned to you yet.</p>
                  </div>
                )}
                {displayBatches.map((b: any) => {
                  return (
                    <div key={b.id} className="bg-erp-background border border-erp-border rounded-xl p-4 transition-all hover:border-blue-500/30">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-erp-text text-lg">{b.name}</h3>
                          <p className="text-xs font-bold text-blue-600 mt-0.5">{b.course}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 space-y-4">
                        {b.progress.modules.map((mod: any, idx: number) => {
                          const percent = mod.total > 0 ? Math.round((mod.completed / mod.total) * 100) : 0;
                          return (
                            <div key={idx}>
                              <div className="flex justify-between text-xs font-bold text-erp-text/60 mb-1.5">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                                  {mod.title} Module
                                </span>
                                <span>{percent}% ({mod.completed} / {mod.total} Classes)</span>
                              </div>
                              <div className="h-2 w-full bg-erp-border rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" 
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right Column: Weekly Schedule */}
          <div className="lg:col-span-1" id="weekly-timetable">
            <Card className="sticky top-6 h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
              <div className="p-4 border-b-2 border-erp-border">
                <h2 className="font-bold text-erp-text flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Weekly Timetable
                </h2>
              </div>
              
              <div className="flex p-2 border-b border-erp-border overflow-x-auto no-scrollbar">
                {DAYS.map((day, idx) => {
                  if (idx === 0 || idx === 6) return null; // Hide Sat/Sun since classes are Mon-Fri
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(idx)}
                      className={`flex-1 min-w-[3rem] py-2 flex flex-col items-center justify-center rounded-lg transition-colors ${selectedDay === idx ? 'bg-blue-600 text-white shadow-md' : 'text-erp-text/60 hover:bg-erp-primary/5'}`}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider">{day}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(!schedule[selectedDay] || schedule[selectedDay].length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-erp-text/40 py-8">
                    <Calendar className="w-12 h-12 mb-3 opacity-20" />
                    <p className="font-medium text-sm">No classes scheduled</p>
                  </div>
                ) : (
                  (schedule[selectedDay] || []).map((slot: any, i: number) => {
                    const [startStr] = slot.time.toLowerCase().split('-');
                    let hr = parseInt(startStr.replace(/[a-z]/g, '').split(':')[0]);
                    const isPm = slot.time.toLowerCase().includes('pm');
                    if (startStr.includes('am')) {} 
                    else if (isPm && hr < 12) hr += 12;
                    else if (hr === 12 && !isPm && !slot.time.toLowerCase().includes('pm')) hr = 0; // rough am/pm
                    
                    let status = 'Upcoming';
                    let statusColor = 'text-orange-600 bg-orange-500/10';
                    let canStart = false;

                    const now = new Date();
                    let currentDay = now.getDay(); // 0=Sun
                    if (currentDay === 0) currentDay = 7; // Treat Sunday as end of week 7
                    // For logic: Mon=1..Fri=5, Sat=6, Sun=7
                    
                    const slotDay = slot.day; // 1=Mon .. 5=Fri
                    
                    if (slotDay < currentDay) {
                      status = 'Completed';
                      statusColor = 'text-slate-500 bg-slate-500/10';
                    } else if (slotDay === currentDay) {
                      const currentHour = now.getHours() + now.getMinutes() / 60;
                      if (hr < currentHour - 1) { // ended 1hr after start
                        status = 'Completed';
                        statusColor = 'text-slate-500 bg-slate-500/10';
                      } else if (hr <= currentHour + 1) { // within 1 hour
                        status = 'Live Now';
                        statusColor = 'text-green-600 bg-green-500/10 animate-pulse';
                        canStart = true;
                      } else {
                        status = 'Today';
                        statusColor = 'text-blue-600 bg-blue-500/10';
                        canStart = true;
                      }
                    } else {
                      canStart = true;
                    }

                    return (
                      <div key={i} className={`border-l-4 ${status === 'Live Now' ? 'border-green-500' : status === 'Completed' ? 'border-slate-300 dark:border-white/10 opacity-60' : 'border-indigo-500'} bg-erp-background border border-erp-border border-l-4 rounded-xl p-4 hover:shadow-md transition-shadow`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-erp-text/50">{slot.time}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor}`}>{status}</span>
                        </div>
                        <h3 className="font-bold text-erp-text mb-1">{slot.course || 'Ad-hoc Class'}</h3>
                        <p className="text-xs font-medium text-indigo-600">{slot.batchName || 'Unassigned Batch'}</p>
                        
                        {canStart && (
                          <Button 
                            onClick={() => navigate(`/teacher/live?classId=${slot.id}`)}
                            variant={status === 'Live Now' ? 'primary' : 'secondary'}
                            className={`w-full mt-4 py-2 text-xs flex items-center justify-center gap-1.5 ${status === 'Live Now' ? 'bg-green-600 hover:bg-green-500 border-green-700 text-white' : ''}`}
                          >
                            <Play className="w-3 h-3" /> Start Class
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
