import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/erp/Card';
import { Button } from '../../../components/ui/erp/Button';
import { Calendar, Users, AlertTriangle, Plus, UserX, Clock, BookOpen, AlertCircle, ChevronLeft, ChevronRight, Filter, Video, MapPin, X, Book, FileText } from 'lucide-react';
import { getCurrentUser } from '../../../lib/auth';
import { 
  getGlobalTimetable, GlobalTimetableSlot, 
  getLeaveRequests, LeaveRequestData, 
  saveTimetableSlot, deleteTimetableSlot, 
  getBatchesList, getErpUsers, updateLeaveStatus,
  getErpModules
} from '../../../lib/api/manager';
import { getCoursesFull } from '../../../lib/api/cms';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().split('T')[0];
};

const renderClassTags = (classItem: GlobalTimetableSlot, batches: any[], isOnline: boolean) => {
  try {
    const cList = JSON.parse(classItem.course_name || '[]');
    const bMap = JSON.parse(classItem.batch_id || '{}');
    if (Array.isArray(cList) && cList.length > 0) {
      return (
        <div className="flex flex-col gap-1.5">
          {cList.map((c: string) => {
            const batchNames = (bMap[c] || []).map((bid: string) => batches.find((b: any) => b.id === bid)?.name || bid).join(', ');
            return (
              <div key={c} className="leading-tight">
                <div className={`text-[9px] font-extrabold uppercase truncate ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'}`}>{c}</div>
                <div className="text-[11px] font-bold text-erp-text truncate">{batchNames || 'No Batches'}</div>
              </div>
            );
          })}
        </div>
      );
    }
    throw new Error('Fallback');
  } catch {
    return (
      <>
        <div className="font-bold text-xs text-erp-text truncate leading-tight">{classItem.batch_name || classItem.batch_id}</div>
        <div className={`text-[10px] font-bold mt-1 truncate ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'}`}>
          {classItem.course_name}
        </div>
      </>
    );
  }
};

