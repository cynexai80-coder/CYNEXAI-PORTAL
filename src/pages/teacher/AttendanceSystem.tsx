import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { 
  QrCode, Video, Users, CheckCircle, Copy, ExternalLink, 
  RefreshCw, Search, UserCheck, UserX, Clock, Sparkles, ShieldCheck, 
  Laptop, MapPin, Layers, Download, Grid, Table, FileSpreadsheet,
  BookOpen, Filter, Check, X, ChevronLeft, ChevronRight, Calendar as CalendarIcon
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCurrentUser } from '../../lib/auth';
import { 
  getActiveLiveClass, 
  getAllAvailableClasses, 
  logAttendance, 
  removeAttendance, 
  getLiveAttendance,
  getAllAttendanceLogsMatrix,
  logStudentAttendanceForDate,
  bulkLogAttendanceForDate,
  removeStudentAttendanceForDate
} from '../../lib/api/teacher';
import { getAllBatches, BatchItem } from '../../lib/api/batches';
import { getCoursesFull } from '../../lib/api/cms';
import { getManagerStudents } from '../../lib/api/student';
import { getUsers } from '../../lib/api/users';
import { generateQRAttendance, QRCodeResult } from '../../lib/api/ux';
import { QRCodeSVG } from 'qrcode.react';
import { isPresentLog, isPendingLog } from '../../lib/attendanceUtils';
import { StaffAttendanceModal } from '../../components/crm/attendance/StaffAttendanceModal';
import { notify } from '../../lib/feedback';


