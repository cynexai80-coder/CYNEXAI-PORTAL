import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Search, ChevronRight, X,
  GraduationCap, Flame, Coins, Shield, Loader2,
  Plus, Minus, BookOpen, Edit2,
  Phone, Mail, Download, FileSpreadsheet,
  Upload, UserPlus
} from 'lucide-react';
import { getCurrentUser, getModuleAccess } from '../../../lib/auth';
import { client } from '../../../lib/turso';
import { cachedQuery } from '../../../lib/cache';
import { BatchesTab } from './BatchesTab';
import { decryptPassword } from '../../../lib/crypto';
import { Button } from '../../../components/ui/erp/Button';
import { DataTable } from '../../../components/ui/erp/DataTable';
import {
  getPendingStudents, approveStudent, rejectStudent,
  bulkImportStudents, saveStudent, updateStudentProfile
} from '../../../lib/api/users';
import {
  getManagerStudents, getStudentModulesAndActivity, adjustStudentMetrics,
  updateStudentModuleProgress, getStudentDetail, getUserPasswordEncrypted,
  findUserIdByEmail, updateStudentLeadStatus
} from '../../../lib/api/student';
import studentSeedData from '../../../../students_seed.json';



interface StudentStat {
  id: string; name: string; email: string; phone?: string;
  course?: string; batch_number?: string; status?: string;
  joining_date?: string; streak: number; coins: number;
  badges: number; completedClasses: number; totalModules: number;
  attendancePct: number; level: number; portal_login_email?: string;
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {children}
    </span>
  );
}

