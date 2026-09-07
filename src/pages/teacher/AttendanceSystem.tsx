import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { 
  QrCode, Video, Users, CheckCircle, Copy, ExternalLink, 
  RefreshCw, Search, UserCheck, UserX, Clock, Sparkles, ShieldCheck, 
  Laptop, MapPin, Layers, Download, Grid, Table, FileSpreadsheet,
  BookOpen, Filter, Check, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../lib/auth';
import { 
  getActiveLiveClass, 
  getAllAvailableClasses, 
  logAttendance, 
  removeAttendance, 
  getLiveAttendance,
  getAllAttendanceLogsMatrix
} from '../../lib/api/teacher';
import { getAllBatches, BatchItem } from '../../lib/api/batches';
import { getCoursesFull } from '../../lib/api/cms';
import { generateQRAttendance, QRCodeResult } from '../../lib/api/ux';
import { QRCodeSVG } from 'qrcode.react';

const DEFAULT_DEMO_STUDENTS = [
  { id: 'stu_1', name: 'Aarav Sharma', email: 'aarav.sharma@cynexai.com', student_code: 'CNX-STU-001', batch_number: 'Batch 1', role: 'Student' },
  { id: 'stu_2', name: 'Ananya Verma', email: 'ananya.v@cynexai.com', student_code: 'CNX-STU-002', batch_number: 'Batch 1', role: 'Student' },
  { id: 'stu_3', name: 'Vikram Reddy', email: 'vikram.r@cynexai.com', student_code: 'CNX-STU-003', batch_number: 'Batch 1', role: 'Student' },
  { id: 'stu_4', name: 'Priya Patel', email: 'priya.patel@cynexai.com', student_code: 'CNX-STU-004', batch_number: 'Batch 2', role: 'Student' },
  { id: 'stu_5', name: 'Rahul Kumar', email: 'rahul.k@cynexai.com', student_code: 'CNX-STU-005', batch_number: 'Batch 2', role: 'Student' },
  { id: 'stu_6', name: 'Sneha Gupta', email: 'sneha.g@cynexai.com', student_code: 'CNX-STU-006', batch_number: 'Batch 2', role: 'Student' },
  { id: 'stu_7', name: 'Sai Krishna', email: 'sai.k@cynexai.com', student_code: 'CNX-STU-007', batch_number: 'Batch 3', role: 'Student' },
  { id: 'stu_8', name: 'Divya Nair', email: 'divya.n@cynexai.com', student_code: 'CNX-STU-008', batch_number: 'Batch 3', role: 'Student' },
  { id: 'stu_9', name: 'Rohan Mehta', email: 'rohan.m@cynexai.com', student_code: 'CNX-STU-009', batch_number: 'Batch 3', role: 'Student' },
  { id: 'stu_10', name: 'Kavya Singh', email: 'kavya.s@cynexai.com', student_code: 'CNX-STU-010', batch_number: 'Batch 1', role: 'Student' },
];

export default function AttendanceSystem() {
  const navigate = useNavigate();
  const user = useMemo(() => getCurrentUser(), []);
  const userId = user?.id;

  // View state: 'matrix' (Spreadsheet Grid like Image 2) or 'roster' (Live Roster & QR Session)
  const [viewMode, setViewMode] = useState<'matrix' | 'roster'>('matrix');

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
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
        getLiveAttendance(classId || 'default', batchName),
        getAllAttendanceLogsMatrix()
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
        const [batchList, primaryClass, classList, usersModule, matrixLogsData, coursesData] = await Promise.all([
          getAllBatches().catch(() => []),
          getActiveLiveClass(userId || 'teacher').catch(() => null),
          getAllAvailableClasses().catch(() => []),
          import('../../lib/api/users').catch(() => null),
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

        // Load all students
        if (usersModule) {
          const allUsers = await usersModule.getUsers().catch(() => []);
          if (isMounted) {
            const studentUsers = (allUsers || []).filter((u: any) => 
              !u.role || u.role.toLowerCase() === 'student' || u.student_code || u.batch_number || u.classes_attended_json
            );

            if (studentUsers.length > 0) {
              setStudents(studentUsers);
            } else {
              setStudents(DEFAULT_DEMO_STUDENTS);
            }
          }
        } else {
          setStudents(DEFAULT_DEMO_STUDENTS);
        }

        await syncAttendanceFromDB(currentClass?.id || 'default', 'all');
      } catch (e) {
        console.error('Error initializing attendance system:', e);
        if (isMounted) setStudents(DEFAULT_DEMO_STUDENTS);
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
    const sessionToken = activeClass?.id || selectedBatch?.id || `batch_session_${Date.now()}`;
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
        await removeAttendance(studentId, classId);
      } else {
        await logAttendance(studentId, classId, 'Manual');
      }
      await syncAttendanceFromDB(activeClass?.id || 'default', selectedBatch?.name);
    } catch (e) {
      console.error('Error toggling matrix cell:', e);
    }
  };

  const handleMarkAllPresent = async () => {
    const targetClassId = activeClass?.id || 'default';
    if (batchStudents.length === 0) return;
    try {
      setSyncing(true);
      const absentStudents = batchStudents.filter(s => {
        const log = presentStudentMap.get(s.id) || presentStudentMap.get(s.email?.toLowerCase());
        const isPresent = log && (log.duration_minutes >= 5 || log.status === 'Present' || log.attendance_type === 'Offline_QR');
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
    const link = activeClass 
      ? `https://meet.google.com/cnx-${activeClass.id.substring(0, 8)}`
      : `https://meet.google.com/cnx-${selectedBatch?.name?.toLowerCase().replace(/\s+/g, '-') || 'live'}`;
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
        const duration = Number(log.duration_minutes) || 0;
        const isPresent = duration >= 5 || log.status === 'Present' || log.attendance_type === 'Offline_QR' || log.attendance_type === 'Manual';
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
        const duration = Number(log.duration_minutes) || 0;
        const isPresent = duration >= 5 || log.status === 'Present' || log.attendance_type === 'Offline_QR' || log.attendance_type === 'Manual';
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

    return students.filter(s => {
      const studentBatch = (s.batch_number || s.batch_name || s.batch || '').trim().toLowerCase();
      if (!studentBatch) return true;
      const cleanStudentBatch = studentBatch.replace(/\s*\([^)]*\)/g, '');
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
      const duration = Number(log?.duration_minutes) || 0;
      const isPresent = log && (duration >= 5 || log.status === 'Present' || log.attendance_type === 'Offline_QR' || log.attendance_type === 'Manual');
      const isPending = log && duration > 0 && duration < 5 && !isPresent;
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
      const duration = Number(log.duration_minutes) || 0;
      return duration >= 5 || log.status === 'Present' || log.attendance_type === 'Offline_QR' || log.attendance_type === 'Manual';
    }).length;
  }, [batchStudents, presentStudentMap]);

  const pendingCount = useMemo(() => {
    return batchStudents.filter(s => {
      const log = presentStudentMap.get(s.id) || presentStudentMap.get(s.email?.toLowerCase());
      if (!log) return false;
      const duration = Number(log.duration_minutes) || 0;
      return duration > 0 && duration < 5 && log.status !== 'Present' && log.attendance_type !== 'Offline_QR' && log.attendance_type !== 'Manual';
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

    // Fallback: If DB query for a specific course is empty, populate 28 classes for Python and 30 for SQL (exact DB counts)
    if (Object.keys(groups).length === 0) {
      if (matrixFilterCourse === 'all' || matrixFilterCourse.toLowerCase() === 'python') {
        groups['Python'] = Array.from({ length: 28 }, (_, i) => ({
          id: `py_c${i + 1}`,
          title: `Python - Class ${i + 1}`,
          classNum: i + 1,
          courseTitle: 'Python'
        }));
      }
      if (matrixFilterCourse === 'all' || matrixFilterCourse.toLowerCase() === 'sql') {
        groups['SQL'] = Array.from({ length: 30 }, (_, i) => ({
          id: `sql_c${i + 1}`,
          title: `SQL - Class ${i + 1}`,
          classNum: i + 1,
          courseTitle: 'SQL'
        }));
      }
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
      alert('No student records available to export.');
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

  const meetUrl = activeClass 
    ? `https://meet.google.com/cnx-${activeClass.id.substring(0, 8)}`
    : `https://meet.google.com/cnx-${selectedBatch?.name?.toLowerCase().replace(/\s+/g, '-') || 'live'}`;

  const currentWindowSize = classPageSize === 'all' ? allFlatClasses.length : Number(classPageSize) || 8;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-32 p-4 md:p-8 bg-erp-background subtle-watermark">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3 whitespace-nowrap">
            <Users className="w-8 h-8 text-blue-500 shrink-0" /> 
            <span>Batch Attendance & Matrix System</span>
          </h1>
          <p className="text-xs text-erp-text/60 font-medium mt-1">
            Real-time batch matrix across all 28+ classes, column navigation, P/A badges, and automated 5-minute stay tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportCSV} 
            variant="primary" 
            size="md"
            className="flex items-center gap-2 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="w-4 h-4" />
            Export All Classes (CSV)
          </Button>
          <Button onClick={() => navigate('/teacher')} variant="secondary" size="md">
            Back to Portal
          </Button>
        </div>
      </div>

      {/* View Mode Tabs: 'matrix' (Spreadsheet Grid like Image 2) vs 'roster' (Live Roster & QR Session) */}
      <div className="flex items-center gap-2 bg-erp-surface border border-erp-border p-1.5 rounded-2xl mb-6 shadow-xs w-fit">
        <button
          onClick={() => setViewMode('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            viewMode === 'matrix' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-erp-text/70 hover:text-erp-text hover:bg-erp-background'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Batch & Course Attendance Matrix (Grid)
        </button>
        <button
          onClick={() => setViewMode('roster')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
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
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Batch Focus
            </span>

            {/* Mode Badge */}
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded border flex items-center gap-1 ${
              batchMode === 'Online'
                ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30'
                : batchMode === 'Offline'
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                : 'bg-purple-500/10 text-purple-500 border-purple-500/30'
            }`}>
              {batchMode === 'Online' ? <Laptop className="w-3 h-3" /> : batchMode === 'Offline' ? <MapPin className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {batchMode} Mode
            </span>

            {activeClass?.status && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
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
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xl shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-erp-text/60 uppercase tracking-wider">Batch Enrolled</p>
            <h3 className="text-2xl font-black text-erp-text mt-0.5">{totalStudentsCount}</h3>
          </div>
        </Card>

        <Card className="bg-erp-surface border-erp-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xl shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-erp-text/60 uppercase tracking-wider">Present (&gt;=5m / QR)</p>
            <h3 className="text-2xl font-black text-emerald-500 mt-0.5">{presentCount}</h3>
          </div>
        </Card>

        <Card className="bg-erp-surface border-erp-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xl shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-erp-text/60 uppercase tracking-wider">Pending (&lt;5m)</p>
            <h3 className="text-2xl font-black text-amber-500 mt-0.5">{pendingCount}</h3>
          </div>
        </Card>

        <Card className="bg-erp-surface border-erp-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xl shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-erp-text/60 uppercase tracking-wider">Attendance Rate</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <h3 className="text-2xl font-black text-purple-500">{presentPercentage}%</h3>
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
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                Batch & Course Attendance Matrix
                <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {filteredStudents.length} Students
                </span>
              </h2>
              <p className="text-xs text-erp-text/60 mt-1">
                Course breakdown with green <strong className="text-emerald-500">P</strong> (Present) and red <strong className="text-rose-500">A</strong> (Absent) status boxes. Click any box to toggle.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Course Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-erp-text/60 hidden sm:inline">Course:</span>
                <select
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
                  placeholder="Search student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-erp-background border border-erp-border rounded-xl text-erp-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Export Matrix Button */}
              <Button onClick={handleExportCSV} variant="secondary" size="sm" className="font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10">
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
              <span className="w-6 h-6 rounded-md bg-emerald-500 text-white font-black text-[11px] flex items-center justify-center">P</span>
              <span className="text-erp-text/70">Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-rose-500 text-white font-black text-[11px] flex items-center justify-center">A</span>
              <span className="text-erp-text/70">Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-slate-200 dark:bg-zinc-800 text-slate-400 font-bold text-[11px] flex items-center justify-center">-</span>
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
                    <th key={courseName} colSpan={classesList.length} className="py-2 px-2 text-center border-r border-erp-border bg-blue-500/10 text-blue-500 font-extrabold text-[11px] uppercase tracking-wider truncate">
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
                  <th className="py-2 px-1 text-center text-emerald-500 font-bold min-w-[38px]">P</th>
                  <th className="py-2 px-1 text-center text-rose-500 font-bold min-w-[38px]">A</th>
                  <th className="py-2 px-1 text-center text-purple-500 font-bold min-w-[48px]">%</th>
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
                                  className="w-6 h-6 mx-auto rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title={`${student.name} - ${cls.title || 'Class'}: PRESENT (Click to toggle)`}
                                >
                                  P
                                </button>
                              ) : isExplicitAbsent ? (
                                <button
                                  onClick={() => handleToggleMatrixCell(student.id, cls.id, false)}
                                  className="w-6 h-6 mx-auto rounded-md bg-rose-500 hover:bg-rose-600 text-white font-black text-xs flex items-center justify-center shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  title={`${student.name} - ${cls.title || 'Class'}: ABSENT (Click to toggle)`}
                                >
                                  A
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleMatrixCell(student.id, cls.id, false)}
                                  className="w-6 h-6 mx-auto rounded-md bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-500 font-bold text-xs flex items-center justify-center hover:bg-emerald-500/20 hover:text-emerald-500 transition-all cursor-pointer"
                                  title={`${student.name} - ${cls.title || 'Class'}: Unmarked (Click to mark Present)`}
                                >
                                  -
                                </button>
                              )}
                            </td>
                          );
                        })}

                        {/* Summary Columns */}
                        <td className="py-2 px-1 text-center font-bold text-emerald-500 font-mono text-xs min-w-[38px]">
                          {totalPresentForStudent}
                        </td>
                        <td className="py-2 px-1 text-center font-bold text-rose-500 font-mono text-xs min-w-[38px]">
                          {totalAbsentForStudent}
                        </td>
                        <td className="py-2 px-1 text-center font-mono font-black text-purple-500 text-xs min-w-[48px]">
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
                <div className="absolute top-3 right-3 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-amber-500/20">
                  Batch is Online Mode
                </div>
              )}
              <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-4 shrink-0">
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
                    <div className="text-slate-500 dark:text-zinc-400 font-mono text-[11px] mt-3 flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-3 py-1 rounded-full">
                      <Clock className="w-3 h-3 text-amber-500" />
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
                <div className="absolute top-3 right-3 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-amber-500/20">
                  Batch is Offline Mode
                </div>
              )}
              <div className="w-14 h-14 bg-cyan-500/10 text-cyan-500 rounded-2xl flex items-center justify-center mb-4 shrink-0">
                <Video className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold font-display text-erp-text mb-1">Online Attendance (5-Min Rule)</h2>
              <p className="text-xs text-erp-text/60 mb-5 max-w-sm">
                Share this live class link. Students staying in class for <span className="font-black text-cyan-500">at least 5 minutes</span> are automatically marked PRESENT.
              </p>
              
              <div className="w-full flex items-center gap-2 bg-erp-background border border-erp-border p-3 rounded-xl mb-5 text-left">
                <div className="flex-1 font-mono text-xs text-erp-text/90 truncate">
                  {meetUrl}
                </div>
                <Button 
                  variant="ghost" 
                  onClick={handleCopyMeetLink} 
                  className="p-2 h-auto text-blue-500 hover:bg-blue-500/10" 
                >
                  {copiedLink ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                <a
                  href={meetUrl}
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
                      placeholder="Search student..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-erp-background border border-erp-border rounded-xl text-erp-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center bg-erp-background border border-erp-border rounded-xl p-0.5 text-xs font-semibold">
                    <button
                      onClick={() => setFilterStatus('all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-blue-500 text-white' : 'text-erp-text/70 hover:text-erp-text'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterStatus('present')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${filterStatus === 'present' ? 'bg-emerald-500 text-white' : 'text-erp-text/70 hover:text-erp-text'}`}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => setFilterStatus('pending')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${filterStatus === 'pending' ? 'bg-amber-500 text-white' : 'text-erp-text/70 hover:text-erp-text'}`}
                    >
                      Pending (&lt;5m)
                    </button>
                    <button
                      onClick={() => setFilterStatus('absent')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${filterStatus === 'absent' ? 'bg-red-500 text-white' : 'text-erp-text/70 hover:text-erp-text'}`}
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
                        const isPresent = log && (durationMins >= 5 || log.status === 'Present' || log.attendance_type === 'Offline_QR' || log.attendance_type === 'Manual');
                        const isPending = log && durationMins > 0 && durationMins < 5 && !isPresent;
                        const attType = log?.attendance_type || (isPresent ? 'Manual' : '-');

                        return (
                          <tr key={student.id} className="hover:bg-erp-background/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-erp-text">{student.name || 'Unnamed Student'}</div>
                              <div className="text-[10px] text-erp-text/50">{student.email || student.student_code || 'No email'}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold text-[10px]">
                                {student.batch_number || selectedBatch?.name || 'Global'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold">
                              {durationMins > 0 ? (
                                <span className={durationMins >= 5 ? 'text-emerald-500 flex items-center gap-1' : 'text-amber-500 flex items-center gap-1'}>
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
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                  <UserCheck className="w-3.5 h-3.5" /> Present
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                                  <Clock className="w-3.5 h-3.5" /> Pending ({5 - durationMins}m left)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
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
                                  className="text-xs text-emerald-500 hover:bg-emerald-500/10 font-bold px-2.5 py-1"
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
    </div>
  );
}
