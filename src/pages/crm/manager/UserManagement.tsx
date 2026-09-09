import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/erp/Button';
import { 
  Users, Key, Plus, Minus, X, Edit, Search, Trash2, Shield,
  Layers, Calendar, Clock, BookOpen, GraduationCap, UserCheck, UserPlus, UserMinus,
  CheckSquare, Square, ChevronDown, ChevronRight, BarChart3
} from 'lucide-react';
import { decryptPassword } from '../../../lib/crypto';
import { getCurrentUser, updateCurrentUserSession, getUserPermissions } from '../../../lib/auth';
import { getUsers, saveUser, deleteUser, patchUser, getFilterOptions } from '../../../lib/api/users';
import { getErpModules, assignModulesToInstructor } from '../../../lib/api/manager';
import { 
  getAllBatches, createBatch, updateBatch, deleteBatch, BatchItem,
  getStudentsInBatch, getAllStudentsForAssignment, assignStudentsToBatch,
  removeStudentFromBatch, StudentAssignmentItem, parseBatchSubjectProgress,
  updateBatchSubjectProgress, SubjectClassProgress
} from '../../../lib/api/batches';
import { DataTable } from '../../../components/ui/erp/DataTable';

import { SYSTEM_MODULES, DEFAULT_PERMISSIONS, AccessLevel } from '../../../lib/permissionsRegistry';

interface ERPUser {
  id: string; name: string; email: string;
  password_encrypted: string; role: string; salary: number;
  status?: string; permissions_json?: string;
  phone?: string;
}