const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AttendanceSystem() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useMemo(() => getCurrentUser(), []);
  const userId = user?.id;

  const today = useMemo(() => new Date(), []);
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayDateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // View state: 'matrix' (Spreadsheet Grid) | 'roster' (Live Roster & QR) | 'calendar' (Class Calendar)
  const initialView = searchParams.get('view') === 'calendar' ? 'calendar' : 'matrix';
  const [viewMode, setViewMode] = useState<'matrix' | 'roster' | 'calendar'>(initialView);

  // Calendar View State
  const [calYear, setCalYear] = useState<number>(today.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string>(searchParams.get('date') || todayDateStr);
  const [calendarSelectedClassId, setCalendarSelectedClassId] = useState<string>('default');
  const [showStaffModal, setShowStaffModal] = useState<boolean>(false);

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(searchParams.get('batch') || 'all');
  const [activeClass, setActiveClass] = useState<any>(null);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [matrixLogs, setMatrixLogs] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [qrData, setQrData] = useState<QRCodeResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'pending' | 'absent'>('all');
  const [matrixFilterCourse, setMatrixFilterCourse] = useState<string>('all');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  // Class column windowing & navigation state (Prev/Next buttons for moving front or backward through 28+ classes)
  const [classStartIndex, setClassStartIndex] = useState<number>(0);
  const [classPageSize, setClassPageSize] = useState<number | 'all'>(15);

  // Selected batch metadata
  const selectedBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatchId || b.name === selectedBatchId);
  }, [batches, selectedBatchId]);

  const batchMode = selectedBatch?.mode || 'Hybrid';

  // Sync live attendance logs & full matrix logs from database
  const syncAttendanceFromDB = useCallback(async (classId?: string, batchName?: string) => {
    try {
      setSyncing(true);
      const [logs, matrixData] = await Promise.all([
        getLiveAttendance(classId || 'default', batchName).catch(() => []),
        getAllAttendanceLogsMatrix().catch(() => [])
      ]);
      setLiveLogs(logs || []);
      setMatrixLogs(matrixData || []);
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.error('Error syncing attendance from DB:', e);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Initial load of batches, classes, courses, matrix logs, and student list
  useEffect(() => {
    let isMounted = true;

    async function initData() {
      try {
        setLoading(true);
        const [batchList, primaryClass, classList, managerStudents, allUsers, matrixLogsData, coursesData] = await Promise.all([
          getAllBatches().catch(() => []),
          getActiveLiveClass(userId || 'teacher').catch(() => null),
          getAllAvailableClasses().catch(() => []),
          getManagerStudents().catch(() => []),
          getUsers().catch(() => []),
          getAllAttendanceLogsMatrix().catch(() => []),
          getCoursesFull().catch(() => ({ courses: [], modules: [], classes: [] }))
        ]);

        if (!isMounted) return;

        setBatches(batchList || []);
        setSelectedBatchId('all');

        setAvailableClasses(classList || []);
        const currentClass = primaryClass || (classList && classList.length > 0 ? classList[0] : null);
        setActiveClass(currentClass);
        setMatrixLogs(matrixLogsData || []);
        setCourses(coursesData?.courses || []);

        // Load all students: prefer manager students from Turso DB
        let loadedStudents: any[] = [];
        if (managerStudents && managerStudents.length > 0) {
          const usersByEmail = new Map((allUsers || []).map((u: any) => [u.email?.toLowerCase(), u]));
          loadedStudents = managerStudents.map((s: any) => {
            const u = usersByEmail.get(s.email?.toLowerCase()) || usersByEmail.get(s.portal_login_email?.toLowerCase());
            return {
              ...s,
              avatar: u?.avatar || s.avatar,
              role: u?.role || 'Student',
              classes_attended_json: s.classes_attended_json || u?.classes_attended_json
            };
          });
        } else if (allUsers && allUsers.length > 0) {
          loadedStudents = (allUsers || []).filter((u: any) => 
            !u.role || u.role.toLowerCase() === 'student' || u.student_code || u.batch_number || u.classes_attended_json
          );
        }

        if (loadedStudents.length > 0) {
          setStudents(loadedStudents);
        } else {
          setStudents([]);
        }

        await syncAttendanceFromDB(currentClass?.id || 'default', 'all');
      } catch (e) {
        console.error('Error initializing attendance system:', e);
        if (isMounted) setStudents([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initData();

    return () => {
      isMounted = false;
    };
  }, [userId, syncAttendanceFromDB]);

  // Periodic silent polling every 8s for real-time DB sync
  useEffect(() => {
    const classId = activeClass?.id || 'default';
    const batchName = selectedBatch?.name;

    const interval = setInterval(() => {
      syncAttendanceFromDB(classId, batchName);
    }, 8000);

    return () => clearInterval(interval);
  }, [activeClass?.id, selectedBatch?.name, syncAttendanceFromDB]);

  // Handle switching selected batch
  const handleSelectBatch = async (batchId: string) => {
    setSelectedBatchId(batchId);
    setClassStartIndex(0);
    setQrData(null);
    const targetBatch = batches.find(b => b.id === batchId || b.name === batchId);
    await syncAttendanceFromDB(activeClass?.id || 'default', targetBatch?.name);
  };

  // Handle switching selected class
  const handleSelectClass = async (classId: string) => {
    const selected = availableClasses.find(c => c.id === classId) || activeClass;
    if (selected) {
      setActiveClass(selected);
      setQrData(null);
      await syncAttendanceFromDB(selected.id, selectedBatch?.name);
    }
  };

  const handleGenerateQR = async () => {
    const sessionToken = activeClass?.id || selectedBatch?.id || 'batch_session';
    try {
      const data = await generateQRAttendance(sessionToken);
      setQrData(data);
    } catch (e) {
      console.error('Error generating QR:', e);
    }
  };

  const handleMarkPresent = async (studentId: string, targetClassId?: string) => {
    const classId = targetClassId || activeClass?.id || 'default';
    try {
      await logAttendance(studentId, classId, 'Manual');
      await syncAttendanceFromDB(classId, selectedBatch?.name);
    } catch (e) {
      console.error('Failed to mark present:', e);
    }
  };

  const handleMarkAbsent = async (studentId: string, targetClassId?: string) => {
    const classId = targetClassId || activeClass?.id || 'default';
    try {
      await removeAttendance(studentId, classId);
      await syncAttendanceFromDB(classId, selectedBatch?.name);
    } catch (e) {
      console.error('Failed to mark absent:', e);
    }
  };

  // Toggle Matrix Cell (P <-> A)
  const handleToggleMatrixCell = async (studentId: string, classId: string, currentIsPresent: boolean) => {
    try {
      if (currentIsPresent) {
        setMatrixLogs(prev => prev.filter(l => !(l.student_id === studentId && (l.class_id === classId || l.batch_id === classId))));
        setLiveLogs(prev => prev.filter(l => !(l.student_id === studentId && (l.class_id === classId || l.batch_id === classId))));
        await removeAttendance(studentId, classId);
      } else {
        const newLog = {
          id: `opt_${Date.now()}`,
          student_id: studentId,
          class_id: classId,
          batch_id: classId,
          status: 'Present',
          duration_minutes: 60,
          attendance_type: 'Manual',
          join_time: new Date().toISOString()
        };
        setMatrixLogs(prev => [...prev.filter(l => !(l.student_id === studentId && (l.class_id === classId || l.batch_id === classId))), newLog]);
        await logAttendance(studentId, classId, 'Manual');
      }
      await syncAttendanceFromDB(activeClass?.id || 'default', selectedBatch?.name);
    } catch (e) {
      console.error('Error toggling matrix cell:', e);
      await syncAttendanceFromDB(activeClass?.id || 'default', selectedBatch?.name);
    }
  };

  const handleMarkAllPresent = async () => {
    const targetClassId = activeClass?.id || 'default';
    if (batchStudents.length === 0) return;
    try {
      setSyncing(true);
      const absentStudents = batchStudents.filter(s => {
        const log = presentStudentMap.get(s.id) || presentStudentMap.get(s.email?.toLowerCase());
        const isPresent = isPresentLog(log);
        return !isPresent;
      });
      await Promise.all(absentStudents.map(s => logAttendance(s.id, targetClassId, 'Manual')));
      await syncAttendanceFromDB(targetClassId, selectedBatch?.name);
    } catch (e) {
      console.error('Failed to mark all present:', e);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyMeetLink = () => {
    const link = (activeClass?.meet_link as string) || '';
    if (!link) {
      notify('No meeting link is set for this class. Add one in the Course CMS first.');
      return;
    }
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Map of present student IDs / Emails to live attendance logs
  const presentStudentMap = useMemo(() => {
    const map = new Map<string, any>();
    liveLogs.forEach(log => {
      if (log.student_id) map.set(log.student_id, log);
      if (log.student_email) map.set(log.student_email.toLowerCase(), log);
    });
    return map;
  }, [liveLogs]);

  // Combined matrix log map for all classes: key = `${studentId}_${classId}`
  const matrixLogsMap = useMemo(() => {
    const map = new Map<string, { isPresent: boolean; status: string; log: any }>();

    liveLogs.forEach(log => {
      if (log.student_id && (log.class_id || log.batch_id)) {
        const classIdKey = log.class_id || log.batch_id;
        const isPresent = isPresentLog(log);
        map.set(`${log.student_id}_${classIdKey}`, { isPresent, status: isPresent ? 'Present' : 'Absent', log });
        if (log.student_email) {
          map.set(`${log.student_email.toLowerCase()}_${classIdKey}`, { isPresent, status: isPresent ? 'Present' : 'Absent', log });
        }
      }
    });

    matrixLogs.forEach(log => {
      const studentIdKey = log.student_id;
      const classIdKey = log.class_id || log.batch_id;
      if (studentIdKey && classIdKey) {
        const isPresent = isPresentLog(log);
        map.set(`${studentIdKey}_${classIdKey}`, { isPresent, status: isPresent ? 'Present' : 'Absent', log });
      }
    });

    return map;
  }, [liveLogs, matrixLogs]);

  // Filter students strictly by selected batch
  const batchStudents = useMemo(() => {
    if (selectedBatchId === 'all' || !selectedBatch) return students;
    const cleanSelectedBatchName = selectedBatch.name.trim().toLowerCase().replace(/\s*\([^)]*\)/g, '');
    const cleanSelectedId = selectedBatch.id.trim().toLowerCase();
    const extractNum = (str: string) => {
      const m = str.match(/\d+/);
      return m ? m[0] : '';
    };
    const selectedNum = extractNum(cleanSelectedBatchName) || extractNum(cleanSelectedId);

    return students.filter(s => {
      const studentBatch = String(s.batch_number || s.batch_name || s.batch || '').trim().toLowerCase();
      if (!studentBatch) return false;
      const cleanStudentBatch = studentBatch.replace(/\s*\([^)]*\)/g, '');
      const studentNum = extractNum(cleanStudentBatch);

      // When both sides carry a batch number, the number alone decides ('Batch 1' must NOT match 'Batch 10').
      if (selectedNum && studentNum) return selectedNum === studentNum;

      return (
        cleanStudentBatch === cleanSelectedBatchName ||
        cleanStudentBatch.includes(cleanSelectedBatchName) ||
        cleanSelectedBatchName.includes(cleanStudentBatch) ||
        studentBatch === cleanSelectedId
      );
    });
  }, [students, selectedBatchId, selectedBatch]);

  // Filtered students for Matrix & Roster view by search query
  const filteredStudents = useMemo(() => {
    return batchStudents.filter(s => {
      const matchesSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (s.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (s.student_code || '').toLowerCase().includes(searchQuery.toLowerCase());
      const log = presentStudentMap.get(s.id) || presentStudentMap.get(s.email?.toLowerCase());
      const isPresent = isPresentLog(log);
      const isPending = isPendingLog(log);
      const isAbsent = !isPresent && !isPending;

      if (filterStatus === 'present') return matchesSearch && isPresent;
      if (filterStatus === 'pending') return matchesSearch && isPending;
      if (filterStatus === 'absent') return matchesSearch && isAbsent;
      return matchesSearch;
    });
  }, [batchStudents, searchQuery, filterStatus, presentStudentMap]);

  // Metrics for batch
  const totalStudentsCount = batchStudents.length;

  const presentCount = useMemo(() => {
    return batchStudents.filter(s => {
      const log = presentStudentMap.get(s.id) || presentStudentMap.get(s.email?.toLowerCase());
      if (!log) return false;
      return isPresentLog(log);
    }).length;
  }, [batchStudents, presentStudentMap]);

  const pendingCount = useMemo(() => {
    return batchStudents.filter(s => {
      const log = presentStudentMap.get(s.id) || presentStudentMap.get(s.email?.toLowerCase());
      if (!log) return false;
      return isPendingLog(log);
    }).length;
  }, [batchStudents, presentStudentMap]);

  const absentCount = Math.max(0, totalStudentsCount - presentCount - pendingCount);
  const presentPercentage = totalStudentsCount > 0 ? Math.round((presentCount / totalStudentsCount) * 100) : 0;

  // Group classes by Course/Subject for Matrix View (Format as shown in Image 2!)
  const courseClassesGrouped = useMemo(() => {
    const groups: { [courseTitle: string]: any[] } = {};

    if (availableClasses && availableClasses.length > 0) {
      availableClasses.forEach((cls) => {
        const courseTitle = cls.module_title || cls.course_title || selectedBatch?.course_name || 'Curriculum';
        if (matrixFilterCourse !== 'all' && courseTitle.toLowerCase() !== matrixFilterCourse.toLowerCase()) {
          return;
        }
        if (!groups[courseTitle]) {
          groups[courseTitle] = [];
        }
        groups[courseTitle].push({
          ...cls,
          classNum: groups[courseTitle].length + 1,
          courseTitle
        });
      });
    }

    return groups;
  }, [availableClasses, selectedBatch, matrixFilterCourse]);

  // Flat array of all classes in active filter
  const allFlatClasses = useMemo(() => {
    const flatList: any[] = [];
    Object.entries(courseClassesGrouped).forEach(([courseName, classesList]) => {
      classesList.forEach(cls => {
        flatList.push({ ...cls, courseName });
      });
    });
    return flatList;
  }, [courseClassesGrouped]);

  // Windowed visible classes for front/backward pagination (Moving front or backward through 28+ classes!)
  const visibleClasses = useMemo(() => {
    if (classPageSize === 'all') return allFlatClasses;
    const size = Number(classPageSize) || 8;
    return allFlatClasses.slice(classStartIndex, classStartIndex + size);
  }, [allFlatClasses, classStartIndex, classPageSize]);

  // Group visible classes by course for table column headers
  const visibleCourseGroups = useMemo(() => {
    const groups: { [courseName: string]: any[] } = {};
    visibleClasses.forEach(cls => {
      const name = cls.courseName || cls.module_title || 'Course';
      if (!groups[name]) groups[name] = [];
      groups[name].push(cls);
    });
    return groups;
  }, [visibleClasses]);

  // ── DATE-BASED CALENDAR ATTENDANCE HELPERS ──
  const getStudentDateStatus = useCallback((studentId: string, studentEmail: string | undefined, classId: string, dateStr: string) => {
    const match = matrixLogs.find(l => {
      const isStudentMatch = l.student_id === studentId || 
                             (studentEmail && l.student_id?.toLowerCase() === studentEmail.toLowerCase());
      if (!isStudentMatch) return false;
      const isClassMatch = !classId || classId === 'default' || l.class_id === classId || l.batch_id === classId;
      if (!isClassMatch) return false;
      const logDate = l.date || (l.join_time ? l.join_time.substring(0, 10) : '');
      return logDate === dateStr;
    });

    if (!match) return 'Unmarked';
    return isPresentLog(match) ? 'Present' : 'Absent';
  }, [matrixLogs]);

  const handleToggleDateStudent = async (studentId: string, classId: string, dateStr: string, targetStatus: 'Present' | 'Absent') => {
    const currentStatus = getStudentDateStatus(studentId, undefined, classId, dateStr);
    const newStatus = currentStatus === targetStatus ? 'Unmarked' : targetStatus;
    
    // Optimistic update
    setMatrixLogs(prev => {
      const filtered = prev.filter(l => {
        const isStudentMatch = l.student_id === studentId;
        const isClassMatch = !classId || classId === 'default' || l.class_id === classId || l.batch_id === classId;
        const logDate = l.date || (l.join_time ? l.join_time.substring(0, 10) : '');
        return !(isStudentMatch && isClassMatch && logDate === dateStr);
      });
      if (newStatus === 'Unmarked') return filtered;
      return [
        ...filtered,
        {
          id: `opt_date_${Date.now()}_${Math.random()}`,
          student_id: studentId,
          class_id: classId,
          batch_id: classId,
          date: dateStr,
          join_time: `${dateStr}T10:00:00.000Z`,
          duration_minutes: newStatus === 'Present' ? 60 : 0,
          status: newStatus,
          attendance_type: 'Manual'
        }
      ];
    });

    try {
      if (newStatus === 'Unmarked') {
        await removeStudentAttendanceForDate(studentId, classId, dateStr);
      } else {
        await logStudentAttendanceForDate(studentId, classId, dateStr, newStatus, 'Manual');
      }
      syncAttendanceFromDB(classId, selectedBatch?.name);
    } catch (e) {
      console.error('Error updating student date attendance:', e);
      syncAttendanceFromDB(classId, selectedBatch?.name);
    }
  };

  const handleBulkMarkDatePresent = async (classId: string, dateStr: string) => {
    if (batchStudents.length === 0) return;
    setSyncing(true);
    try {
      const records = batchStudents.map(s => ({
        studentId: s.id,
        classId,
        date: dateStr,
        status: 'Present' as const
      }));
      setMatrixLogs(prev => {
        const studentIds = new Set(batchStudents.map(s => s.id));
        const filtered = prev.filter(l => {
          const isTarget = studentIds.has(l.student_id) && (!classId || classId === 'default' || l.class_id === classId || l.batch_id === classId) && (l.date === dateStr || l.join_time?.startsWith(dateStr));
          return !isTarget;
        });
        const newEntries = batchStudents.map(s => ({
          id: `opt_bulk_${Date.now()}_${s.id}`,
          student_id: s.id,
          class_id: classId,
          batch_id: classId,
          date: dateStr,
          join_time: `${dateStr}T10:00:00.000Z`,
          duration_minutes: 60,
          status: 'Present',
          attendance_type: 'Manual'
        }));
        return [...filtered, ...newEntries];
      });

      await bulkLogAttendanceForDate(records);
      await syncAttendanceFromDB(classId, selectedBatch?.name);
    } catch (e) {
      console.error('Error bulk marking date present:', e);
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkMarkDateAbsent = async (classId: string, dateStr: string) => {
    if (batchStudents.length === 0) return;
    setSyncing(true);
    try {
      const records = batchStudents.map(s => ({
        studentId: s.id,
        classId,
        date: dateStr,
        status: 'Absent' as const
      }));
      setMatrixLogs(prev => {
        const studentIds = new Set(batchStudents.map(s => s.id));
        const filtered = prev.filter(l => {
          const isTarget = studentIds.has(l.student_id) && (!classId || classId === 'default' || l.class_id === classId || l.batch_id === classId) && (l.date === dateStr || l.join_time?.startsWith(dateStr));
          return !isTarget;
        });
        const newEntries = batchStudents.map(s => ({
          id: `opt_bulk_${Date.now()}_${s.id}`,
          student_id: s.id,
          class_id: classId,
          batch_id: classId,
          date: dateStr,
          join_time: `${dateStr}T10:00:00.000Z`,
          duration_minutes: 0,
          status: 'Absent',
          attendance_type: 'Manual'
        }));
        return [...filtered, ...newEntries];
      });

      await bulkLogAttendanceForDate(records);
      await syncAttendanceFromDB(classId, selectedBatch?.name);
    } catch (e) {
      console.error('Error bulk marking date absent:', e);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearDateAttendance = async (classId: string, dateStr: string) => {
    if (batchStudents.length === 0) return;
    setSyncing(true);
    try {
      setMatrixLogs(prev => {
        const studentIds = new Set(batchStudents.map(s => s.id));
        return prev.filter(l => {
          const isTarget = studentIds.has(l.student_id) && (!classId || classId === 'default' || l.class_id === classId || l.batch_id === classId) && (l.date === dateStr || l.join_time?.startsWith(dateStr));
          return !isTarget;
        });
      });
      for (const s of batchStudents) {
        await removeStudentAttendanceForDate(s.id, classId, dateStr);
      }
      await syncAttendanceFromDB(classId, selectedBatch?.name);
    } catch (e) {
      console.error('Error clearing date attendance:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Calendar dates matrix for the selected month (calYear, calMonth)
  const classCalendarDays = useMemo(() => {
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const firstDayIndex = new Date(calYear, calMonth - 1, 1).getDay(); // 0 is Sun

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
      isFuture: boolean;
      presentCount: number;
      absentCount: number;
      totalMarked: number;
    }> = [];

    const padZero = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`;

    // Prev month padding
    const prevMonthDays = new Date(calYear, calMonth - 1, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevM = calMonth === 1 ? 12 : calMonth - 1;
      const prevY = calMonth === 1 ? calYear - 1 : calYear;
      const dStr = `${prevY}-${padZero(prevM)}-${padZero(dNum)}`;
      days.push({
        dateStr: dStr,
        dayNum: dNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isWeekend: false,
        isFuture: dStr > todayStr,
        presentCount: 0,
        absentCount: 0,
        totalMarked: 0
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${calYear}-${padZero(calMonth)}-${padZero(d)}`;
      const dayOfWeek = new Date(calYear, calMonth - 1, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Count attendance for this date in batchStudents
      let presentCount = 0;
      let absentCount = 0;

      batchStudents.forEach(s => {
        const st = getStudentDateStatus(s.id, s.email, calendarSelectedClassId, dStr);
        if (st === 'Present') presentCount++;
        else if (st === 'Absent') absentCount++;
      });

      days.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isWeekend,
        isFuture: dStr > todayStr,
        presentCount,
        absentCount,
        totalMarked: presentCount + absentCount
      });
    }

    // Next month padding to 42 cells
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = calMonth === 12 ? 1 : calMonth + 1;
      const nextY = calMonth === 12 ? calYear + 1 : calYear;
      const dStr = `${nextY}-${padZero(nextM)}-${padZero(d)}`;
      days.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isWeekend: false,
        isFuture: dStr > todayStr,
        presentCount: 0,
        absentCount: 0,
        totalMarked: 0
      });
    }

    return days;
  }, [calYear, calMonth, today, batchStudents, getStudentDateStatus, calendarSelectedClassId]);

  // Statistics for the selected calendar date
  const selectedDateStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    batchStudents.forEach(s => {
      const st = getStudentDateStatus(s.id, s.email, calendarSelectedClassId, calendarSelectedDate);
      if (st === 'Present') present++;
      else if (st === 'Absent') absent++;
    });
    const total = batchStudents.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, rate };
  }, [batchStudents, getStudentDateStatus, calendarSelectedClassId, calendarSelectedDate]);

  // List of all course titles for filter dropdown
  const availableCourseNames = useMemo(() => {
    const set = new Set<string>();
    availableClasses.forEach(c => {
      if (c.module_title) set.add(c.module_title);
    });
    if (set.size === 0) {
      set.add('Python');
      set.add('SQL');
      set.add('AI');
      set.add('Excel');
      set.add('ML');
      set.add('Power BI');
    }
    return Array.from(set);
  }, [availableClasses]);

  // Export ALL Attendance Matrix (All 28+ Classes) to CSV File
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      notify('No student records available to export.');
      return;
    }

    const batchName = selectedBatch ? selectedBatch.name : 'All Batches';
    const filename = `Attendance_Report_${batchName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    let csvContent = `Student ID,Student Name,Email,Batch,`;
    allFlatClasses.forEach((cls) => {
      csvContent += `"${cls.courseName} - ${cls.title || 'Class ' + cls.classNum}",`;
    });
    csvContent += `Total Present,Total Absent,Attendance Rate (%)\n`;

    filteredStudents.forEach((student, idx) => {
      const studentCode = student.student_code || student.id || `STU-${idx + 1}`;
      const studentName = `"${(student.name || 'Student').replace(/"/g, '""')}"`;
      const email = `"${(student.email || '').replace(/"/g, '""')}"`;
      const batch = `"${(student.batch_number || selectedBatch?.name || 'Global').replace(/"/g, '""')}"`;

      let studentPresentCount = 0;
      let studentAbsentCount = 0;
      let rowClassesStr = '';

      allFlatClasses.forEach(cls => {
        const key = `${student.id}_${cls.id}`;
        const emailKey = `${student.email?.toLowerCase()}_${cls.id}`;
        const record = matrixLogsMap.get(key) || matrixLogsMap.get(emailKey);
        const isPresent = record?.isPresent;

        if (isPresent) {
          studentPresentCount++;
          rowClassesStr += `"P",`;
        } else {
          studentAbsentCount++;
          rowClassesStr += `"A",`;
        }
      });

      const totalClasses = allFlatClasses.length;
      const rate = totalClasses > 0 ? Math.round((studentPresentCount / totalClasses) * 100) : 0;

      csvContent += `${studentCode},${studentName},${email},${batch},${rowClassesStr}${studentPresentCount},${studentAbsentCount},${rate}%\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const meetUrl = (activeClass?.meet_link as string) || '';

  const currentWindowSize = classPageSize === 'all' ? allFlatClasses.length : Number(classPageSize) || 8;

  const backPortalRoute = user?.role === 'CEO' ? '/ceo/dashboard' : user?.role === 'Manager' ? '/manager' : '/teacher';
  const roleBadgeLabel = user?.role === 'CEO' ? 'CEO Portal' : user?.role === 'Manager' ? 'Manager Portal' : 'Teacher Portal';

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-32 p-4 md:p-8 bg-erp-background subtle-watermark">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
              {roleBadgeLabel}
            </span>
          </div>
          <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3 whitespace-nowrap">
            <Users className="w-8 h-8 text-blue-500 shrink-0" /> 
            <span>Batch Attendance & Matrix System</span>
          </h1>
          <p className="text-xs text-erp-text/60 font-medium mt-1">
            Real-time batch matrix across all 28+ classes, column navigation, P/A badges, and automated 5-minute stay tracking.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setShowStaffModal(true)}
            variant="outline"
            size="md"
            className="flex items-center gap-2 font-bold shadow-xs text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10 cursor-pointer"
          >
            <CalendarIcon className="w-4 h-4 text-blue-500" />
            Staff Office Attendance Calendar
          </Button>

          <Button 
            onClick={handleExportCSV} 
            variant="primary" 
            size="md"
            className="flex items-center gap-2 font-bold shadow-md bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export All Classes (CSV)
          </Button>
          <Button onClick={() => navigate(backPortalRoute)} variant="secondary" size="md">
            Back to Portal
          </Button>
        </div>
      </div>

      {/* View Mode Tabs: 'matrix' vs 'roster' vs 'calendar' */}
      <div className="flex items-center gap-2 bg-erp-surface border border-erp-border p-1.5 rounded-2xl mb-6 shadow-xs w-fit flex-wrap">
        <button
          onClick={() => setViewMode('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            viewMode === 'matrix' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-erp-text/70 hover:text-erp-text hover:bg-erp-background'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Batch & Course Attendance Matrix (Grid)
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            viewMode === 'calendar' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-erp-text/70 hover:text-erp-text hover:bg-erp-background'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          Interactive Class Calendar
        </button>
        <button
          onClick={() => setViewMode('roster')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            viewMode === 'roster' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-erp-text/70 hover:text-erp-text hover:bg-erp-background'
          }`}
        >
          <Table className="w-4 h-4" />
          Live Roster & QR Session
        </button>
      </div>

      {/* Active Batch & Class Control Card */}
      <Card className="bg-erp-surface border-erp-border p-5 mb-8 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Batch Focus
            </span>

            {/* Mode Badge */}
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded border flex items-center gap-1 ${
              batchMode === 'Online'
                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30'
                : batchMode === 'Offline'
                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/30'
                : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30'
            }`}>
              {batchMode === 'Online' ? <Laptop className="w-3 h-3" /> : batchMode === 'Offline' ? <MapPin className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {batchMode} Mode
            </span>

            {activeClass?.status && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                Class: {activeClass.status}
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-erp-text/70 font-medium text-sm animate-pulse">Loading batch and class session...</p>
          ) : (
            <div className="min-w-0">
              <h2 className="text-xl font-black text-erp-text truncate flex items-center gap-2">
                {selectedBatch ? selectedBatch.name : 'All Batches'}
                {selectedBatch?.course_name && (
                  <span className="text-xs font-bold text-erp-text/60">({selectedBatch.course_name})</span>
                )}
              </h2>
              <p className="text-xs text-erp-text/60 font-medium truncate mt-0.5">
                Active Session: <span className="font-bold text-erp-text">{activeClass?.title || 'General Batch Session'}</span>
                {selectedBatch?.timing && ` • Timing: ${selectedBatch.timing}`}
              </p>
            </div>
          )}
        </div>

        {/* Dropdowns & DB Sync Button */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Batch Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-erp-text/60 hidden sm:inline">Batch:</span>
            <select
              aria-label="Batch"
              value={selectedBatchId}
              onChange={(e) => handleSelectBatch(e.target.value)}
              className="bg-erp-background border border-erp-border text-erp-text font-bold rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px] truncate"
            >
              <option value="all">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.mode || 'Hybrid'})
                </option>
              ))}
            </select>
          </div>


          <Button 
            onClick={() => syncAttendanceFromDB(activeClass?.id || 'default', selectedBatch?.name)} 
            variant="secondary"
            size="sm"
            className="flex items-center gap-2 font-bold"
            disabled={syncing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync DB
          </Button>
        </div>
      </Card>

      {/* Sync & Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-erp-surface border-erp-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-erp-text/60 uppercase tracking-wider">Batch Enrolled</p>
            <h3 className="text-2xl font-black text-erp-text mt-0.5">{totalStudentsCount}</h3>
          </div>
        </Card>

        <Card className="bg-erp-surface border-erp-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xl shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-erp-text/60 uppercase tracking-wider">Present (&gt;=5m / QR)</p>
            <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">{presentCount}</h3>
          </div>
        </Card>

        <Card className="bg-erp-surface border-erp-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-400 flex items-center justify-center font-bold text-xl shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-erp-text/60 uppercase tracking-wider">Pending (&lt;5m)</p>
            <h3 className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-0.5">{pendingCount}</h3>
          </div>
        </Card>

        <Card className="bg-erp-surface border-erp-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold text-xl shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-erp-text/60 uppercase tracking-wider">Attendance Rate</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <h3 className="text-2xl font-black text-purple-600 dark:text-purple-400">{presentPercentage}%</h3>
              {lastSyncedTime && (
                <span className="text-[10px] font-mono text-erp-text/50 truncate">
                  Synced {lastSyncedTime}
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ── VIEW MODE 1: MATRIX VIEW (MATCHING IMAGE 2 SPREADSHEET FORMAT WITH CLASS NAVIGATION) ── */}
      {viewMode === 'matrix' && (
        <Card className="bg-erp-surface border-erp-border p-6 shadow-sm mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold font-display text-erp-text flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                Batch & Course Attendance Matrix
                <span className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {filteredStudents.length} Students
                </span>
              </h2>
              <p className="text-xs text-erp-text/60 mt-1">
                Course breakdown with green <strong className="text-emerald-700 dark:text-emerald-400">P</strong> (Present) and red <strong className="text-rose-600 dark:text-rose-400">A</strong> (Absent) status boxes. Click any box to toggle.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Course Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-erp-text/60 hidden sm:inline">Course:</span>
                <select
                  aria-label="Course"
                  value={matrixFilterCourse}
                  onChange={(e) => {
                    setMatrixFilterCourse(e.target.value);
                    setClassStartIndex(0);
                  }}
                  className="bg-erp-background border border-erp-border text-erp-text font-bold rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px] truncate"
                >
                  <option value="all">All Courses</option>
                  {availableCourseNames.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-erp-text/40" />
                <input
                  type="text"
                  placeholder="Search student..." aria-label="Search student"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-erp-background border border-erp-border rounded-xl text-erp-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Export Matrix Button */}
              <Button onClick={handleExportCSV} variant="ghost" size="sm" className="font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 !text-emerald-700 dark:!text-emerald-400 hover:!bg-emerald-500/10">
                <Download className="w-3.5 h-3.5" />
                Export CSV (All Classes)
              </Button>
            </div>
          </div>

          {/* ── CLASS COLUMN NAVIGATION BAR (MOVING FRONT / BACKWARD THROUGH 28+ CLASSES) ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-zinc-900/90 border border-erp-border p-3.5 rounded-2xl mb-5 shadow-xs">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setClassStartIndex(prev => Math.max(0, prev - (classPageSize === 'all' ? 15 : Number(classPageSize) || 15)))}
                disabled={classStartIndex === 0}
                variant="secondary"
                size="sm"
                className="flex items-center gap-1 font-bold text-xs shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Classes
              </Button>

              <Button
                onClick={() => setClassStartIndex(prev => Math.min(allFlatClasses.length - (classPageSize === 'all' ? 15 : Number(classPageSize) || 15), prev + (classPageSize === 'all' ? 15 : Number(classPageSize) || 15)))}
                disabled={classPageSize === 'all' || classStartIndex + (Number(classPageSize) || 15) >= allFlatClasses.length}
                variant="secondary"
                size="sm"
                className="flex items-center gap-1 font-bold text-xs shadow-xs"
              >
                Next Classes
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Page Info & Jump Number Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono font-bold text-erp-text/80 bg-erp-surface px-3 py-1.5 rounded-xl border border-erp-border shadow-2xs">
                Showing Classes {allFlatClasses.length > 0 ? classStartIndex + 1 : 0}–{Math.min(classStartIndex + (classPageSize === 'all' ? allFlatClasses.length : Number(classPageSize) || 15), allFlatClasses.length)} of {allFlatClasses.length} Total
              </span>

              {/* Class Page Number Buttons */}
              {classPageSize !== 'all' && Math.ceil(allFlatClasses.length / (Number(classPageSize) || 15)) > 1 && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(allFlatClasses.length / (Number(classPageSize) || 15)) }, (_, i) => {
                    const isCurrentPage = Math.floor(classStartIndex / (Number(classPageSize) || 15)) === i;
                    return (
                      <button
                        key={i}
                        onClick={() => setClassStartIndex(i * (Number(classPageSize) || 15))}
                        className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          isCurrentPage 
                            ? 'bg-blue-600 text-white shadow-xs scale-105' 
                            : 'bg-erp-surface border border-erp-border text-erp-text/70 hover:bg-erp-background'
                        }`}
                        title={`Go to Class Page ${i + 1}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Page Size Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-erp-text/60 hidden sm:inline">Classes per page:</span>
                <select
                  aria-label="Classes per page"
                  value={classPageSize}
                  onChange={(e) => {
                    const val = e.target.value;
                    setClassPageSize(val === 'all' ? 'all' : Number(val));
                    setClassStartIndex(0);
                  }}
                  className="bg-erp-surface border border-erp-border text-erp-text font-bold rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={8}>8 Classes</option>
                  <option value={12}>12 Classes</option>
                  <option value={15}>15 Classes (Default)</option>
                  <option value={20}>20 Classes</option>
                  <option value={28}>28 Classes</option>
                  <option value="all">All {allFlatClasses.length} Classes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Legend Banner */}
          <div className="flex items-center gap-4 bg-erp-background border border-erp-border p-3 rounded-xl mb-5 text-xs font-medium">
            <span className="font-bold text-erp-text">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center">P</span>
              <span className="text-erp-text/70">Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-rose-600 text-white font-black text-[11px] flex items-center justify-center">A</span>
              <span className="text-erp-text/70">Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold text-[11px] flex items-center justify-center">-</span>
              <span className="text-erp-text/70">Unmarked</span>
            </div>
          </div>

          {/* Matrix Spreadsheet Table Container (Scrollable with Sticky Column & Headers) */}
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-erp-border rounded-xl bg-erp-surface shadow-inner">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                {/* Header Row 1: Batch / Course Header Banners (Matching Image 2!) */}
                <tr className="bg-slate-100 dark:bg-zinc-900 border-b border-erp-border text-xs font-black uppercase text-erp-text tracking-wider">
                  <th className="py-2.5 px-3 sticky left-0 z-30 bg-slate-100 dark:bg-zinc-900 border-r border-erp-border min-w-[150px] shadow-xs truncate">
                    Batch: {selectedBatch ? selectedBatch.name : 'All Batches'}
                  </th>
                  {Object.entries(visibleCourseGroups).map(([courseName, classesList]) => (
                    <th key={courseName} colSpan={classesList.length} className="py-2 px-2 text-center border-r border-erp-border bg-blue-500/10 text-blue-700 dark:text-blue-400 font-extrabold text-[11px] uppercase tracking-wider truncate">
                      {courseName}
                    </th>
                  ))}
                  <th colSpan={3} className="py-2 px-2 text-center bg-slate-200/60 dark:bg-zinc-800/80 text-erp-text font-extrabold text-[11px]">
                    Summary
                  </th>
                </tr>

                {/* Header Row 2: Student Column & Compact Class Columns (Class 1, Class 2, Class 3, etc.) */}
                <tr className="bg-erp-background/95 border-b border-erp-border text-[10px] sm:text-[11px] font-black text-erp-text/70 uppercase tracking-wider sticky top-0 z-20">
                  <th className="py-2 px-3 sticky left-0 z-30 bg-erp-background border-r border-erp-border shadow-xs min-w-[150px] text-left">
                    Student
                  </th>
                  {visibleClasses.map((cls) => {
                    const shortHeader = cls.classNum ? `Class ${cls.classNum}` : (cls.title?.replace(/^(Python|SQL|AI|Excel|ML|Power BI|Curriculum)\s*[-:]?\s*/i, '') || `Class ${cls.classNum || 1}`);
                    const fullHeader = cls.title && cls.title.includes(cls.courseName) ? cls.title : `${cls.courseName} - ${cls.title || 'Class ' + cls.classNum}`;
                    return (
                      <th 
                        key={cls.id} 
                        className="py-2 px-1 text-center border-r border-erp-border min-w-[50px] max-w-[62px] text-[10px] sm:text-[11px] font-black tracking-tight truncate" 
                        title={fullHeader}
                      >
                        {shortHeader}
                      </th>
                    );
                  })}
                  <th className="py-2 px-1 text-center text-emerald-700 dark:text-emerald-400 font-bold min-w-[38px]">P</th>
                  <th className="py-2 px-1 text-center text-rose-600 dark:text-rose-400 font-bold min-w-[38px]">A</th>
                  <th className="py-2 px-1 text-center text-purple-600 dark:text-purple-400 font-bold min-w-[48px]">%</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-erp-border text-xs font-medium text-erp-text">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={100} className="py-12 text-center text-erp-text/50 font-bold">
                      No student records found for the selected batch or search query.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, idx) => {
                    let totalPresentForStudent = 0;
                    let totalAbsentForStudent = 0;
                    let totalClassesForStudent = allFlatClasses.length;

                    // Calculate overall counts for all flat classes
                    allFlatClasses.forEach(cls => {
                      const key = `${student.id}_${cls.id}`;
                      const emailKey = `${student.email?.toLowerCase()}_${cls.id}`;
                      const record = matrixLogsMap.get(key) || matrixLogsMap.get(emailKey);
                      if (record?.isPresent) totalPresentForStudent++;
                      else totalAbsentForStudent++;
                    });

                    return (
                      <tr key={student.id} className="hover:bg-erp-background/50 transition-colors">
                        {/* Sticky Left Column: Student Roll # & Name */}
                        <td className="py-2 px-3 sticky left-0 z-10 bg-erp-surface hover:bg-erp-background/90 border-r border-erp-border shadow-xs font-bold text-erp-text min-w-[150px]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4.5 h-4.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-[9px] font-mono font-bold flex items-center justify-center text-erp-text/70 shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-erp-text font-bold text-xs">{student.name || 'Unnamed Student'}</div>
                              <div className="text-[9px] text-erp-text/50 truncate font-normal">{student.email || student.student_code || ''}</div>
                            </div>
                          </div>
                        </td>

                        {/* Visible Course & Class Attendance Status Cells ("P" green / "A" red / "-" gray) */}
                        {visibleClasses.map((cls) => {
                          const key = `${student.id}_${cls.id}`;
                          const emailKey = `${student.email?.toLowerCase()}_${cls.id}`;
                          const record = matrixLogsMap.get(key) || matrixLogsMap.get(emailKey);
                          const isPresent = record?.isPresent;
                          const isExplicitAbsent = record && !record.isPresent;

                          return (
                            <td key={cls.id} className="py-1.5 px-0.5 text-center border-r border-erp-border min-w-[50px] max-w-[62px]">
                              {isPresent ? (
                                <button
                                  onClick={() => handleToggleMatrixCell(student.id, cls.id, true)}
                                  className="w-6 h-6 min-w-[24px] min-h-[24px] mx-auto rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs flex items-center justify-center shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title={`${student.name} - ${cls.title || 'Class'}: PRESENT (Click to toggle)`}
                                >
                                  P
                                </button>
                              ) : isExplicitAbsent ? (
                                <button
                                  onClick={() => handleToggleMatrixCell(student.id, cls.id, false)}
                                  className="w-6 h-6 min-w-[24px] min-h-[24px] mx-auto rounded-md bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title={`${student.name} - ${cls.title || 'Class'}: ABSENT (Click to toggle)`}
                                >
                                  A
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleMatrixCell(student.id, cls.id, false)}
                                  className="w-6 h-6 min-w-[24px] min-h-[24px] mx-auto rounded-md bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 font-bold text-xs flex items-center justify-center hover:bg-emerald-500/20 hover:text-emerald-500 transition-all cursor-pointer"
                                  title={`${student.name} - ${cls.title || 'Class'}: Unmarked (Click to mark Present)`}
                                >
                                  -
                                </button>
                              )}
                            </td>
                          );
                        })}

                        {/* Summary Columns */}
                        <td className="py-2 px-1 text-center font-bold text-emerald-700 dark:text-emerald-400 font-mono text-xs min-w-[38px]">
                          {totalPresentForStudent}
                        </td>
                        <td className="py-2 px-1 text-center font-bold text-rose-600 dark:text-rose-400 font-mono text-xs min-w-[38px]">
                          {totalAbsentForStudent}
                        </td>
                        <td className="py-2 px-1 text-center font-mono font-black text-purple-600 dark:text-purple-400 text-xs min-w-[48px]">
                          {totalClassesForStudent > 0 ? Math.round((totalPresentForStudent / totalClassesForStudent) * 100) : 0}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── VIEW MODE 2: LIVE ROSTER & QR CODE SESSION VIEW ── */}
      {viewMode === 'roster' && (
        <>
          {/* Main Attendance Mode Options Grid (Online 5-Min Rule & Offline QR Code) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            
            {/* Offline Attendance (QR Code) Card */}
            <Card className={`bg-erp-surface border-erp-border flex flex-col items-center p-6 md:p-8 text-center shadow-sm relative ${batchMode === 'Online' ? 'opacity-70' : ''}`}>
              {batchMode === 'Online' && (
                <div className="absolute top-3 right-3 bg-amber-500/10 text-amber-800 dark:text-amber-400 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-amber-500/20">
                  Batch is Online Mode
                </div>
              )}
              <div className="w-14 h-14 bg-amber-500/10 text-amber-800 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4 shrink-0">
                <QrCode className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold font-display text-erp-text mb-1">Offline QR Attendance</h2>
              <p className="text-xs text-erp-text/60 mb-5 max-w-sm">
                Project this QR code on the classroom screen for offline students to scan via their portal.
              </p>
              
              <div className="bg-white dark:bg-black p-4 rounded-2xl border-4 border-slate-200 dark:border-white/10 mb-5 flex flex-col items-center justify-center shadow-inner">
                {qrData ? (
                  <>
                    <QRCodeSVG 
                      value={JSON.stringify({ classId: activeClass?.id || selectedBatch?.id || 'batch_session', token: qrData.qrCode })} 
                      size={160} 
                      level="H" 
                    />
                    <div className="text-slate-800 dark:text-white font-mono font-black text-lg tracking-[0.3em] mt-3" title="Students can also type this code">
                      {qrData.qrCode}
                    </div>
                    <div className="text-slate-600 dark:text-zinc-400 font-mono text-[11px] mt-2 flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-3 py-1 rounded-full">
                      <Clock className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                      Expires: {new Date(qrData.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </>
                ) : (
                  <div className="w-40 h-40 bg-slate-100 dark:bg-zinc-900/50 flex flex-col items-center justify-center rounded-xl text-slate-400">
                    <QrCode className="w-10 h-10 mb-2" />
                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Click below to project QR</span>
                  </div>
                )}
              </div>
              
              <Button className="w-full font-bold py-2.5 text-sm" onClick={handleGenerateQR}>
                {qrData ? 'Regenerate Classroom QR' : 'Generate Classroom QR Code'}
              </Button>
            </Card>

            {/* Online Attendance (5-Min Threshold Rule & Live Meet) Card */}
            <Card className={`bg-erp-surface border-erp-border flex flex-col items-center p-6 md:p-8 text-center shadow-sm relative ${batchMode === 'Offline' ? 'opacity-70' : ''}`}>
              {batchMode === 'Offline' && (
                <div className="absolute top-3 right-3 bg-amber-500/10 text-amber-800 dark:text-amber-400 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-amber-500/20">
                  Batch is Offline Mode
                </div>
              )}
              <div className="w-14 h-14 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 rounded-2xl flex items-center justify-center mb-4 shrink-0">
                <Video className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold font-display text-erp-text mb-1">Online Attendance (5-Min Rule)</h2>
              <p className="text-xs text-erp-text/60 mb-5 max-w-sm">
                Share this live class link. Students staying in class for <span className="font-black text-cyan-500">at least 5 minutes</span> are automatically marked PRESENT.
              </p>
              
              <div className="w-full flex items-center gap-2 bg-erp-background border border-erp-border p-3 rounded-xl mb-5 text-left">
                <div className="flex-1 font-mono text-xs text-erp-text/90 truncate">
                  {meetUrl || 'No meeting link set for this class (add it in the Course CMS)'}
                </div>
                <Button 
                  variant="ghost" 
                  onClick={handleCopyMeetLink} 
                  className="p-2 h-auto text-blue-500 hover:bg-blue-500/10" 
                >
                  {copiedLink ? <CheckCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
                <a
                  href={meetUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-cyan-500 hover:bg-cyan-500/10 font-bold text-xs flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              
              <div className="flex-1 flex flex-col justify-end w-full">
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3.5 flex items-center gap-3 text-left">
                  <ShieldCheck className="w-5 h-5 text-cyan-500 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-cyan-500 block">5-Minute Automated Rule Active</span>
                    <span className="text-erp-text/60 text-[11px]">System tracks stay duration every 30s. Automatically commits to Turso DB at 5 minutes.</span>
                  </div>
                </div>
              </div>
            </Card>

          </div>

          {/* Enrolled Students & Live Duration Status Roster */}
          <div className="mt-4">
            <Card className="bg-erp-surface border-erp-border p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold font-display text-erp-text flex items-center gap-2">
                    Live Session Student Roster
                    <span className="text-xs bg-erp-background border border-erp-border px-2.5 py-1 rounded-full text-erp-text/70 font-mono font-bold">
                      {filteredStudents.length} / {totalStudentsCount} Students
                    </span>
                  </h2>
                  <p className="text-xs text-erp-text/60 mt-1">
                    Real-time duration tracking (&gt;= 5 min = Present), QR scans, and manual attendance controls.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Search input */}
                  <div className="relative min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-erp-text/40" />
                    <input
                      type="text"
                      placeholder="Search student..." aria-label="Search student"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-erp-background border border-erp-border rounded-xl text-erp-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center bg-erp-background border border-erp-border rounded-xl p-0.5 text-xs font-semibold">
                    <button
                      onClick={() => setFilterStatus('all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-blue-600 text-white' : 'text-erp-text/70 hover:text-erp-text'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterStatus('present')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${filterStatus === 'present' ? 'bg-emerald-700 text-white' : 'text-erp-text/70 hover:text-erp-text'}`}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => setFilterStatus('pending')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${filterStatus === 'pending' ? 'bg-amber-500 text-black' : 'text-erp-text/70 hover:text-erp-text'}`}
                    >
                      Pending (&lt;5m)
                    </button>
                    <button
                      onClick={() => setFilterStatus('absent')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${filterStatus === 'absent' ? 'bg-red-600 text-white' : 'text-erp-text/70 hover:text-erp-text'}`}
                    >
                      Absent
                    </button>
                  </div>

                  <Button onClick={handleMarkAllPresent} variant="secondary" size="sm" className="font-bold text-xs">
                    Mark Roster Present
                  </Button>
                </div>
              </div>

              {/* Student Table */}
              <div className="overflow-x-auto rounded-xl border border-erp-border">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-erp-background/80 text-[11px] font-black text-erp-text/60 uppercase tracking-wider border-b border-erp-border">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Batch</th>
                      <th className="py-3 px-4">Class Stay Duration</th>
                      <th className="py-3 px-4">Check-In Type</th>
                      <th className="py-3 px-4">Attendance Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-erp-border text-xs font-medium text-erp-text">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-erp-text/50 font-bold">
                          No students found for the selected batch/filter.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map(student => {
                        const log = presentStudentMap.get(student.id) || presentStudentMap.get(student.email?.toLowerCase());
                        const durationMins = Number(log?.duration_minutes) || 0;
                        const isPresent = isPresentLog(log);
                        const isPending = isPendingLog(log);
                        const attType = log?.attendance_type || (isPresent ? 'Manual' : '-');

                        return (
                          <tr key={student.id} className="hover:bg-erp-background/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-erp-text">{student.name || 'Unnamed Student'}</div>
                              <div className="text-[10px] text-erp-text/50">{student.email || student.student_code || 'No email'}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold text-[10px]">
                                {student.batch_number || selectedBatch?.name || 'Global'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold">
                              {durationMins > 0 ? (
                                <span className={durationMins >= 5 ? 'text-emerald-700 dark:text-emerald-400 flex items-center gap-1' : 'text-amber-700 dark:text-amber-400 flex items-center gap-1'}>
                                  <Clock className="w-3.5 h-3.5" />
                                  {durationMins} min {durationMins >= 5 ? '✓ (>=5m Threshold Passed)' : '⏳ (Needs 5m)'}
                                </span>
                              ) : (
                                <span className="text-erp-text/40">0 min</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-erp-background border border-erp-border">
                                {attType}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {isPresent ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                  <UserCheck className="w-3.5 h-3.5" /> Present
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                                  <Clock className="w-3.5 h-3.5" /> Pending ({5 - durationMins}m left)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 dark:text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                                  <UserX className="w-3.5 h-3.5" /> Absent
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {isPresent ? (
                                <Button
                                  onClick={() => handleMarkAbsent(student.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-red-500 hover:bg-red-500/10 font-bold px-2 py-1"
                                >
                                  Mark Absent
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => handleMarkPresent(student.id)}
                                  variant="secondary"
                                  size="sm"
                                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold px-2.5 py-1"
                                >
                                  Mark Present
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ── VIEW MODE 3: INTERACTIVE CLASS CALENDAR & ROLL CALL ── */}
      {viewMode === 'calendar' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Calendar Master Card */}
          <Card className="bg-erp-surface border-erp-border p-6 shadow-sm">
            {/* Calendar Header Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold font-display text-erp-text flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-500" />
                  Interactive Class Calendar & Roll Call
                  <span className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                    {batchStudents.length} Students in Batch
                  </span>
                </h2>
                <p className="text-xs text-erp-text/60 mt-1">
                  Click on any day in the monthly calendar to view and manually take or adjust student attendance for that date.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Class / Curriculum Session Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-erp-text/60 hidden sm:inline">Session:</span>
                  <select
                    value={calendarSelectedClassId}
                    onChange={(e) => setCalendarSelectedClassId(e.target.value)}
                    className="bg-erp-background border border-erp-border text-erp-text font-bold rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate"
                  >
                    <option value="default">General Batch Session</option>
                    {allFlatClasses.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.courseName ? `${cls.courseName}: ` : ''}{cls.title || `Class ${cls.classNum}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month Navigator */}
                <div className="flex items-center bg-erp-background border border-erp-border rounded-xl p-1 shadow-xs">
                  <button
                    onClick={() => {
                      if (calMonth === 1) {
                        setCalMonth(12);
                        setCalYear(prev => prev - 1);
                      } else {
                        setCalMonth(prev => prev - 1);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-erp-surface text-erp-text/70 hover:text-erp-text transition-colors"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-black text-erp-text px-3 py-1 min-w-[120px] text-center">
                    {MONTH_NAMES[calMonth - 1]} {calYear}
                  </span>
                  <button
                    onClick={() => {
                      if (calMonth === 12) {
                        setCalMonth(1);
                        setCalYear(prev => prev + 1);
                      } else {
                        setCalMonth(prev => prev + 1);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-erp-surface text-erp-text/70 hover:text-erp-text transition-colors"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Today Button */}
                <Button
                  onClick={() => {
                    setCalMonth(today.getMonth() + 1);
                    setCalYear(today.getFullYear());
                    setCalendarSelectedDate(todayDateStr);
                  }}
                  variant="secondary"
                  size="sm"
                  className="font-bold text-xs"
                >
                  Today
                </Button>
              </div>
            </div>

            {/* Calendar Table Grid */}
            <div className="bg-erp-background border border-erp-border rounded-2xl overflow-hidden shadow-xs mb-8">
              {/* Day names header */}
              <div className="grid grid-cols-7 border-b border-erp-border bg-slate-100 dark:bg-zinc-900/80 text-center font-bold text-xs text-erp-text/70 py-2.5">
                {CALENDAR_WEEKDAYS.map(w => (
                  <div key={w} className={w === 'Sun' || w === 'Sat' ? 'text-amber-600 dark:text-amber-400' : ''}>
                    {w}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-erp-border">
                {classCalendarDays.map((day, idx) => {
                  const isSelected = calendarSelectedDate === day.dateStr;
                  const hasAttendance = day.totalMarked > 0;
                  const rate = day.presentCount > 0 && batchStudents.length > 0
                    ? Math.round((day.presentCount / batchStudents.length) * 100)
                    : 0;

                  return (
                    <div
                      key={day.dateStr + '_' + idx}
                      onClick={() => setCalendarSelectedDate(day.dateStr)}
                      className={`min-h-[85px] p-2 flex flex-col justify-between cursor-pointer transition-all relative select-none group ${
                        !day.isCurrentMonth 
                          ? 'bg-slate-50/50 dark:bg-zinc-950/30 opacity-40 hover:opacity-75' 
                          : day.isWeekend 
                          ? 'bg-slate-50/20 dark:bg-zinc-900/20' 
                          : 'bg-erp-surface hover:bg-erp-background'
                      } ${
                        isSelected 
                          ? 'ring-2 ring-blue-500 bg-blue-500/10 z-10 shadow-xs' 
                          : ''
                      } ${
                        day.isToday 
                          ? 'border-2 border-blue-500' 
                          : ''
                      }`}
                    >
                      {/* Top Day row */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black rounded-full w-5 h-5 flex items-center justify-center ${
                          day.isToday 
                            ? 'bg-blue-600 text-white' 
                            : isSelected
                            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                            : 'text-erp-text'
                        }`}>
                          {day.dayNum}
                        </span>

                        {hasAttendance && (
                          <span className={`w-2 h-2 rounded-full ${day.presentCount > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        )}
                      </div>

                      {/* Bottom status badge */}
                      <div className="mt-1">
                        {hasAttendance ? (
                          <div className="space-y-0.5">
                            {day.presentCount > 0 && (
                              <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 truncate">
                                ✓ {day.presentCount} Present ({rate}%)
                              </div>
                            )}
                            {day.absentCount > 0 && (
                              <div className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 truncate">
                                ✗ {day.absentCount} Absent
                              </div>
                            )}
                          </div>
                        ) : day.isCurrentMonth && !day.isWeekend && !day.isFuture ? (
                          <div className="text-[9px] font-bold text-erp-text/30 group-hover:text-blue-500 group-hover:font-extrabold transition-colors">
                            + Take Attendance
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── SELECTED DATE ROLL CALL ACTION PANEL ── */}
            <div className="bg-erp-background border-2 border-erp-border rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-erp-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-erp-text/50">
                      Selected Session Date
                    </span>
                    <h3 className="text-lg font-black text-erp-text">
                      {new Date(calendarSelectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h3>
                  </div>
                </div>

                {/* Date Stats Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="bg-erp-surface border border-erp-border px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <span>Enrolled: <strong className="text-erp-text">{selectedDateStats.total}</strong></span>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Present: <strong>{selectedDateStats.present}</strong> ({selectedDateStats.rate}%)</span>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5" />
                    <span>Absent: <strong>{selectedDateStats.absent}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={() => handleBulkMarkDatePresent(calendarSelectedClassId, calendarSelectedDate)}
                    variant="primary"
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    disabled={syncing}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Mark All Present
                  </Button>

                  <Button
                    onClick={() => handleBulkMarkDateAbsent(calendarSelectedClassId, calendarSelectedDate)}
                    variant="secondary"
                    size="sm"
                    className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    disabled={syncing}
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Mark All Absent
                  </Button>

                  <Button
                    onClick={() => handleClearDateAttendance(calendarSelectedClassId, calendarSelectedDate)}
                    variant="ghost"
                    size="sm"
                    className="text-erp-text/60 hover:text-erp-text font-bold text-xs"
                    disabled={syncing}
                  >
                    Clear Attendance
                  </Button>
                </div>

                {/* Student search input */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-erp-text/40" />
                  <input
                    type="text"
                    placeholder="Search student..." aria-label="Search student"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-erp-surface border border-erp-border rounded-xl text-erp-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Student Roll Call List */}
              <div className="overflow-x-auto border border-erp-border rounded-xl bg-erp-surface">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-zinc-900 border-b border-erp-border text-[11px] font-black uppercase text-erp-text/70 tracking-wider">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-4 text-left">Student</th>
                      <th className="py-2.5 px-4 text-left">Batch</th>
                      <th className="py-2.5 px-4 text-center">Status on {calendarSelectedDate}</th>
                      <th className="py-2.5 px-4 text-right">Click to Log</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-erp-border text-xs">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-erp-text/50 font-bold">
                          No students found matching current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student, idx) => {
                        const status = getStudentDateStatus(student.id, student.email, calendarSelectedClassId, calendarSelectedDate);
                        const isPresent = status === 'Present';
                        const isAbsent = status === 'Absent';

                        return (
                          <tr key={student.id} className="hover:bg-erp-background/50 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-erp-text/50 font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-erp-text">{student.name || 'Unnamed Student'}</div>
                              <div className="text-[10px] text-erp-text/50">{student.student_code || student.email || ''}</div>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold text-[10px]">
                                {student.batch_number || selectedBatch?.name || 'Batch'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              {isPresent ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                  <Check className="w-3 h-3" /> Present
                                </span>
                              ) : isAbsent ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                                  <X className="w-3 h-3" /> Absent
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600">
                                  Unmarked
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleToggleDateStudent(student.id, calendarSelectedClassId, calendarSelectedDate, 'Present')}
                                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    isPresent
                                      ? 'bg-emerald-700 text-white shadow-xs scale-105'
                                      : 'bg-erp-background border border-erp-border text-emerald-600 hover:bg-emerald-500/10'
                                  }`}
                                  title="Mark Present"
                                >
                                  P
                                </button>
                                <button
                                  onClick={() => handleToggleDateStudent(student.id, calendarSelectedClassId, calendarSelectedDate, 'Absent')}
                                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    isAbsent
                                      ? 'bg-rose-600 text-white shadow-xs scale-105'
                                      : 'bg-erp-background border border-erp-border text-rose-600 hover:bg-rose-500/10'
                                  }`}
                                  title="Mark Absent"
                                >
                                  A
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Staff Attendance Calendar Modal */}
      {showStaffModal && (
        <StaffAttendanceModal
          isOpen={showStaffModal}
          onClose={() => setShowStaffModal(false)}
          targetUser={user ? {
            id: user.id,
            name: user.name,
            role: user.role,
            email: user.email
          } : undefined}
          onAttendanceUpdated={() => syncAttendanceFromDB(activeClass?.id || 'default', selectedBatch?.name)}
        />
      )}
    </div>
  );
}