export default function TimetableManager() {
  const currentUser = getCurrentUser();
  const [activeTab, setActiveTab] = useState<'calendar' | 'leaves'>('calendar');
  
  const [schedule, setSchedule] = useState<GlobalTimetableSlot[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequestData[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));

  // Filters
  const [filterCourse, setFilterCourse] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');

  // Modals
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Partial<GlobalTimetableSlot> | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<Record<string, string[]>>({});

  const openModal = (slot?: Partial<GlobalTimetableSlot>) => {
    if (!slot) {
      setEditingSlot({ day_of_week: 'Monday', start_time: '09:00', end_time: '10:00', timing: 'Offline', status: 'one-time', week_start: currentWeekStart });
      setSelectedCourses([]);
      setSelectedBatches({});
    } else {
      setEditingSlot(slot);
      try {
        setSelectedCourses(JSON.parse(slot.course_name || '[]'));
      } catch {
        setSelectedCourses(slot.course_name ? [slot.course_name] : []);
      }
      try {
        setSelectedBatches(JSON.parse(slot.batch_id || '{}'));
      } catch {
        setSelectedBatches(slot.batch_id && slot.course_name ? { [slot.course_name]: [slot.batch_id] } : {});
      }
    }
    setIsSlotModalOpen(true);
  };

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequestData | null>(null);
  const [substituteTeacher, setSubstituteTeacher] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [s, l, b, t, c, m] = await Promise.all([
      getGlobalTimetable({ course: filterCourse, teacher: filterTeacher, weekStart: currentWeekStart }),
      getLeaveRequests(),
      getBatchesList(),
      getErpUsers(),
      getCoursesFull(),
      getErpModules()
    ]);
    
    // Apply client side filtering for module if needed (assuming course_name stores module or we just match strings)
    let finalSchedule = s || [];
    if (filterModule) {
       finalSchedule = finalSchedule.filter(slot => slot.course_name?.includes(filterModule));
    }
    
    setSchedule(finalSchedule);
    setLeaves(l || []);
    setBatches(b || []);
    setTeachers(t || []);
    setCourses((c as any)?.courses || []);
    setModules(m || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterCourse, filterTeacher, filterModule, currentWeekStart]);

  const [saving, setSaving] = useState(false);

  const handleSaveSlot = async () => {
    if (!editingSlot) return;
    if (!editingSlot.teacher_id) {
      alert("Please select a teacher.");
      return;
    }
    if (!editingSlot.day_of_week) {
      alert("Please select a day of week.");
      return;
    }
    if (!editingSlot.start_time) {
      alert("Please select a start time.");
      return;
    }

    setSaving(true);
    try {
      const slotToSave = {
        ...editingSlot,
        start_time: editingSlot.start_time || '09:00',
        end_time: editingSlot.end_time || '10:00',
        course_name: JSON.stringify(selectedCourses),
        batch_id: JSON.stringify(selectedBatches),
        timing: editingSlot.timing || 'Offline',
        status: editingSlot.status || 'one-time',
        week_start: editingSlot.week_start || currentWeekStart
      };
      
      const success = await saveTimetableSlot(slotToSave);
      if (success) {
        setIsSlotModalOpen(false);
        setEditingSlot(null);
        await fetchData();
      } else {
        alert("Failed to save class slot. Please check your connection.");
      }
    } catch (err: any) {
      console.error('Failed to save slot:', err);
      alert('Error saving class: ' + (err?.message || 'Database connection error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (confirm("Are you sure you want to delete this schedule slot?")) {
      await deleteTimetableSlot(id);
      setIsSlotModalOpen(false);
      setEditingSlot(null);
      fetchData();
    }
  };

  const handleApproveLeave = async (leaveId: string) => {
    await updateLeaveStatus(leaveId, 'Approved');
    fetchData();
  };

  const handleAssignSubstitute = async () => {
    if (selectedLeave && substituteTeacher) {
      await updateLeaveStatus(selectedLeave.id, 'Substitute Assigned');
      setIsAssignModalOpen(false);
      setSubstituteTeacher('');
      fetchData();
    }
  };

  const isClassAlerting = (teacherId: string, day: string) => {
    return leaves.some(l => 
      l.user_id === teacherId && 
      (new Date(l.date).toLocaleDateString('en-US', { weekday: 'long' }) === day || l.date.includes(day)) && 
      l.status === 'Approved'
    );
  };

  const getDurationHours = (start: string, end: string) => {
    if (!start || !end) return 1;
    const startHour = parseInt(start.split(':')[0]);
    const endHour = parseInt(end.split(':')[0]);
    return Math.max(1, endHour - startHour);
  };

  return (
    <div className="flex flex-col w-full bg-erp-background">
      <div className="flex flex-col p-4 md:p-8 min-w-0 pb-32">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
              <Calendar className="w-8 h-8 text-erp-primary" /> Global Scheduler
            </h1>
            <p className="text-erp-text/70 font-medium mt-1">Manage weekly timetables, concurrent classes, and teacher leaves dynamically.</p>
          </div>
          <Button onClick={() => openModal()} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Schedule Class
          </Button>
        </div>

        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-erp-surface border border-erp-border p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl"><BookOpen className="w-6 h-6 text-blue-500" /></div>
            <div>
              <p className="text-sm font-bold text-erp-text/50">Weekly Classes</p>
              <h3 className="text-2xl font-bold text-erp-text">{schedule.length}</h3>
            </div>
          </Card>
          <Card className="bg-erp-surface border border-erp-border p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl"><Users className="w-6 h-6 text-emerald-500" /></div>
            <div>
              <p className="text-sm font-bold text-erp-text/50">Active Batches</p>
              <h3 className="text-2xl font-bold text-erp-text">{new Set(schedule.map(s => s.batch_id)).size}</h3>
            </div>
          </Card>
          <Card className="bg-erp-surface border border-erp-border p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-xl"><Clock className="w-6 h-6 text-amber-500" /></div>
            <div>
              <p className="text-sm font-bold text-erp-text/50">Classes Today</p>
              <h3 className="text-2xl font-bold text-erp-text">{schedule.filter(s => s.day_of_week === DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]).length}</h3>
            </div>
          </Card>
          <Card className="bg-erp-surface border border-erp-border p-4 flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 rounded-xl"><UserX className="w-6 h-6 text-rose-500" /></div>
            <div>
              <p className="text-sm font-bold text-erp-text/50">Leaves Pending</p>
              <h3 className="text-2xl font-bold text-rose-600">{leaves.filter(l => l.status === 'Pending').length}</h3>
            </div>
          </Card>
        </div>

        <div className="flex gap-4 mb-6 border-b border-erp-border">
          <button
            className={`pb-2 px-1 font-bold ${activeTab === 'calendar' ? 'text-erp-primary border-b-2 border-erp-primary' : 'text-erp-text/50 hover:text-erp-text'}`}
            onClick={() => setActiveTab('calendar')}
          >
            Weekly Calendar
          </button>
          <button
            className={`pb-2 px-1 font-bold ${activeTab === 'leaves' ? 'text-erp-primary border-b-2 border-erp-primary' : 'text-erp-text/50 hover:text-erp-text'}`}
            onClick={() => setActiveTab('leaves')}
          >
            Leaves & Substitutes
            {leaves.filter(l => l.status === 'Pending' || l.status === 'Approved').length > 0 && (
              <span className={`ml-2 text-white text-[10px] px-2 py-0.5 rounded-full font-bold ${leaves.some(l => l.status === 'Approved') ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}>
                {leaves.filter(l => l.status === 'Pending' || l.status === 'Approved').length} Action Reqd
              </span>
            )}
          </button>
        </div>

        {activeTab === 'calendar' && (
          <div className="bg-erp-surface border-2 border-erp-border rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 border-b border-erp-border bg-erp-background/50 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <h2 className="font-bold text-lg text-erp-text">
                  Week of {new Date(currentWeekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </h2>
                <div className="flex items-center bg-erp-background border border-erp-border rounded-lg overflow-hidden">
                  <button 
                    onClick={() => {
                      const d = new Date(currentWeekStart);
                      d.setDate(d.getDate() - 7);
                      setCurrentWeekStart(d.toISOString().split('T')[0]);
                    }}
                    className="p-1.5 hover:bg-erp-primary/10 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-erp-text" />
                  </button>
                  <div className="w-px h-4 bg-erp-border"></div>
                  <button 
                    onClick={() => setCurrentWeekStart(getMonday(new Date()))}
                    className="px-3 py-1 text-xs font-bold text-erp-primary hover:bg-erp-primary/10 transition-colors"
                  >
                    TODAY
                  </button>
                  <div className="w-px h-4 bg-erp-border"></div>
                  <button 
                    onClick={() => {
                      const d = new Date(currentWeekStart);
                      d.setDate(d.getDate() + 7);
                      setCurrentWeekStart(d.toISOString().split('T')[0]);
                    }}
                    className="p-1.5 hover:bg-erp-primary/10 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-erp-text" />
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-erp-background border border-erp-border rounded-lg px-3 py-1">
                  <Book className="w-4 h-4 text-erp-text/50" />
                  <select 
                    value={filterCourse}
                    onChange={e => setFilterCourse(e.target.value)}
                    className="bg-transparent text-sm font-bold text-erp-text outline-none w-32"
                  >
                    <option value="">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                  </select>
                </div>
                
                <div className="flex items-center gap-2 bg-erp-background border border-erp-border rounded-lg px-3 py-1">
                  <FileText className="w-4 h-4 text-erp-text/50" />
                  <select 
                    value={filterModule}
                    onChange={e => setFilterModule(e.target.value)}
                    className="bg-transparent text-sm font-bold text-erp-text outline-none w-32"
                  >
                    <option value="">All Modules</option>
                    {modules.map(m => <option key={m.id} value={m.title}>{m.title}</option>)}
                  </select>
                </div>
                
                <div className="flex items-center gap-2 bg-erp-background border border-erp-border rounded-lg px-3 py-1">
                  <Users className="w-4 h-4 text-erp-text/50" />
                  <select 
                    value={filterTeacher}
                    onChange={e => setFilterTeacher(e.target.value)}
                    className="bg-transparent text-sm font-bold text-erp-text outline-none w-32"
                  >
                    <option value="">All Teachers</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto relative">
              {loading && <div className="absolute inset-0 bg-erp-surface/80 backdrop-blur-sm z-50 flex items-center justify-center font-bold text-erp-primary">Loading Schedule...</div>}
              <div className="min-w-[1200px]">
                {/* Header Row */}
                <div className="grid grid-cols-8 border-b-2 border-erp-border bg-erp-surface shadow-sm relative z-10">
                  <div className="p-3 border-r border-erp-border font-bold text-xs text-erp-text/50 text-center uppercase">Time</div>
                  {DAYS.map(day => (
                    <div key={day} className="p-3 border-r border-erp-border font-bold text-sm text-erp-text text-center last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Time Slots */}
                {TIME_SLOTS.map(time => (
                  <div key={time} className="grid grid-cols-8 border-b border-erp-border/50 group hover:bg-erp-primary/5 transition-colors">
                    <div className="p-3 border-r border-erp-border text-xs font-bold text-erp-text/50 text-center sticky left-0 bg-erp-surface group-hover:bg-erp-primary/5">
                      {time}
                    </div>
                    
                    {DAYS.map(day => {
                      const classItems = schedule.filter(s => {
                        const isTimeMatch = (s.start_time === time || s.start_time?.startsWith(time.split(':')[0]));
                        if (!isTimeMatch) return false;
                        
                        if (s.status === 'ongoing') {
                          // Ongoing classes appear Mon-Fri regardless of their initial day_of_week
                          return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day);
                        }
                        return s.day_of_week === day;
                      });
                      
                      return (
                        <div 
                          key={`${day}-${time}`} 
                          className="border-r border-erp-border/50 last:border-r-0 p-2 flex flex-wrap gap-2 content-start cursor-pointer hover:bg-erp-primary/10 transition-colors"
                          style={{ minHeight: '100px' }}
                          onClick={(e) => {
                            if (e.target === e.currentTarget) {
                              setEditingSlot({ day_of_week: day, start_time: time, end_time: String(parseInt(time) + 1) + ":00" });
                              setIsSlotModalOpen(true);
                            }
                          }}
                        >
                          {classItems.map(classItem => {
                            const alerting = isClassAlerting(classItem.teacher_id, day);
                            const isOnline = classItem.timing?.toLowerCase().includes('online') || classItem.timing?.includes('zoom');
                            const durationHrs = getDurationHours(classItem.start_time, classItem.end_time);
                            
                            return (
                              <div 
                                key={classItem.id}
                                className={`w-full rounded-xl p-2 z-10 border-2 flex flex-col justify-between shadow-sm cursor-pointer hover:shadow-md transition-shadow
                                  ${alerting 
                                    ? 'bg-red-50 dark:bg-red-950/40 border-red-500 animate-[pulse_1.5s_ease-in-out_infinite]' 
                                    : isOnline 
                                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60' 
                                      : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60'
                                  }`}
                                style={{ minHeight: `${Math.max(80, durationHrs * 80)}px` }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSlot(classItem);
                                  setIsSlotModalOpen(true);
                                }}
                                title={alerting ? "URGENT: Teacher absent!" : ""}
                              >
                                <div className="flex-1 overflow-hidden">
                                  {renderClassTags(classItem, batches, isOnline)}
                                  <div className="text-[10px] font-bold text-erp-text/60 mt-1">
                                    {classItem.start_time} - {classItem.end_time} ({durationHrs} hr{durationHrs > 1 ? 's' : ''})
                                  </div>
                                </div>
                                <div className="mt-2 pt-1 border-t border-black/5 flex flex-col gap-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-erp-text/70 truncate">
                                    <div className="flex items-center gap-1">
                                      <Users className="w-3 h-3" />
                                      <span className={alerting ? "text-red-600" : ""}>{alerting ? "ABSENT" : classItem.teacher_name || classItem.teacher_id}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-erp-primary">
                                      {isOnline ? <Video className="w-3 h-3 text-emerald-500"/> : <MapPin className="w-3 h-3 text-blue-500"/>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaves' && (
          <div className="bg-erp-surface border border-erp-border rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-erp-background/50 border-b-2 border-erp-border">
                <tr>
                  <th className="p-4 font-bold text-erp-text/50 uppercase text-[10px] tracking-wider">Teacher</th>
                  <th className="p-4 font-bold text-erp-text/50 uppercase text-[10px] tracking-wider">Date</th>
                  <th className="p-4 font-bold text-erp-text/50 uppercase text-[10px] tracking-wider">Reason</th>
                  <th className="p-4 font-bold text-erp-text/50 uppercase text-[10px] tracking-wider">Status</th>
                  <th className="p-4 font-bold text-erp-text/50 uppercase text-[10px] tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-erp-border/50">
                {leaves.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-erp-text/40 font-bold">No leave requests found.</td></tr>
                ) : leaves.map(leave => (
                  <tr key={leave.id} className="hover:bg-erp-primary/5 transition-colors">
                    <td className="p-4 font-bold text-erp-text flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-erp-primary/10 flex items-center justify-center text-erp-primary text-xs">
                        {(leave.teacher_name || 'U')[0]}
                      </div>
                      {leave.teacher_name}
                    </td>
                    <td className="p-4 font-bold text-erp-text/70">{leave.date}</td>
                    <td className="p-4 text-sm font-medium text-erp-text/80">{leave.reason}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide flex items-center gap-1.5 w-fit ${
                        leave.status === 'Approved' ? 'bg-red-100 text-red-700 dark:text-white animate-pulse border border-red-200' :
                        leave.status === 'Substitute Assigned' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        {leave.status === 'Approved' && <AlertCircle className="w-3 h-3" />}
                        {leave.status === 'Approved' ? 'Needs Substitute' : leave.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {leave.status === 'Pending' && (
                        <Button size="sm" onClick={() => handleApproveLeave(leave.id)} className="bg-amber-500 hover:bg-amber-600 text-white">Approve Leave</Button>
                      )}
                      {leave.status === 'Approved' && (
                        <Button 
                          size="sm" 
                          className="bg-rose-500 hover:bg-rose-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]"
                          onClick={() => { setSelectedLeave(leave); setIsAssignModalOpen(true); }}
                        >
                          Assign Sub
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Slot Editor Modal */}
      {isSlotModalOpen && editingSlot && (
        <div className="fixed inset-0 bg-erp-text/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="max-w-md md:max-w-lg w-full border-2 border-erp-border shadow-2xl max-h-[85vh] overflow-y-auto rounded-3xl my-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold font-display text-erp-text">{editingSlot.id ? 'Edit Class' : 'Schedule Class'}</h2>
                <button onClick={() => setIsSlotModalOpen(false)}><X className="w-5 h-5 text-erp-text/50 hover:text-red-500"/></button>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-2">Day</label>
                    <select 
                      className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors"
                      value={editingSlot.day_of_week}
                      onChange={(e) => setEditingSlot({...editingSlot, day_of_week: e.target.value})}
                    >
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-2">From</label>
                    <input 
                      type="time"
                      className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors"
                      value={editingSlot.start_time}
                      onChange={(e) => setEditingSlot({...editingSlot, start_time: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-2">To</label>
                    <input 
                      type="time"
                      className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors"
                      value={editingSlot.end_time || ''}
                      onChange={(e) => setEditingSlot({...editingSlot, end_time: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-2">Course</label>
                    <select 
                      className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors"
                      value={selectedCourses.find(c => courses.some(co => co.title === c)) || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const mod = selectedCourses.find(c => modules.some(m => m.title === c));
                        setSelectedCourses([val, mod].filter(Boolean) as string[]);
                        if (!val) setSelectedBatches({});
                      }}
                    >
                      <option value="">Select Course...</option>
                      {courses.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-2">Module</label>
                    <select 
                      className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors"
                      value={selectedCourses.find(c => modules.some(m => m.title === c)) || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const course = selectedCourses.find(c => courses.some(co => co.title === c));
                        setSelectedCourses([course, val].filter(Boolean) as string[]);
                      }}
                    >
                      <option value="">Select Module...</option>
                      {modules.map(m => <option key={m.id} value={m.title}>{m.title}</option>)}
                    </select>
                  </div>
                </div>

                {/* Batch Dropdown Selector */}
                <div className="bg-erp-primary/5 p-4 rounded-xl border border-erp-primary/10 mt-4 space-y-3">
                  <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider">
                    Select Batches for Class
                  </label>
                  
                  {/* Dropdown Menu */}
                  <select
                    className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors cursor-pointer"
                    value=""
                    onChange={(e) => {
                      const bId = e.target.value;
                      if (!bId) return;

                      const bObj = batches.find(b => b.id === bId);
                      // Determine course name to assign batch under
                      let activeCourse = selectedCourses.find(c => courses.some(co => co.title === c));
                      if (!activeCourse) {
                        const matchingCourse = courses.find(c => c.id === bObj?.course_id || c.title === bObj?.course_id);
                        activeCourse = matchingCourse ? matchingCourse.title : (courses[0]?.title || 'General');
                        setSelectedCourses([activeCourse]);
                      }

                      const currentBatches = selectedBatches[activeCourse] || [];
                      if (!currentBatches.includes(bId)) {
                        setSelectedBatches(prev => ({
                          ...prev,
                          [activeCourse]: [...currentBatches, bId]
                        }));
                      }
                    }}
                  >
                    <option value="">Select a Batch from Dropdown ({batches.length} Available)...</option>
                    {batches.map(b => {
                      let courseInfo = '';
                      if (b.course_id) {
                        const matchedCourse = courses.find(c => c.id === b.course_id || c.title === b.course_id);
                        courseInfo = matchedCourse ? matchedCourse.title : b.course_id;
                      }
                      return (
                        <option key={b.id} value={b.id}>
                          {b.name} {courseInfo ? `(${courseInfo})` : ''}
                        </option>
                      );
                    })}
                  </select>

                  {/* Selected Batches Badges Display */}
                  {Object.entries(selectedBatches).some(([_, ids]) => (ids || []).length > 0) ? (
                    <div className="space-y-2 pt-2 border-t border-erp-primary/10">
                      <p className="text-[11px] font-extrabold text-erp-primary uppercase tracking-wider">
                        Selected Batches for Class ({Object.values(selectedBatches).flat().length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(selectedBatches).map(([cName, bIds]) =>
                          (bIds || []).map(bId => {
                            const bObj = batches.find(b => b.id === bId);
                            return (
                              <span 
                                key={`${cName}-${bId}`} 
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-erp-primary text-white text-xs font-bold shadow-sm animate-in fade-in transition-all"
                              >
                                <span>{bObj ? bObj.name : bId}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = (selectedBatches[cName] || []).filter(id => id !== bId);
                                    setSelectedBatches(prev => ({ ...prev, [cName]: updated }));
                                  }}
                                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                                  title="Remove batch"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Clean Quick Select Buttons */}
                  {selectedCourses.some(sc => courses.find(c => c.title === sc)) && (
                    <div className="space-y-2 pt-2 border-t border-erp-primary/10">
                      {selectedCourses.filter(sc => courses.find(c => c.title === sc)).map(courseName => {
                        const currentCourseBatches = selectedBatches[courseName] || [];
                        const cObj = courses.find(c => c.title === courseName);
                        const kw = courseName.toLowerCase().split(' ')[0];
                        const matchingBatches = batches.filter(b => {
                          if (!b.course_id) return true;
                          const bCid = String(b.course_id).toLowerCase();
                          return b.course_id === courseName || b.course_id === cObj?.id || bCid.includes((cObj?.id || '').toLowerCase()) || bCid.includes(kw);
                        });
                        const listToRender = matchingBatches.length > 0 ? matchingBatches : batches.slice(0, 5);

                        return (
                          <div key={courseName} className="space-y-1">
                            <p className="text-[10px] font-bold text-erp-text/50 uppercase">Quick Pick for {courseName}:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {listToRender.map(b => {
                                const isSelected = currentCourseBatches.includes(b.id);
                                return (
                                  <button
                                    type="button"
                                    key={b.id}
                                    onClick={() => {
                                      const updated = isSelected 
                                        ? currentCourseBatches.filter(id => id !== b.id) 
                                        : [...currentCourseBatches, b.id];
                                      setSelectedBatches(prev => ({ ...prev, [courseName]: updated }));
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                      isSelected 
                                        ? 'bg-erp-primary text-white shadow-sm' 
                                        : 'bg-erp-surface border border-erp-border text-erp-text/70 hover:border-erp-primary/40'
                                    }`}
                                  >
                                    {isSelected ? '✓ ' : '+ '}{b.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-2">Teacher</label>
                    <select 
                      className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors"
                      value={editingSlot.teacher_id || ''}
                      onChange={(e) => setEditingSlot({...editingSlot, teacher_id: e.target.value})}
                    >
                      <option value="">Select Teacher...</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-2">Mode/Room</label>
                    <select 
                      className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors"
                      value={editingSlot.timing || 'Offline'}
                      onChange={(e) => setEditingSlot({...editingSlot, timing: e.target.value})}
                    >
                      <option value="Offline">Offline (Room)</option>
                      <option value="Online">Online (Zoom/Meet)</option>
                      <option value="Hybrid">Hybrid (Online + Offline)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-2">Status (Frequency)</label>
                  <select 
                    className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors"
                    value={editingSlot.status || 'one-time'}
                    onChange={(e) => setEditingSlot({...editingSlot, status: e.target.value, week_start: currentWeekStart})}
                  >
                    <option value="one-time">One-Time (This week only)</option>
                    <option value="weekly">Weekly (Every week on this day)</option>
                    <option value="ongoing">Ongoing (Every week, Mon-Fri)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-erp-border">
                {editingSlot.id && (
                  <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteSlot(editingSlot.id!)}>Delete</Button>
                )}
                <div className="flex-1"></div>
                <Button variant="secondary" onClick={() => setIsSlotModalOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleSaveSlot} disabled={saving}>{saving ? 'Saving...' : 'Save Class'}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Substitute Assignment Modal */}
      {isAssignModalOpen && selectedLeave && (
        <div className="fixed inset-0 bg-erp-text/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full border-2 border-erp-border shadow-xl">
            <div className="p-6">
              <h2 className="text-2xl font-bold font-display text-erp-text mb-4">Assign Substitute</h2>
              <p className="text-sm font-medium text-erp-text/70 mb-6">
                Assign a substitute teacher for <strong>{selectedLeave.teacher_name}</strong>'s classes on {selectedLeave.date}.
              </p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-2">Available Teachers</label>
                  <select 
                    className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-sm font-bold text-erp-text outline-none focus:border-erp-primary transition-colors"
                    value={substituteTeacher}
                    onChange={(e) => setSubstituteTeacher(e.target.value)}
                  >
                    <option value="">Select a teacher...</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-erp-border">
                <Button variant="secondary" className="flex-1" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleAssignSubstitute} disabled={!substituteTeacher}>Assign</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