export default function StudentsPage() {
  const me = getCurrentUser();
  const isReadOnly = me ? getModuleAccess(me, 'students') === 'view' : false;

  const [activeTab, setActiveTab] = useState<'students' | 'pending' | 'batches'>('students');

  // Students Data
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [studentStats, setStudentStats] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courses, setCourses] = useState<string[]>([]);
  const [batches, setBatches] = useState<{id: string, name: string, course_id: string, module_progress_json: string}[]>([]);
  
  // Details Panel
  const [selectedStudent, setSelectedStudent] = useState<StudentStat | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  // Modals
  const [adjustModal, setAdjustModal] = useState<{ student: StudentStat; field: 'coins' | 'streak' | 'badges' } | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Add Student Modal
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Active');
  const [stuPhone, setStuPhone] = useState('');
  const [stuCourse, setStuCourse] = useState('');
  const [stuBatch, setStuBatch] = useState('');
  const [isCustomBatchMode, setIsCustomBatchMode] = useState(false);

  // CSV
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<any>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Approvals
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvingStudentId, setApprovingStudentId] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState({ student_id: '', password: '', portalId: '', batch: '' });

  useEffect(() => { 
    const timer = setTimeout(() => {
      loadData(); 
    }, 300);
    return () => clearTimeout(timer);
  }, [courseFilter, batchFilter, statusFilter, search, activeTab]);

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'pending') {
      const data = await getPendingStudents();
      setPendingStudents(data);
    } else {
      await loadStudents();
    }
    setLoading(false);
  };

  const loadStudents = async () => {
    let data: StudentStat[] = [];
    try {
      const rows = await getManagerStudents(search, courseFilter, batchFilter, statusFilter);
      if (rows && rows.length > 0) {
        data = rows.map((r: any) => ({
          id: r.id, name: r.name || 'Unknown', email: r.email, phone: r.phone,
          course: r.course, batch_number: r.batch_number, status: r.status,
          joining_date: r.joining_date, portal_login_email: r.portal_login_email,
          streak: Number(r.streak) || 0,
          coins: Number(r.coins) || 0,
          badges: Number(r.badges) || 0,
          completedClasses: Number(r.completedClasses) || 0,
          totalModules: 0, attendancePct: 0,
          level: Math.floor((Number(r.completedClasses) || 0) / 10) + 1,
        }));
      }
    } catch (e) {
      console.error("loadStudents DB fetch error:", e);
    }

    if (data.length === 0) {
      let localExtra: any[] = [];
      try {
        const cached = localStorage.getItem('cynex_local_students');
        if (cached) localExtra = JSON.parse(cached);
      } catch {}

      const rawSeed = [...localExtra, ...studentSeedData];
      data = rawSeed
        .filter((r: any) => r.id !== 'stu_32' && r.name !== 'Names')
        .map((r: any, idx: number) => {
          const cName = !r.course || r.course === 'Course' ? 'Data Science with AI' : r.course;
          const rawBatch = String(r.batch || r.batch_number || '1');
          const bNum = !rawBatch || rawBatch === 'Batch' ? 'Batch 1' : (rawBatch.startsWith('Batch') ? rawBatch : `Batch ${rawBatch}`);
          const sEmail = r.portal_login_email || r.email || `${(r.id || 'stu').toLowerCase()}@student.cynexai.com`;
          const sDate = r.joining_date ? String(r.joining_date).split(' ')[0] : '2026-06-01';
          return {
            id: r.id || `stu_seed_${idx}`,
            name: r.name || 'Student User',
            email: sEmail,
            phone: r.phone || '9876543210',
            course: cName,
            batch_number: bNum,
            status: r.status || 'Active',
            joining_date: sDate,
            portal_login_email: sEmail,
            streak: Number(r.streak) || (idx * 3 % 14) + 1,
            coins: Number(r.coins) || (idx * 50 % 500) + 100,
            badges: Number(r.badges) || (idx % 4) + 1,
            completedClasses: Number(r.completedClasses) || (idx * 2 % 15) + 3,
            totalModules: 12,
            attendancePct: 90 + (idx % 10),
            level: Math.floor(((idx * 2 % 15) + 3) / 5) + 1,
          };
        });

      if (search) {
        const q = search.toLowerCase();
        data = data.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)));
      }
      if (courseFilter) {
        data = data.filter(s => s.course === courseFilter);
      }
      if (batchFilter) {
        data = data.filter(s => s.batch_number === batchFilter);
      }
      if (statusFilter) {
        data = data.filter(s => s.status === statusFilter);
      }
    }

    setStudents(data);

    try {
      const coursesList = await cachedQuery('courses_title_list', async () => {
        const cRes = await client?.execute({ sql: `SELECT title FROM courses ORDER BY title`, args: [] }).catch(() => ({ rows: [] }));
        return (cRes?.rows || []).map((r: any) => r.title).filter(Boolean);
      }, 5 * 60 * 1000) || [];

      const batchesList = await cachedQuery('batches_full_list', async () => {
        const bRes = await client?.execute({ sql: `SELECT id, name, course_id, module_progress_json FROM batches ORDER BY name`, args: [] }).catch(() => ({ rows: [] }));
        return (bRes?.rows || []).map((r: any) => ({
          id: String(r.id),
          name: String(r.name || 'Unnamed Batch'),
          course_id: r.course_id ? String(r.course_id) : '',
          module_progress_json: r.module_progress_json ? String(r.module_progress_json) : '{}'
        }));
      }, 5 * 60 * 1000) || [];

      const statsRes = await client?.execute({ sql: `SELECT course, batch_number, COUNT(*) as cnt FROM students WHERE (approval_status = 'Approved' OR approval_status IS NULL) GROUP BY course, batch_number`, args: [] }).catch(() => ({ rows: [] }));
      
      setStudentStats(statsRes?.rows || []);

      if (coursesList.length > 0) {
        setCourses(coursesList);
      } else {
        const uniqueCourses = Array.from(new Set(data.map(s => s.course).filter(Boolean))) as string[];
        setCourses(uniqueCourses.length > 0 ? uniqueCourses : ['Data Science with AI', 'AI & Generative AI', 'Full stack python', 'SAP Fico', 'Digital marketing']);
      }

      if (batchesList.length > 0) {
        setBatches(batchesList);
      } else {
        const uniqueBatches = Array.from(new Set(data.map(s => s.batch_number).filter(Boolean))) as string[];
        const fallback = (uniqueBatches.length > 0 ? uniqueBatches : ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4', 'Batch 5']).map((b, idx) => ({
          id: `batch_${idx + 1}`,
          name: b,
          course_id: '',
          module_progress_json: '{}'
        }));
        setBatches(fallback);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openStudentDetail = async (stu: StudentStat) => {
    setSelectedStudent(stu);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await getStudentModulesAndActivity(stu.id, stu.course || '');
      setDetailData(res);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  const handleAdjust = async () => {
    if (!adjustModal) return;
    setAdjustSaving(true);
    try {
      const { student, field } = adjustModal;
      await adjustStudentMetrics(student.id, field, adjustDelta, adjustReason);
      setAdjustModal(null);
      setAdjustDelta(0);
      setAdjustReason('');
      await loadData();
      if (selectedStudent?.id === student.id) openStudentDetail(student);
    } catch (e) { console.error(e); alert('Failed to adjust.'); }
    finally { setAdjustSaving(false); }
  };

  const handleModuleAdjust = async (moduleId: string, action: 'add' | 'remove') => {
    if (!selectedStudent) return;
    setDetailLoading(true);
    try {
      await updateStudentModuleProgress(selectedStudent.id, moduleId, action);
      await openStudentDetail(selectedStudent);
    } catch (e) { console.error(e); alert('Failed to update module progress'); setDetailLoading(false); }
  };

  const [editStudentId, setEditStudentId] = useState<string | null>(null);
  
  // Extended fields
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [feesTotal, setFeesTotal] = useState<number | ''>('');
  const [feesPaid, setFeesPaid] = useState<number | ''>('');
  const [joiningDate, setJoiningDate] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [trainingStartDate, setTrainingStartDate] = useState('');
  const [topicCompleted, setTopicCompleted] = useState('');
  const [documentsSubmitted, setDocumentsSubmitted] = useState<number | ''>(0);
  const [aadharFile, setAadharFile] = useState<string>('');
  const [otherAttachments, setOtherAttachments] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setter(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleEditStudent = async (stu: any) => {
    setEditStudentId(stu.id);
    setName(stu.name || '');
    setEmail(stu.email || '');
    setPassword('');
    setStuPhone(stu.phone || '');
    setStuCourse(stu.course || '');
    setStuBatch(stu.batch_number || '');
    setStatus(stu.status || 'Active');
    
    // Fetch full student profile and user password
    try {
      const r = await getStudentDetail(stu.id);
      if (r) {
        setDob(r.dob as string || '');
        setAddress(r.address as string || '');
        setGender(r.gender as string || '');
        setBloodGroup(r.blood_group as string || '');
        setFeesTotal(r.fees_total as number || '');
        setFeesPaid(r.fees_paid as number || '');
        setJoiningDate(r.joining_date as string || '');
        setFatherName(r.father_name as string || '');
        setMotherName(r.mother_name as string || '');
        setEmergencyContact(r.emergency_contact as string || '');
        setTrainingStartDate(r.training_start_date as string || '');
        setTopicCompleted(r.topic_completed as string || '');
        setAadharFile(r.aadhar_file as string || '');
        setOtherAttachments(r.other_attachments as string || '');
        setDocumentsSubmitted(r.documents_submitted as number || '');
      }
      
      // Fetch user password
      if (stu.email) {
        const encPw = await getUserPasswordEncrypted(stu.email);
        if (encPw) {
          setPassword(decryptPassword(encPw));
        }
      }
    } catch(e) {}
    
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = async () => {
    if (!name.trim() || !email.trim()) { alert('Name and email required.'); return; }
    try {
      let existingUserId: string | undefined = undefined;
      if (editStudentId) {
        existingUserId = await findUserIdByEmail(email);
      }
      const studentData = {
        id: existingUserId,
        name, email, password, status, phone: stuPhone, course: stuCourse, batch_number: stuBatch,
        joining_date: joiningDate
      };
      
      // saveStudent handles both INSERT and UPDATE for users and students tables, including password encryption
      await saveStudent(studentData);
      
      // Update student profile
      await updateStudentProfile(email, {
        name, phone: stuPhone, course: stuCourse, batch_number: stuBatch, status,
        dob, address, gender, blood_group: bloodGroup, 
        fees_total: Number(feesTotal) || 0, 
        fees_paid: Number(feesPaid) || 0,
        joining_date: joiningDate,
        father_name: fatherName,
        mother_name: motherName,
        emergency_contact: emergencyContact,
        training_start_date: trainingStartDate,
        topic_completed: topicCompleted,
        documents_submitted: Number(documentsSubmitted) || 0,
        aadhar_file: aadharFile,
        other_attachments: otherAttachments
      });

      await loadData();
      setIsStudentModalOpen(false);
      setEditStudentId(null);
      setName(''); setEmail(''); setPassword(''); setStuPhone(''); setStuCourse(''); setStuBatch('');
      setDob(''); setAddress(''); setGender(''); setBloodGroup(''); setFeesTotal(''); setFeesPaid(''); setJoiningDate(''); setFatherName(''); setMotherName(''); setEmergencyContact(''); setTrainingStartDate(''); setTopicCompleted(''); setDocumentsSubmitted('');
    } catch (e: any) {
      console.error(e);
      alert('Failed to save student. ' + (e.message || ''));
    }
  };

  const parseCsv = (text: string) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  };

  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      const validRows = rows.filter(row => {
        const existing = (row.existing_student_y_n || row.existing_student || row.existing || '').toLowerCase();
        return !['n', 'no', 'false', '0'].includes(existing);
      });
      if (validRows.length < rows.length) alert(`Filtered out ${rows.length - validRows.length} rows where 'Existing student' was N.`);
      setCsvPreview(validRows);
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    setCsvImporting(true);
    const result = await bulkImportStudents(csvPreview);
    setCsvResult(result);
    setCsvImporting(false);
    await loadData();
  };

  const downloadSampleCsv = () => {
    const headers = 'name,email,phone,course,batch_number,joining_date,training_start_date,status,gender,blood_group,address,emergency_contact,fees_total,fees_paid,dob,existing_student_y_n';
    const row1 = 'Rahul Sharma,rahul@example.com,9876543210,Data Science with AI,July 2026,2026-07-15,2026-07-20,Active,Male,B+,"123 Main St, Mumbai",9876500000,50000,25000,2003-05-10,Y';
    const csvContent = [headers, row1].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sample_students.csv'; a.click();
    window.URL.revokeObjectURL(url);
  };

  const statusColor: Record<string, string> = { Active: '#10b981', Suspended: '#ef4444', Alumni: '#8b5cf6', Pending: '#f59e0b' };
  const inputCls = "w-full bg-erp-background border border-erp-border rounded-xl px-3 py-2 text-sm text-erp-text focus:outline-none focus:border-indigo-500";

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-erp-text flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-indigo-500" />
              Student Directory
            </h1>
            <p className="text-erp-text/60 text-sm mt-0.5">{students.length} students enrolled</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-indigo-400" onClick={downloadSampleCsv}>
              <Download className="w-4 h-4 mr-2" /> Sample CSV
            </Button>
            {!isReadOnly && (
              <>
                <Button variant="secondary" onClick={() => setShowCsvModal(true)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Import CSV
                </Button>
                <Button onClick={() => { setEditStudentId(null); setName(''); setEmail(''); setPassword(''); setStuPhone(''); setStuCourse(''); setStuBatch(''); setStatus('Active'); setDob(''); setAddress(''); setGender(''); setBloodGroup(''); setFeesTotal(''); setFeesPaid(''); setJoiningDate(''); setIsStudentModalOpen(true); }}>
                  <UserPlus className="w-4 h-4 mr-2" /> Add Student
                </Button>
              </>
            )}
            {isReadOnly && (
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center">
                View Only Access
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-5 border-b border-erp-border">
          <button
            className={`pb-2 px-1 font-bold capitalize ${activeTab === 'students' ? 'text-erp-primary border-b-2 border-erp-primary' : 'text-erp-text/50 hover:text-erp-text'}`}
            onClick={() => { setActiveTab('students'); }}
          >All Students</button>
          {(me?.role === 'CEO' || me?.role === 'Manager') && (
            <button
              className={`pb-2 px-1 font-bold capitalize ${activeTab === 'pending' ? 'text-erp-primary border-b-2 border-erp-primary' : 'text-erp-text/50 hover:text-erp-text'}`}
              onClick={() => { setActiveTab('pending'); }}
            >
              Pending Approvals {pendingStudents.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">{pendingStudents.length}</span>}
            </button>
          )}
          {(me?.role === 'CEO' || me?.role === 'Manager') && (
            <button
              className={`pb-2 px-1 font-bold capitalize ${activeTab === 'batches' ? 'text-erp-primary border-b-2 border-erp-primary' : 'text-erp-text/50 hover:text-erp-text'}`}
              onClick={() => { setActiveTab('batches'); }}
            >
              Batches
            </button>
          )}
        </div>

        {activeTab === 'students' && (
          <>
            {/* Aggregate Cards */}
            <div className="flex gap-4 overflow-x-auto mb-4 pb-2 snap-x hide-scrollbar">
              <div 
                onClick={() => { setCourseFilter(''); setBatchFilter(''); }}
                className={`snap-start flex-shrink-0 cursor-pointer min-w-[150px] p-4 rounded-2xl border ${!courseFilter && !batchFilter ? 'border-indigo-500 bg-indigo-500/10' : 'border-erp-border bg-erp-surface hover:border-indigo-500/50'}`}
              >
                <div className="text-xs font-bold text-erp-text/50 uppercase">All Students</div>
                <div className="text-2xl font-black mt-1">{studentStats.reduce((s, r) => s + Number(r.cnt), 0)}</div>
              </div>
              {courses.map(c => {
                const cCount = studentStats.filter(s => s.course === c).reduce((s, r) => s + Number(r.cnt), 0);
                const cBatches = batches.filter(b => b.course_id === c || b.name.includes(c));
                return (
                  <div key={c} className="snap-start flex-shrink-0 flex gap-2">
                    <div 
                      onClick={() => { setCourseFilter(c); setBatchFilter(''); }}
                      className={`cursor-pointer min-w-[180px] p-4 rounded-2xl border ${courseFilter === c && !batchFilter ? 'border-indigo-500 bg-indigo-500/10' : 'border-erp-border bg-erp-surface hover:border-indigo-500/50'}`}
                    >
                      <div className="text-xs font-bold text-erp-text/50 uppercase truncate" title={c}>{c}</div>
                      <div className="text-2xl font-black mt-1">{cCount} <span className="text-sm font-normal text-erp-text/50">students</span></div>
                    </div>
                    {courseFilter === c && cBatches.map(b => {
                      const bCount = studentStats.filter(s => s.course === c && String(s.batch_number) === String(b.id)).reduce((s, r) => s + Number(r.cnt), 0);
                      return (
                        <div 
                          key={b.id}
                          onClick={() => { setCourseFilter(c); setBatchFilter(b.id); }}
                          className={`cursor-pointer min-w-[150px] p-4 rounded-2xl border ${batchFilter === b.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-erp-border bg-erp-surface hover:border-emerald-500/50'}`}
                        >
                          <div className="text-xs font-bold text-erp-text/50 uppercase truncate" title={b.name}>{b.name}</div>
                          <div className="text-2xl font-black mt-1">{bCount} <span className="text-sm font-normal text-erp-text/50">students</span></div>
                        </div>
                      )
                    })}
                  </div>
                );
              })}
            </div>

            {/* Filters */}
            <div className="bg-erp-surface border border-erp-border rounded-2xl p-4 mb-4 flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone..." className={`${inputCls} pl-9`} />
              </div>
              <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className={`w-48 ${inputCls}`}>
                <option value="">All Courses</option>
                {courses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className={`w-36 ${inputCls}`}>
                <option value="">All Batches</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`w-32 ${inputCls}`}>
                <option value="">All Status</option>
                {['Active', 'Suspended', 'Alumni', 'Pending'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
              ) : students.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-erp-text/40"><Users className="w-12 h-12 mb-2" /><p className="font-bold">No students found</p></div>
              ) : (
                <div className="space-y-2">
                  {students.map(stu => (
                    <div key={stu.id} onClick={() => openStudentDetail(stu)}
                      className={`flex items-center gap-4 px-4 py-3 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${selectedStudent?.id === stu.id ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-erp-border bg-erp-surface hover:border-erp-border/60'}`}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0" style={{ background: `linear-gradient(135deg, #6366f1, #8b5cf6)` }}>
                        {stu.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><p className="font-bold text-erp-text text-sm truncate">{stu.name}</p><Badge color={statusColor[stu.status || 'Active'] || '#64748b'}>{stu.status || 'Active'}</Badge></div>
                        <div className="flex items-center gap-3 text-xs text-erp-text/50 mt-0.5">{stu.course && <span className="truncate max-w-[160px]">{stu.course}</span>}{stu.batch_number && <span>Batch {stu.batch_number}</span>}</div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316' }}><Flame className="w-3 h-3" />{stu.streak}</span>
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}><Coins className="w-3 h-3" />{stu.coins}</span>
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}><BookOpen className="w-3 h-3" />{stu.completedClasses}</span>
                        <span className="text-xs font-black px-2 py-1 rounded-lg text-white" style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)' }}>LVL {stu.level}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-erp-text/30 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'pending' && (
          <div className="flex-1 overflow-y-auto">
            <DataTable 
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'portal_login_email', header: 'Email' },
                { key: 'phone', header: 'Phone' },
                { key: 'course', header: 'Course' },
                { key: 'actions', header: 'Actions', filterable: false, render: (row: any) => (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setApprovingStudentId(row.id); setApproveForm({ student_id: row.id, password: 'cnx' + Math.floor(1000 + Math.random() * 9000), portalId: 'CNX-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000), batch: '' }); setIsApproveModalOpen(true); }} className="px-3 py-1.5 text-xs font-bold text-white bg-green-500 hover:bg-green-600 rounded-lg">Approve</button>
                    <button onClick={async () => { if (confirm('Reject?')) { await rejectStudent(row.id); loadData(); } }} className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg">Reject</button>
                  </div>
                )}
              ]}
              data={pendingStudents} 
            />
          </div>
        )}

        {activeTab === 'batches' && (
          <BatchesTab />
        )}
      </div>

      {/* ── Right: Student Detail Panel ── */}
      {selectedStudent && (
        <div className="hidden lg:flex flex-col w-96 flex-shrink-0 border-l border-erp-border bg-erp-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-erp-border">
            <h2 className="font-black text-erp-text text-base">Student Profile</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => handleEditStudent(selectedStudent)} className="text-indigo-400 hover:text-indigo-500 text-sm font-bold flex items-center gap-1"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
              <button onClick={() => setSelectedStudent(null)} className="text-erp-text/40 hover:text-erp-text"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
                {selectedStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-black text-erp-text text-lg">{selectedStudent.name}</p>
                <Badge color={statusColor[selectedStudent.status || 'Active'] || '#64748b'}>{selectedStudent.status || 'Active'}</Badge>
                <p className="text-erp-text/50 text-xs mt-1">{selectedStudent.course || 'No course'} · Batch {selectedStudent.batch_number || '—'}</p>
              </div>
            </div>
            {/* Gamification Stats */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-erp-text/40 mb-2">Gamification</p>
              <div className="flex gap-2">
                <button onClick={() => setAdjustModal({ student: selectedStudent, field: 'streak' })} className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl hover:opacity-80 transition-opacity" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <Flame className="w-5 h-5 text-orange-500" /><span className="text-xl font-black text-orange-500">{selectedStudent.streak}</span><span className="text-[10px] font-bold text-erp-text/40 uppercase">Streak</span>
                </button>
                <button onClick={() => setAdjustModal({ student: selectedStudent, field: 'coins' })} className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl hover:opacity-80 transition-opacity" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <Coins className="w-5 h-5 text-amber-500" /><span className="text-xl font-black text-amber-500">{selectedStudent.coins}</span><span className="text-[10px] font-bold text-erp-text/40 uppercase">Coins</span>
                </button>
                <button onClick={() => setAdjustModal({ student: selectedStudent, field: 'badges' })} className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl hover:opacity-80 transition-opacity" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <Shield className="w-5 h-5 text-violet-500" /><span className="text-xl font-black text-violet-500">{selectedStudent.badges}</span><span className="text-[10px] font-bold text-erp-text/40 uppercase">Badges</span>
                </button>
              </div>
            </div>
            {/* Contact */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-erp-text/40 mb-2">Contact</p>
              <div className="space-y-2">
                {selectedStudent.email && <div className="flex items-center gap-2 text-sm text-erp-text/70"><Mail className="w-4 h-4 text-erp-text/30" /><span className="truncate">{selectedStudent.email}</span></div>}
                {selectedStudent.phone && <div className="flex items-center gap-2 text-sm text-erp-text/70"><Phone className="w-4 h-4 text-erp-text/30" />{selectedStudent.phone}</div>}
              </div>
            </div>
            {/* Modules */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-erp-text/40 mb-2">Module Progress <span className="text-[9px] text-emerald-400 ml-1">← from Course CMS</span></p>
              {detailLoading ? <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" /> : (
                <div className="space-y-2">
                  {detailData?.modules?.map((mod: any) => {
                    const total = Number(mod.totalClasses) || 0; const done = Number(mod.completedClasses) || 0;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div key={mod.id} className="bg-erp-background rounded-xl p-3 border border-erp-border">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-bold text-erp-text truncate flex-1 mr-2">{mod.title}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-black text-indigo-400">{done}/{total}</span>
                            <div className="flex items-center bg-erp-background border border-erp-border rounded-lg overflow-hidden">
                              <button onClick={() => handleModuleAdjust(mod.id, 'remove')} disabled={done === 0 || detailLoading} className="px-1.5 py-0.5 hover:bg-erp-border/30 disabled:opacity-30 text-erp-text/60"><Minus className="w-3 h-3" strokeWidth={3} /></button>
                              <button onClick={() => handleModuleAdjust(mod.id, 'add')} disabled={detailLoading} className="px-1.5 py-0.5 hover:bg-erp-border/30 disabled:opacity-30 text-erp-text/60 border-l border-erp-border"><Plus className="w-3 h-3" strokeWidth={3} /></button>
                            </div>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden bg-erp-border/40"><div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <h3 className="font-black text-erp-text mb-4">Adjust {adjustModal.field}</h3>
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setAdjustDelta(d => d - 1)} disabled={adjustModal.field === 'badges'} className="w-10 h-10 rounded-xl border border-erp-border text-red-400 font-black">-</button>
              <input type="number" value={adjustDelta} onChange={e => setAdjustDelta(Number(e.target.value))} className="flex-1 text-center font-black text-2xl bg-erp-background border border-erp-border rounded-xl py-2" />
              <button onClick={() => setAdjustDelta(d => d + 1)} className="w-10 h-10 rounded-xl border border-erp-border text-green-400 font-black">+</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setAdjustModal(null); setAdjustDelta(0); }} className="flex-1 px-4 py-2 border rounded-xl" disabled={adjustSaving}>Cancel</button>
              <button onClick={handleAdjust} disabled={adjustSaving} className="flex-1 px-4 py-2 bg-indigo-500 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">{adjustSaving && <Loader2 className="w-4 h-4 animate-spin" />}Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="p-5 border-b border-erp-border flex justify-between items-center"><h2 className="font-bold text-xl">{editStudentId ? 'Edit Student' : 'Add New Student'}</h2><button onClick={() => setIsStudentModalOpen(false)}><X className="w-6 h-6" /></button></div>
            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-black text-erp-text mb-3 uppercase tracking-wider text-erp-text/50">Basic Info</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold mb-1 block">Full Name *</label><input className={inputCls} value={name} onChange={e=>setName(e.target.value)} /></div>
                    <div><label className="text-xs font-bold mb-1 block">Portal Login Email *</label><input className={inputCls} value={email} onChange={e=>setEmail(e.target.value)} disabled={!!editStudentId} /></div>
                    <div><label className="text-xs font-bold mb-1 block">Password *</label><input className={inputCls} value={password} onChange={e=>setPassword(e.target.value)} /></div>
                    <div><label className="text-xs font-bold mb-1 block">Phone</label><input className={inputCls} value={stuPhone} onChange={e=>setStuPhone(e.target.value)} /></div>
                    <div><label className="text-xs font-bold mb-1 block">DOB</label><input type="date" className={inputCls} value={dob} onChange={e=>setDob(e.target.value)} /></div>
                    <div><label className="text-xs font-bold mb-1 block">Gender</label><select className={inputCls} value={gender} onChange={e=>setGender(e.target.value)}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
                    <div><label className="text-xs font-bold mb-1 block">Blood Group</label><input className={inputCls} value={bloodGroup} onChange={e=>setBloodGroup(e.target.value)} placeholder="e.g. O+" /></div>
                    <div><label className="text-xs font-bold mb-1 block">Emergency Contact</label><input className={inputCls} value={emergencyContact} onChange={e=>setEmergencyContact(e.target.value)} /></div>
                    <div className="col-span-2"><label className="text-xs font-bold mb-1 block">Address</label><input className={inputCls} value={address} onChange={e=>setAddress(e.target.value)} /></div>
                    <div><label className="text-xs font-bold mb-1 block">Father's Name</label><input className={inputCls} value={fatherName} onChange={e=>setFatherName(e.target.value)} /></div>
                    <div><label className="text-xs font-bold mb-1 block">Mother's Name</label><input className={inputCls} value={motherName} onChange={e=>setMotherName(e.target.value)} /></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-black text-erp-text mb-3 uppercase tracking-wider text-erp-text/50">Enrollment & Progress</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold mb-1 block">Course</label>
                      <select className={inputCls} value={stuCourse} onChange={e=>setStuCourse(e.target.value)}>
                        <option value="">Select Course</option>
                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold mb-1 block">Batch</label>
                      {!isCustomBatchMode ? (
                        <select 
                          className={inputCls} 
                          value={stuBatch} 
                          onChange={e => {
                            if (e.target.value === '__custom__') {
                              setIsCustomBatchMode(true);
                              setStuBatch('');
                            } else {
                              setStuBatch(e.target.value);
                            }
                          }}
                        >
                          <option value="">Select or type new batch</option>
                          {batches.filter(b => !stuCourse || !b.course_id || b.course_id === stuCourse || b.name.toLowerCase().includes(stuCourse.toLowerCase())).map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                          {stuBatch && !batches.some(b => b.name === stuBatch) && (
                            <option value={stuBatch}>{stuBatch}</option>
                          )}
                          <option value="__custom__">+ Type New Batch...</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            className={inputCls} 
                            value={stuBatch} 
                            onChange={e => setStuBatch(e.target.value)} 
                            placeholder="Enter custom batch name"
                            autoFocus
                          />
                          <button 
                            type="button" 
                            onClick={() => setIsCustomBatchMode(false)}
                            className="text-xs text-indigo-500 font-bold px-2 py-1.5 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/10 shrink-0"
                            title="Switch to existing batches dropdown"
                          >
                            Dropdown
                          </button>
                        </div>
                      )}
                    </div>
                    <div><label className="text-xs font-bold mb-1 block">Joining Date</label><input type="date" className={inputCls} value={joiningDate} onChange={e=>setJoiningDate(e.target.value)} /></div>
                    <div><label className="text-xs font-bold mb-1 block">Training Start Date</label><input type="date" className={inputCls} value={trainingStartDate} onChange={e=>setTrainingStartDate(e.target.value)} /></div>
                    <div><label className="text-xs font-bold mb-1 block">Status</label><select className={inputCls} value={status} onChange={e=>setStatus(e.target.value)}><option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Alumni">Alumni</option></select></div>
                    <div><label className="text-xs font-bold mb-1 block">Topic Completed</label><input className={inputCls} value={topicCompleted} onChange={e=>setTopicCompleted(e.target.value)} placeholder="e.g. 10/20" /></div>
                    <div><label className="text-xs font-bold mb-1 block">Fees Total</label><input type="number" className={inputCls} value={feesTotal} onChange={e=>setFeesTotal(Number(e.target.value))} /></div>
                    <div><label className="text-xs font-bold mb-1 block">Fees Paid</label><input type="number" className={inputCls} value={feesPaid} onChange={e=>setFeesPaid(Number(e.target.value))} /></div>
                    <div>
     <label className="text-xs font-bold mb-1 block">Existing Student?</label>
     <select className={inputCls} value={documentsSubmitted === 1 ? 'Y' : 'N'} onChange={e=>setDocumentsSubmitted(e.target.value === 'Y' ? 1 : 0)}>
       <option value="Y">Y</option>
       <option value="N">N</option>
     </select>
   </div>
                  </div>

                  <h3 className="text-sm font-bold text-erp-text border-b border-erp-border pb-2 mt-6 mb-4">Attachments</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold mb-1 block">Aadhar Card</label>
                      <input type="file" accept="image/*,application/pdf" onChange={e => handleFileUpload(e, setAadharFile)} className={inputCls + " p-1"} />
                      {aadharFile && <p className="text-xs text-green-500 mt-1 font-semibold">File uploaded</p>}
                    </div>
                    <div>
                      <label className="text-xs font-bold mb-1 block">Other Attachments</label>
                      <input type="file" accept="image/*,application/pdf" onChange={e => handleFileUpload(e, setOtherAttachments)} className={inputCls + " p-1"} />
                      {otherAttachments && <p className="text-xs text-green-500 mt-1 font-semibold">File uploaded</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-erp-border flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsStudentModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveStudent}>{editStudentId ? 'Save Changes' : 'Add Student'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Pending Student Modal */}
      {isApproveModalOpen && approvingStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-md shadow-2xl p-5">
            <h2 className="text-lg font-bold mb-4">Approve Student</h2>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold mb-1">Student Portal ID *</label><input type="text" value={approveForm.portalId} onChange={e => setApproveForm({...approveForm, portalId: e.target.value})} className={inputCls} placeholder="e.g. CNX-2026-1001" /></div>
              <div><label className="block text-xs font-bold mb-1">Set Password *</label><input type="text" value={approveForm.password} onChange={e => setApproveForm({...approveForm, password: e.target.value})} className={inputCls} /></div>
              <div>
                <label className="block text-xs font-bold mb-1">Assign Batch</label>
                <select 
                  value={approveForm.batch} 
                  onChange={e => setApproveForm({...approveForm, batch: e.target.value})} 
                  className={inputCls}
                >
                   <option value="">Select Batch</option>
                   {batches.filter(b => {
                      const stu = pendingStudents.find(s => s.id === approvingStudentId);
                      return !stu || !stu.course || !b.course_id || b.course_id === stu.course || b.name.toLowerCase().includes(stu.course.toLowerCase());
                   }).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setIsApproveModalOpen(false); setApprovingStudentId(null); }}>Cancel</Button>
              <Button onClick={async () => {
                if (!approveForm.password || !approveForm.portalId) return alert("Portal ID and Password required.");
                const stu = pendingStudents.find(s => s.id === approvingStudentId);
                if (!stu) return alert("Student not found.");
                
                await approveStudent(approvingStudentId, approveForm.portalId, approveForm.password, stu.portal_login_email, stu.name);
                if (approveForm.batch) {
                  await updateStudentProfile(stu.portal_login_email, { batch_number: approveForm.batch });
                }
                await updateStudentLeadStatus(stu.portal_login_email, stu.phone);
                
                alert("Approved!");
                setIsApproveModalOpen(false); setApprovingStudentId(null);
                loadData();
              }}>Approve</Button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-3xl shadow-2xl p-5">
             <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">Import CSV</h2><button onClick={() => { setShowCsvModal(false); setCsvResult(null); setCsvPreview([]); }}><X /></button></div>
             <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleCsvFile(e.target.files[0])} />
             
             {csvResult ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4 text-emerald-400 text-sm">
                  <p className="font-bold">Import Summary:</p>
                  <p>Success: {csvResult.imported ?? csvResult.successCount ?? csvResult.length ?? 'Done'}</p>
                  {csvResult.failed > 0 && <p className="text-red-400">Failed: {csvResult.failed}</p>}
                </div>
             ) : null}

             {csvPreview.length === 0 ? (
                <button onClick={() => csvInputRef.current?.click()} className="w-full border-2 border-dashed border-erp-border rounded-xl p-8 text-center hover:border-indigo-500">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-bold">Click to select CSV</p>
                </button>
             ) : (
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{Object.keys(csvPreview[0]).map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{csvPreview.slice(0,5).map((row, i)=><tr key={i}>{Object.values(row).map((v:any,j)=><td key={j} className="p-2">{v}</td>)}</tr>)}</tbody></table></div>
             )}

             <div className="mt-4 flex justify-end gap-2">
               <Button variant="ghost" onClick={() => { setCsvPreview([]); setCsvResult(null); }}>Clear</Button>
               <Button disabled={csvPreview.length===0 || csvImporting} onClick={handleCsvImport}>{csvImporting ? 'Importing...' : 'Import'}</Button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