function PermissionsDropdown({ 
  userRow, 
  onPermissionsChange 
}: { 
  userRow: ERPUser; 
  onPermissionsChange: (targetUser: ERPUser, newPerms: Record<string, AccessLevel>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const modulesList = SYSTEM_MODULES || [];
  const userPerms = userRow ? getUserPermissions(userRow as any) : { ...DEFAULT_PERMISSIONS };

  const isModuleChecked = (modId: string) => {
    return (userPerms && userPerms[modId]) ? userPerms[modId] !== 'none' : true;
  };

  const allChecked = modulesList.length > 0 && modulesList.every(mod => isModuleChecked(mod.id));

  const handleToggleModule = (modId: string) => {
    const current = isModuleChecked(modId);
    const updated: Record<string, AccessLevel> = { ...userPerms };
    updated[modId] = current ? 'none' : 'full';
    if (userRow) onPermissionsChange(userRow, updated);
  };

  const handleToggleAll = () => {
    const target: AccessLevel = allChecked ? 'none' : 'full';
    const updated: Record<string, AccessLevel> = { ...userPerms };
    modulesList.forEach(mod => {
      updated[mod.id] = target;
    });
    if (userRow) onPermissionsChange(userRow, updated);
  };

  const filteredModules = modulesList.filter(mod => 
    !searchQuery.trim() || 
    (mod.label && mod.label.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
    (mod.category && mod.category.toLowerCase().includes(searchQuery.toLowerCase().trim()))
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg flex items-center gap-0.5 transition-colors"
        title="Manage Module Access Controls"
      >
        <Shield className="w-4 h-4" />
        <ChevronDown className="w-3 h-3 text-blue-400" />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-erp-surface border border-erp-border rounded-xl shadow-2xl p-3 text-left space-y-2 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Box matching Image 3 */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-erp-text/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-erp-background border border-erp-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-erp-text focus:outline-none focus:border-blue-500 font-medium"
              autoFocus
            />
          </div>

          {/* List Container matching Image 3 */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 divide-y divide-erp-border/30 pr-1">
            {/* All Option */}
            {!searchQuery && (
              <label className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-erp-background/80 rounded-lg cursor-pointer text-xs font-bold text-erp-text transition-colors">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={handleToggleAll}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-erp-border cursor-pointer"
                />
                <span>All</span>
              </label>
            )}

            {/* Individual Module Checkboxes */}
            {filteredModules.map(mod => {
              const checked = isModuleChecked(mod.id);
              return (
                <label 
                  key={mod.id} 
                  className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-erp-background/80 rounded-lg cursor-pointer text-xs font-medium text-erp-text transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleModule(mod.id)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-erp-border cursor-pointer shrink-0"
                  />
                  <span className="truncate">{mod.label}</span>
                </label>
              );
            })}

            {filteredModules.length === 0 && (
              <p className="text-[11px] text-erp-text/40 py-2 text-center">No modules found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserManagement() {
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState<ERPUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'staff' | 'batches'>('staff');

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Staff Modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<ERPUser | null>(null);

  // Staff Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Sales/HR');
  const [salary, setSalary] = useState<number | ''>(0);
  const [status, setStatus] = useState('Active');

  // Batches State
  const [batchesList, setBatchesList] = useState<BatchItem[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('');
  const [batchCourseFilter, setBatchCourseFilter] = useState('');
  const [availableCourseOptions, setAvailableCourseOptions] = useState<string[]>([]);

  // Batch Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
  const [batchName, setBatchName] = useState('');
  const [batchCourse, setBatchCourse] = useState('');
  const [batchTeacherId, setBatchTeacherId] = useState('');
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchTiming, setBatchTiming] = useState('');
  const [batchMaxStudents, setBatchMaxStudents] = useState<number>(30);
  const [batchStatus, setBatchStatus] = useState<'Active' | 'Upcoming' | 'Completed' | 'Paused'>('Active');

  // Student Batch Assignment Modal State
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [activeBatchForStudents, setActiveBatchForStudents] = useState<BatchItem | null>(null);
  const [batchStudents, setBatchStudents] = useState<StudentAssignmentItem[]>([]);
  const [allStudentsList, setAllStudentsList] = useState<StudentAssignmentItem[]>([]);
  const [studentModalTab, setStudentModalTab] = useState<'enrolled' | 'add'>('enrolled');
  const [studentModalSearch, setStudentModalSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [studentModalLoading, setStudentModalLoading] = useState(false);

  // Expanded Batch Rows for Subject Progress Dropdown
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());

  const toggleBatchExpand = (batchId: string) => {
    setExpandedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const handleAdjustSubjectClasses = async (batch: BatchItem, subjectName: string, delta: number) => {
    const currentList = parseBatchSubjectProgress(batch);
    const updated = currentList.map(s => {
      if (s.subject === subjectName) {
        const newCount = Math.max(0, s.completed + delta);
        return { ...s, completed: newCount };
      }
      return s;
    });

    setBatchesList(prev => prev.map(b => {
      if (b.id === batch.id) {
        const totalCompleted = updated.reduce((acc, item) => acc + item.completed, 0);
        const totalClasses = updated.reduce((acc, item) => acc + (item.total || 10), 0);
        const pct = totalClasses > 0 ? Math.min(100, Math.round((totalCompleted / totalClasses) * 100)) : 0;
        return {
          ...b,
          subject_progress_json: JSON.stringify(updated),
          completion_percentage: pct
        };
      }
      return b;
    }));

    await updateBatchSubjectProgress(batch.id, updated);
  };

  const handleAddSubjectToBatch = async (batch: BatchItem) => {
    const subjectName = prompt("Enter new subject name (e.g. React, Node.js, DSA):");
    if (!subjectName || !subjectName.trim()) return;
    const currentList = parseBatchSubjectProgress(batch);
    if (currentList.some(s => s.subject.toLowerCase().trim() === subjectName.toLowerCase().trim())) {
      alert("Subject already exists in this batch.");
      return;
    }
    const updated = [...currentList, { subject: subjectName.trim(), completed: 0, total: 10 }];

    setBatchesList(prev => prev.map(b => {
      if (b.id === batch.id) {
        const totalCompleted = updated.reduce((acc, item) => acc + item.completed, 0);
        const totalClasses = updated.reduce((acc, item) => acc + (item.total || 10), 0);
        const pct = totalClasses > 0 ? Math.min(100, Math.round((totalCompleted / totalClasses) * 100)) : 0;
        return {
          ...b,
          subject_progress_json: JSON.stringify(updated),
          completion_percentage: pct
        };
      }
      return b;
    }));

    await updateBatchSubjectProgress(batch.id, updated);
  };
  
  const [permissions, setPermissions] = useState<Record<string, AccessLevel>>({ ...DEFAULT_PERMISSIONS });

  const [allModules, setAllModules] = useState<any[]>([]);
  const [assignedModules, setAssignedModules] = useState<string[]>([]);

  useEffect(() => { 
    fetchUsersData(); 
    getErpModules().then(setAllModules).catch(console.error);
    getFilterOptions().then(opt => setAvailableCourseOptions(opt.courses)).catch(console.error);
  }, [filters, sortBy, sortDir]);

  // Load batches when switching to batches tab
  useEffect(() => {
    if (activeTab === 'batches') {
      fetchBatchesData();
    }
  }, [activeTab]);

  const fetchUsersData = async () => {
    try {
      setLoading(true);
      const queryFilters = { ...filters, role: { _neq: 'Student' } };
      const data = await getUsers(queryFilters, sortBy, sortDir);
      setUsers(data);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchesData = async () => {
    try {
      setBatchesLoading(true);
      const data = await getAllBatches();
      setBatchesList(data);
    } catch (e) {
      console.error('Failed to load batches', e);
    } finally {
      setBatchesLoading(false);
    }
  };

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => { const n = { ...prev }; if (value) n[key] = value; else delete n[key]; return n; });
  };

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setPassword(''); setRole('Sales/HR'); setSalary(0); setStatus('Active');
    setPermissions(DEFAULT_PERMISSIONS);
  };

  const handleOpenModal = (user: ERPUser | null) => {
    if (user) {
      setEditUser(user);
      setName(user.name); setEmail(user.email); setPhone(user.phone || '');
      setPassword(decryptPassword(user.password_encrypted));
      setRole(user.role || 'Sales/HR'); setSalary(user.salary || 0);
      setStatus(user.status || 'Active');
      if (user.permissions_json) {
        try { 
          const parsed = JSON.parse(user.permissions_json);
          const upgraded = { ...DEFAULT_PERMISSIONS };
          for (const key of Object.keys(parsed)) {
            if (typeof parsed[key] === 'boolean') {
              upgraded[key] = parsed[key] ? 'full' : 'none';
            } else if (typeof parsed[key] === 'string') {
              upgraded[key] = parsed[key] as AccessLevel;
            }
          }
          setPermissions(upgraded);
        } catch { setPermissions(DEFAULT_PERMISSIONS); }
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
      }
      setAssignedModules(allModules.filter(m => m.instructor_id === user.id).map(m => m.id));
    } else {
      setEditUser(null);
      resetForm();
      setAssignedModules([]);
    }
    setIsStaffModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!name.trim() || !email.trim()) { alert('Name and email are required.'); return; }
    try {
      const newUserId = editUser?.id || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const permissionsStr = JSON.stringify(permissions);
      await saveUser({ id: newUserId, name, email, phone, password, role, status, salary: Number(salary) || 0, permissions_json: permissionsStr });
      
      if (currentUser && (currentUser.id === newUserId || currentUser.email.toLowerCase() === email.toLowerCase())) {
        updateCurrentUserSession({ permissions_json: permissionsStr });
      }

      if (role === 'Teacher') {
        await assignModulesToInstructor(newUserId, assignedModules);
        const updatedMods = await getErpModules();
        setAllModules(updatedMods);
      }

      await fetchUsersData();
      setIsStaffModalOpen(false);
    } catch (e) {
      console.error('Failed to save user', e);
      alert('Failed to save user. Check if email is already in use.');
    }
  };

  const handleDelete = async (row: ERPUser) => {
    if (!window.confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    try {
      await deleteUser(row.id, row.email);
      setUsers(prev => prev.filter(u => u.id !== row.id));
    } catch (e) { alert('Failed to delete user.'); }
  };

  // --- Batch CRUD Handlers ---
  const handleOpenBatchModal = (batch: BatchItem | null) => {
    if (batch) {
      setEditingBatch(batch);
      setBatchName(batch.name);
      setBatchCourse(batch.course_name || batch.course_id || '');
      setBatchTeacherId(batch.primary_teacher_id || '');
      setBatchStartDate(batch.start_date || '');
      setBatchTiming(batch.timing || batch.schedule_pattern || '');
      setBatchMaxStudents(batch.max_students || 30);
      setBatchStatus(batch.status || 'Active');
    } else {
      setEditingBatch(null);
      setBatchName('');
      setBatchCourse('');
      setBatchTeacherId('');
      setBatchStartDate('');
      setBatchTiming('');
      setBatchMaxStudents(30);
      setBatchStatus('Active');
    }
    setIsBatchModalOpen(true);
  };

  const handleSaveBatch = async () => {
    if (!batchName.trim()) {
      alert('Batch Name is required.');
      return;
    }
    try {
      if (editingBatch) {
        await updateBatch(editingBatch.id, {
          name: batchName,
          course_id: batchCourse,
          primary_teacher_id: batchTeacherId,
          start_date: batchStartDate,
          timing: batchTiming,
          schedule_pattern: batchTiming,
          max_students: batchMaxStudents,
          status: batchStatus
        });
      } else {
        await createBatch({
          name: batchName,
          course_id: batchCourse,
          primary_teacher_id: batchTeacherId,
          start_date: batchStartDate,
          timing: batchTiming,
          schedule_pattern: batchTiming,
          max_students: batchMaxStudents,
          status: batchStatus
        });
      }
      await fetchBatchesData();
      setIsBatchModalOpen(false);
    } catch (e) {
      console.error('Failed to save batch', e);
      alert('Failed to save batch.');
    }
  };

  const handleDeleteBatch = async (batch: BatchItem) => {
    if (!window.confirm(`Delete batch "${batch.name}"? This cannot be undone.`)) return;
    try {
      await deleteBatch(batch.id);
      setBatchesList(prev => prev.filter(b => b.id !== batch.id));
    } catch (e) {
      alert('Failed to delete batch.');
    }
  };

  // --- Student Batch Assignment Handlers ---
  const handleOpenStudentModal = async (batch: BatchItem) => {
    setActiveBatchForStudents(batch);
    setStudentModalTab('enrolled');
    setStudentModalSearch('');
    setSelectedStudentIds(new Set());
    setIsStudentModalOpen(true);
    await loadStudentModalData(batch.name);
  };

  const loadStudentModalData = async (batchName: string) => {
    try {
      setStudentModalLoading(true);
      const [enrolled, all] = await Promise.all([
        getStudentsInBatch(batchName),
        getAllStudentsForAssignment()
      ]);
      setBatchStudents(enrolled);
      setAllStudentsList(all);
    } catch (e) {
      console.error('Error loading student modal data', e);
    } finally {
      setStudentModalLoading(false);
    }
  };

  const handleAssignSelectedStudents = async () => {
    if (!activeBatchForStudents || selectedStudentIds.size === 0) return;
    try {
      setStudentModalLoading(true);
      await assignStudentsToBatch(
        activeBatchForStudents.name,
        activeBatchForStudents.id,
        Array.from(selectedStudentIds)
      );
      setSelectedStudentIds(new Set());
      await loadStudentModalData(activeBatchForStudents.name);
      await fetchBatchesData();
      setStudentModalTab('enrolled');
    } catch (e) {
      console.error('Error assigning students', e);
      alert('Failed to assign students to batch.');
    } finally {
      setStudentModalLoading(false);
    }
  };

  const handleRemoveStudentFromBatch = async (studentId: string) => {
    if (!activeBatchForStudents) return;
    if (!window.confirm('Remove this student from the batch?')) return;
    try {
      setStudentModalLoading(true);
      await removeStudentFromBatch(studentId, activeBatchForStudents.name, activeBatchForStudents.id);
      await loadStudentModalData(activeBatchForStudents.name);
      await fetchBatchesData();
    } catch (e) {
      console.error('Error removing student', e);
      alert('Failed to remove student.');
    } finally {
      setStudentModalLoading(false);
    }
  };

  const handleCellEdit = async (row: ERPUser, colKey: string, value: string) => {
    try {
      setUsers(prev => prev.map(u => u.id === row.id ? { ...u, [colKey]: value } : u));
      await patchUser(row.id, { [colKey]: value });
    } catch (e) {
      console.error('Failed to patch user', e);
      fetchUsersData();
    }
  };

  const handlePermissionsChange = async (targetUser: ERPUser, newPerms: Record<string, AccessLevel>) => {
    const permJson = JSON.stringify(newPerms);
    setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, permissions_json: permJson } : u));
    try {
      await patchUser(targetUser.id, { permissions_json: permJson });
    } catch (e) {
      console.error("Failed to patch user permissions:", e);
      fetchUsersData();
    }

    if (currentUser && (currentUser.id === targetUser.id || currentUser.email.toLowerCase() === targetUser.email.toLowerCase())) {
      updateCurrentUserSession({ permissions_json: permJson });
    }
  };

  const staffColumns = [
    { key: 'name', header: 'Name', editable: true },
    { key: 'email', header: 'Email', editable: true },
    { key: 'role', header: 'Role' },
    { key: 'status', header: 'Status' },
    { key: 'salary', header: 'Salary', editable: true },
    { key: 'actions', header: 'Actions', filterable: false, render: (row: any) => (
      <div className="flex items-center gap-1.5 relative">
        <PermissionsDropdown userRow={row} onPermissionsChange={handlePermissionsChange} />
        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg" title="Edit Staff Member"><Edit className="w-4 h-4" /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(row); }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg" title="Delete Staff Member"><Trash2 className="w-4 h-4" /></button>
      </div>
    )}
  ];

  const inputCls = "w-full bg-erp-background border border-erp-border rounded-xl px-4 py-2.5 text-sm text-erp-text focus:outline-none focus:border-indigo-500";

  // Filtered Batches List
  const filteredBatches = batchesList.filter(b => {
    const matchesSearch = !batchSearch.trim() ||
      b.name.toLowerCase().includes(batchSearch.toLowerCase()) ||
      (b.course_name && b.course_name.toLowerCase().includes(batchSearch.toLowerCase())) ||
      (b.primary_teacher_name && b.primary_teacher_name.toLowerCase().includes(batchSearch.toLowerCase()));
    const matchesStatus = !batchStatusFilter || b.status === batchStatusFilter;
    const matchesCourse = !batchCourseFilter || b.course_name === batchCourseFilter || b.course_id === batchCourseFilter;
    return matchesSearch && matchesStatus && matchesCourse;
  });

  const teacherOptions = users.filter(u => u.role === 'Teacher' || u.role === 'CEO' || u.role === 'Manager');

  // Filtered Students for Assignment Modal
  const availableStudentsForModal = allStudentsList.filter(s => {
    const isAlreadyInBatch = batchStudents.some(b => 
      b.id === s.id || 
      (b.email && s.email && b.email.toLowerCase().trim() === s.email.toLowerCase().trim())
    );
    if (isAlreadyInBatch) return false;

    const searchLower = studentModalSearch.toLowerCase().trim();
    const matchesSearch = !searchLower ||
      s.name.toLowerCase().includes(searchLower) ||
      s.email.toLowerCase().includes(searchLower) ||
      (s.student_code && s.student_code.toLowerCase().includes(searchLower)) ||
      (s.course && s.course.toLowerCase().includes(searchLower));
    
    return matchesSearch;
  });

  // Summary Metrics
  const activeBatchesCount = batchesList.filter(b => b.status === 'Active').length;
  const totalEnrolledCount = batchesList.reduce((acc, b) => acc + (b.current_enrolled || 0), 0);
  const totalCapacityCount = batchesList.reduce((acc, b) => acc + (b.max_students || 30), 0);
  const upcomingBatchesCount = batchesList.filter(b => b.status === 'Upcoming').length;

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-20 md:pb-8">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
              <Shield className="w-8 h-8 text-erp-primary" /> Staff Management
            </h1>
            <p className="text-erp-text/70 font-medium mt-1">Manage employees, roles, batches, and access controls.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {activeTab === 'batches' ? (
              <Button className="flex items-center gap-2 text-sm" onClick={() => handleOpenBatchModal(null)}>
                <Plus className="w-4 h-4" /> Add Batch
              </Button>
            ) : (
              <Button className="flex items-center gap-2 text-sm" onClick={() => handleOpenModal(null)}>
                <Plus className="w-4 h-4" /> Add Staff Member
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
              activeTab === 'staff' ? 'bg-erp-primary text-white shadow-md' : 'bg-erp-surface text-erp-text hover:bg-erp-border'
            }`}
          >
            <Users className="w-4 h-4" /> Staff List
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
              activeTab === 'batches' ? 'bg-erp-primary text-white shadow-md' : 'bg-erp-surface text-erp-text hover:bg-erp-border'
            }`}
          >
            <Layers className="w-4 h-4" /> Batches
          </button>
        </div>

        {/* --- STAFF LIST TAB --- */}
        {activeTab === 'staff' && (
          <>
            {/* Filters */}
            <div className="bg-erp-surface border border-erp-border p-4 rounded-xl mb-5 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/50" />
                <input type="text" value={filters.search || ''} placeholder="Search by Name, Email, or ID..."
                  className={`${inputCls} pl-10`} onChange={e => handleFilter('search', e.target.value)} />
              </div>
            </div>

            {/* Table */}
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-erp-surface/50 flex items-center justify-center z-10 rounded-xl">
                  <span className="font-bold text-erp-text/70 bg-erp-surface px-4 py-2 rounded shadow">Loading staff...</span>
                </div>
              )}
              <DataTable columns={staffColumns} data={users} onSort={handleSort} onEdit={handleCellEdit} sortBy={sortBy} sortDir={sortDir} />
            </div>
          </>
        )}

        {/* --- BATCHES TAB --- */}
        {activeTab === 'batches' && (
          <div className="space-y-6">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-erp-surface border border-erp-border rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Active Batches</p>
                  <h3 className="text-2xl font-black text-erp-text mt-0.5">{activeBatchesCount} <span className="text-xs font-medium text-erp-text/40">/ {batchesList.length} total</span></h3>
                </div>
              </div>

              <div className="bg-erp-surface border border-erp-border rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Enrolled Students</p>
                  <h3 className="text-2xl font-black text-erp-text mt-0.5">{totalEnrolledCount}</h3>
                </div>
              </div>

              <div className="bg-erp-surface border border-erp-border rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Total Capacity</p>
                  <h3 className="text-2xl font-black text-erp-text mt-0.5">{totalCapacityCount} <span className="text-xs font-medium text-erp-text/40">seats</span></h3>
                </div>
              </div>

              <div className="bg-erp-surface border border-erp-border rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Upcoming Batches</p>
                  <h3 className="text-2xl font-black text-erp-text mt-0.5">{upcomingBatchesCount}</h3>
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-erp-surface border border-erp-border p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-1 min-w-[240px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/50" />
                <input
                  type="text"
                  value={batchSearch}
                  onChange={e => setBatchSearch(e.target.value)}
                  placeholder="Search batch name, course, or teacher..."
                  className={`${inputCls} pl-10`}
                />
              </div>

              <div className="flex gap-2 flex-wrap items-center">
                <select
                  value={batchStatusFilter}
                  onChange={e => setBatchStatusFilter(e.target.value)}
                  className="bg-erp-background border border-erp-border rounded-xl px-3 py-2 text-sm text-erp-text font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Completed">Completed</option>
                  <option value="Paused">Paused</option>
                </select>

                <select
                  value={batchCourseFilter}
                  onChange={e => setBatchCourseFilter(e.target.value)}
                  className="bg-erp-background border border-erp-border rounded-xl px-3 py-2 text-sm text-erp-text font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Courses</option>
                  {availableCourseOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {(batchSearch || batchStatusFilter || batchCourseFilter) && (
                  <button
                    onClick={() => { setBatchSearch(''); setBatchStatusFilter(''); setBatchCourseFilter(''); }}
                    className="text-xs font-bold text-blue-500 hover:underline px-2 py-1"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Batches Table / Cards */}
            <div className="bg-erp-surface border border-erp-border rounded-2xl overflow-hidden shadow-sm relative">
              {batchesLoading && (
                <div className="absolute inset-0 bg-erp-surface/60 backdrop-blur-xs flex items-center justify-center z-10">
                  <span className="font-bold text-erp-text/70 bg-erp-surface px-4 py-2 rounded-xl border border-erp-border shadow-md">
                    Loading batches...
                  </span>
                </div>
              )}

              {filteredBatches.length === 0 && !batchesLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-erp-text/40">
                  <Layers className="w-12 h-12 mb-3 text-erp-text/20" />
                  <p className="font-bold text-base">No batches found</p>
                  <p className="text-xs mt-1">Click "Add Batch" to create your first batch.</p>
                  <Button onClick={() => handleOpenBatchModal(null)} className="mt-4 text-xs flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Batch
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-erp-border bg-erp-background/50 text-[11px] font-bold text-erp-text/60 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Batch Name</th>
                        <th className="py-3.5 px-4">Course</th>
                        <th className="py-3.5 px-4">Primary Teacher</th>
                        <th className="py-3.5 px-4">Timing & Schedule</th>
                        <th className="py-3.5 px-4">Start Date</th>
                        <th className="py-3.5 px-4">Enrolled / Capacity</th>
                        <th className="py-3.5 px-4">Completion</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-erp-border text-sm text-erp-text">
                      {filteredBatches.map(batch => {
                        const enrolled = batch.current_enrolled || 0;
                        const maxCap = batch.max_students || 30;
                        const enrollPct = Math.min(100, Math.round((enrolled / maxCap) * 100));

                        const subjects = parseBatchSubjectProgress(batch);
                        const totalCompletedClasses = subjects.reduce((acc, s) => acc + s.completed, 0);
                        const totalTargetClasses = subjects.reduce((acc, s) => acc + (s.total || 10), 0);
                        const overallCompletionPct = batch.completion_percentage !== undefined && batch.completion_percentage !== null
                          ? batch.completion_percentage
                          : (totalTargetClasses > 0 ? Math.min(100, Math.round((totalCompletedClasses / totalTargetClasses) * 100)) : 0);

                        const isExpanded = expandedBatchIds.has(batch.id);

                        let statusBg = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
                        if (batch.status === 'Upcoming') statusBg = 'bg-blue-500/10 text-blue-500 border-blue-500/30';
                        else if (batch.status === 'Completed') statusBg = 'bg-gray-500/10 text-gray-400 border-gray-500/30';
                        else if (batch.status === 'Paused') statusBg = 'bg-amber-500/10 text-amber-500 border-amber-500/30';

                        return (
                          <React.Fragment key={batch.id}>
                            <tr 
                              onClick={() => toggleBatchExpand(batch.id)}
                              className={`hover:bg-erp-background/60 transition-colors cursor-pointer ${
                                isExpanded ? 'bg-blue-500/5 dark:bg-blue-950/20 font-medium' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4 font-bold text-erp-text">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); toggleBatchExpand(batch.id); }}
                                    className="p-1 text-erp-text/50 hover:text-blue-500 transition-colors rounded hover:bg-erp-surface"
                                    title={isExpanded ? "Collapse class progress" : "Expand class progress"}
                                  >
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                                  <span>{batch.name}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-erp-text/80 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                  {batch.course_name || batch.course_id || '—'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-erp-text/80 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-erp-text/40 flex-shrink-0" />
                                  {batch.primary_teacher_name || 'Unassigned'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-erp-text/70 font-medium text-xs">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-erp-text/40 flex-shrink-0" />
                                  {batch.timing || batch.schedule_pattern || 'Flexible'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-erp-text/70 font-medium text-xs">
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-erp-text/40 flex-shrink-0" />
                                  {batch.start_date || '—'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="w-32">
                                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                                    <span>{enrolled} <span className="text-erp-text/40 font-normal">/ {maxCap}</span></span>
                                    <span className="text-[10px] text-erp-text/50">{enrollPct}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-erp-border rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        enrollPct >= 100 ? 'bg-red-500' : enrollPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${enrollPct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                    {overallCompletionPct}%
                                  </span>
                                  <span className="text-[10px] text-erp-text/50 hidden sm:inline">
                                    ({totalCompletedClasses} classes)
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBg}`}>
                                  {batch.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenStudentModal(batch)}
                                    className="px-2.5 py-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 dark:text-emerald-400 rounded-lg border border-emerald-500/30 flex items-center gap-1 transition-colors"
                                    title="Add/Manage Students in Batch"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Students</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenBatchModal(batch)}
                                    className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                                    title="Edit Batch"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBatch(batch)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                    title="Delete Batch"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Subject-Wise Class Progress Sub-Row matching Image 1 */}
                            {isExpanded && (
                              <tr key={"exp_" + batch.id} className="bg-slate-50/90 dark:bg-zinc-900/80 border-b border-erp-border">
                                <td colSpan={9} className="p-4">
                                  <div className="bg-erp-surface border border-erp-border rounded-xl p-4 space-y-3 shadow-inner">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-blue-500" />
                                        <h4 className="font-bold text-xs text-erp-text uppercase tracking-wider">
                                          {batch.name} — Class Progress & Subject Breakdown
                                        </h4>
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/30">
                                          Overall Progress: {overallCompletionPct}%
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleAddSubjectToBatch(batch)}
                                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/30 flex items-center gap-1 transition-colors"
                                      >
                                        <Plus className="w-3.5 h-3.5" /> Add Subject
                                      </button>
                                    </div>

                                    {/* Subjects Grid matching Image 1 diagram: SQL - 5 +, Python - 3 +, AI - 4 +, ML - 5 + */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                      {subjects.map((subItem) => (
                                        <div
                                          key={subItem.subject}
                                          className="bg-erp-background border border-erp-border rounded-xl p-3 flex items-center justify-between hover:border-blue-500/40 transition-all shadow-xs"
                                        >
                                          <div className="min-w-0 pr-2">
                                            <span className="text-xs font-bold text-erp-text block truncate" title={subItem.subject}>
                                              {subItem.subject}
                                            </span>
                                            <span className="text-[11px] font-bold text-blue-500">
                                              {subItem.completed} classes completed
                                            </span>
                                          </div>

                                          {/* - and + buttons */}
                                          <div className="flex items-center gap-1 bg-erp-surface border border-erp-border rounded-lg p-1 shrink-0">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAdjustSubjectClasses(batch, subItem.subject, -1);
                                              }}
                                              className="w-6 h-6 rounded bg-erp-background hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center font-bold text-sm text-erp-text/70 transition-colors"
                                              title={`Reduce class for ${subItem.subject}`}
                                            >
                                              -
                                            </button>
                                            <span className="text-xs font-black px-1.5 text-erp-text">
                                              {subItem.completed}
                                            </span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAdjustSubjectClasses(batch, subItem.subject, 1);
                                              }}
                                              className="w-6 h-6 rounded bg-erp-background hover:bg-emerald-500/10 hover:text-emerald-500 flex items-center justify-center font-bold text-sm text-erp-text/70 transition-colors"
                                              title={`Add completed class for ${subItem.subject}`}
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Add/Edit Staff Modal ─── */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-erp-border bg-erp-background/50">
              <h2 className="text-xl font-bold text-erp-text font-display flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-500" />
                {editUser ? 'Edit Staff Member' : 'Create Staff Member'}
              </h2>
              <button onClick={() => setIsStaffModalOpen(false)} className="text-erp-text/50 hover:text-erp-text"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Full Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. Rahul Sharma" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="email@cynexai.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Phone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="10-digit mobile" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Password</label>
                  <input type="text" value={password} onChange={e => setPassword(e.target.value)} className={`${inputCls} font-mono`} placeholder="Leave blank for default: cynex123" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Role</label>
                  <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
                    {['Sales/HR', 'Manager', 'Teacher', 'CEO', 'DM'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {currentUser?.role === 'CEO' && (
                  <div>
                    <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Salary (₹)</label>
                    <input type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} className={inputCls} />
                  </div>
                )}
                
                {role === 'Teacher' && (
                  <div className="md:col-span-2 mt-2 border border-erp-border rounded-xl p-4 bg-erp-background/50">
                    <label className="block text-xs font-bold text-erp-text/60 mb-2 uppercase tracking-wider">Assign Modules</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {allModules.map(m => (
                        <label key={m.id} className="flex items-start gap-2 text-sm text-erp-text/80 cursor-pointer p-1.5 hover:bg-erp-surface rounded">
                          <input type="checkbox" checked={assignedModules.includes(m.id)}
                            onChange={e => {
                              if (e.target.checked) setAssignedModules(p => [...p, m.id]);
                              else setAssignedModules(p => p.filter(id => id !== m.id));
                            }}
                            className="mt-1 w-4 h-4 rounded accent-blue-500" />
                          <span className="leading-tight">{m.title}</span>
                        </label>
                      ))}
                      {allModules.length === 0 && <div className="text-xs text-erp-text/50">No modules available</div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-erp-border pt-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <label className="block text-sm font-bold text-erp-text uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-erp-primary" /> Advanced Access Control
                    </label>
                    <span className="text-xs text-erp-text/50">Granular module permissions for all CEO & Staff features</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const allFull = SYSTEM_MODULES.reduce((acc, m) => ({ ...acc, [m.id]: 'full' }), {});
                        setPermissions(allFull as any);
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                    >
                      ⚡ Grant All Full Access
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allView = SYSTEM_MODULES.reduce((acc, m) => ({ ...acc, [m.id]: 'view' }), {});
                        setPermissions(allView as any);
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/30 transition-colors"
                    >
                      👁️ Grant All View Only
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allNone = SYSTEM_MODULES.reduce((acc, m) => ({ ...acc, [m.id]: 'none' }), {});
                        setPermissions(allNone as any);
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30 transition-colors"
                    >
                      🔒 Revoke All Access
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SYSTEM_MODULES.map(mod => {
                    const currentVal = permissions[mod.id] || 'none';
                    return (
                      <div 
                        key={mod.id} 
                        className={`border rounded-xl p-3 flex flex-col justify-between gap-2 transition-all ${
                          currentVal === 'full' 
                            ? 'bg-erp-background border-emerald-500/30 shadow-xs' 
                            : currentVal === 'view'
                            ? 'bg-erp-background border-blue-500/30'
                            : 'bg-erp-background/40 border-erp-border opacity-75'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1 gap-1">
                            <span className="text-xs font-bold text-erp-text truncate" title={mod.label}>{mod.label}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-erp-surface border border-erp-border text-erp-text/50 uppercase tracking-wider shrink-0">
                              {mod.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-erp-text/50 leading-snug line-clamp-2">{mod.description}</p>
                        </div>

                        <select 
                          value={currentVal} 
                          onChange={e => setPermissions(p => ({ ...p, [mod.id]: e.target.value as AccessLevel }))}
                          className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500 transition-colors ${
                            currentVal === 'full'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40'
                              : currentVal === 'view'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/40'
                              : 'bg-erp-surface text-erp-text/60 border-erp-border'
                          }`}
                        >
                          <option value="full">Full Access</option>
                          <option value="view">View Only</option>
                          <option value="none">No Access</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-erp-border flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsStaffModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveUser}>
                {editUser ? 'Save Changes' : 'Create Staff Member'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add/Edit Batch Modal ─── */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-erp-border bg-erp-background/50">
              <h2 className="text-xl font-bold text-erp-text font-display flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500" />
                {editingBatch ? 'Edit Batch' : 'Create New Batch'}
              </h2>
              <button onClick={() => setIsBatchModalOpen(false)} className="text-erp-text/50 hover:text-erp-text">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Batch Name / Code *</label>
                <input
                  type="text"
                  value={batchName}
                  onChange={e => setBatchName(e.target.value)}
                  placeholder="e.g. DS-2026-A, Batch 101"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Course</label>
                <input
                  list="course-options-list"
                  type="text"
                  value={batchCourse}
                  onChange={e => setBatchCourse(e.target.value)}
                  placeholder="Select or type Course Title (e.g. Data Science with AI)"
                  className={inputCls}
                />
                <datalist id="course-options-list">
                  {availableCourseOptions.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Primary Teacher / Instructor</label>
                <select
                  value={batchTeacherId}
                  onChange={e => setBatchTeacherId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">-- Select Instructor --</option>
                  {teacherOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Timing & Schedule</label>
                  <input
                    type="text"
                    value={batchTiming}
                    onChange={e => setBatchTiming(e.target.value)}
                    placeholder="e.g. Mon-Fri 10:00 AM - 12:00 PM"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={batchStartDate}
                    onChange={e => setBatchStartDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Max Student Capacity</label>
                  <input
                    type="number"
                    value={batchMaxStudents}
                    onChange={e => setBatchMaxStudents(Number(e.target.value))}
                    min={1}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Status</label>
                  <select
                    value={batchStatus}
                    onChange={e => setBatchStatus(e.target.value as any)}
                    className={inputCls}
                  >
                    <option value="Active">Active</option>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Completed">Completed</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-erp-border flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsBatchModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveBatch}>
                {editingBatch ? 'Save Batch Changes' : 'Create Batch'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Manage Students in Batch Modal ─── */}
      {isStudentModalOpen && activeBatchForStudents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-erp-border bg-erp-background/50 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-erp-text font-display flex items-center gap-2">
                  <GraduationCap className="w-6 h-6 text-emerald-500" />
                  Manage Students — <span className="text-blue-500">{activeBatchForStudents.name}</span>
                </h2>
                <p className="text-xs text-erp-text/60 mt-1 flex items-center gap-2">
                  <span>Course: <strong className="text-erp-text">{activeBatchForStudents.course_name || activeBatchForStudents.course_id || 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Enrolled: <strong className="text-emerald-500">{batchStudents.length} / {activeBatchForStudents.max_students || 30} seats</strong></span>
                </p>
              </div>
              <button onClick={() => setIsStudentModalOpen(false)} className="text-erp-text/50 hover:text-erp-text">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="flex border-b border-erp-border px-5 pt-3 gap-2 bg-erp-surface flex-shrink-0">
              <button
                onClick={() => setStudentModalTab('enrolled')}
                className={`px-4 py-2 font-bold text-xs rounded-t-xl transition-all border-b-2 ${
                  studentModalTab === 'enrolled'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                    : 'border-transparent text-erp-text/60 hover:text-erp-text'
                }`}
              >
                Enrolled Students ({batchStudents.length})
              </button>
              <button
                onClick={() => setStudentModalTab('add')}
                className={`px-4 py-2 font-bold text-xs rounded-t-xl transition-all border-b-2 ${
                  studentModalTab === 'add'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                    : 'border-transparent text-erp-text/60 hover:text-erp-text'
                }`}
              >
                + Add / Assign Students
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {studentModalLoading && (
                <div className="p-8 text-center text-erp-text/50 font-bold text-xs">
                  Syncing batch students...
                </div>
              )}

              {/* ENROLLED TAB */}
              {studentModalTab === 'enrolled' && !studentModalLoading && (
                <div>
                  {batchStudents.length === 0 ? (
                    <div className="py-12 text-center text-erp-text/40">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-bold text-sm">No students in this batch yet</p>
                      <button
                        onClick={() => setStudentModalTab('add')}
                        className="mt-3 text-xs font-bold text-blue-500 hover:underline"
                      >
                        + Click here to assign students
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {batchStudents.map(student => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-3 bg-erp-background border border-erp-border rounded-xl hover:border-blue-500/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-500 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-erp-text leading-tight">{student.name}</p>
                              <p className="text-xs text-erp-text/50">{student.email} {student.student_code ? `• ${student.student_code}` : ''}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveStudentFromBatch(student.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Remove student from batch"
                          >
                            <UserMinus className="w-4 h-4" />
                            <span>Remove</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ADD / ASSIGN TAB */}
              {studentModalTab === 'add' && !studentModalLoading && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/50" />
                    <input
                      type="text"
                      value={studentModalSearch}
                      onChange={e => setStudentModalSearch(e.target.value)}
                      placeholder="Search students by name, email, or code..."
                      className={`${inputCls} pl-10`}
                    />
                  </div>

                  <div className="text-xs font-bold text-erp-text/50 flex justify-between items-center">
                    <span>Available Students ({availableStudentsForModal.length})</span>
                    <span>Selected: {selectedStudentIds.size}</span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {availableStudentsForModal.length === 0 ? (
                      <div className="py-8 text-center text-erp-text/40 text-xs font-medium">
                        No available students found to assign.
                      </div>
                    ) : (
                      availableStudentsForModal.map(student => {
                        const isSelected = selectedStudentIds.has(student.id);
                        return (
                          <div
                            key={student.id}
                            onClick={() => {
                              setSelectedStudentIds(prev => {
                                const next = new Set(prev);
                                if (next.has(student.id)) next.delete(student.id);
                                else next.add(student.id);
                                return next;
                              });
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-500/10 border-blue-500 text-erp-text'
                                : 'bg-erp-background border-erp-border hover:border-erp-primary/40'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-blue-500 flex-shrink-0" />
                              ) : (
                                <Square className="w-5 h-5 text-erp-text/30 flex-shrink-0" />
                              )}
                              <div>
                                <p className="font-bold text-sm text-erp-text leading-tight">{student.name}</p>
                                <p className="text-xs text-erp-text/50">{student.email} {student.batch_number ? `(Current Batch: ${student.batch_number})` : '(Unassigned)'}</p>
                              </div>
                            </div>
                            {student.course && (
                              <span className="text-[10px] font-bold text-erp-primary bg-erp-primary/10 px-2 py-0.5 rounded-full">
                                {student.course}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-erp-border bg-erp-background/50 flex justify-between items-center flex-shrink-0">
              <Button variant="ghost" onClick={() => setIsStudentModalOpen(false)}>Done</Button>
              {studentModalTab === 'add' && (
                <Button
                  onClick={handleAssignSelectedStudents}
                  disabled={selectedStudentIds.size === 0}
                  className="flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Assign Selected ({selectedStudentIds.size})</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
