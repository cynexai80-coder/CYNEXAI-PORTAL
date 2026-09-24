import React, { useState, useEffect } from 'react';
import { client } from '../../../lib/turso';
import { Button } from '../../../components/ui/erp/Button';
import { Loader2, Plus, Edit2, X, Save, Trash2, Minus, Code2, BookOpen } from 'lucide-react';
import { DataTable } from '../../../components/ui/erp/DataTable';
import { 
  parseBatchSubjectProgress, 
  SubjectClassProgress, 
  DEFAULT_DIAGRAM_SUBJECTS, 
  getCourseModulesWithClassCounts, 
  updateBatchSubjectProgress 
} from '../../../lib/api/batches';

interface Batch {
  id: string;
  name: string;
  course_id: string;
  module_progress_json: string; // e.g. {"Python": 5, "SQL": 2}
  subject_progress_json?: string;
  primary_teacher_id?: string;
  completion_percentage?: number;
}

interface BatchesTabProps {
  onBatchChange?: () => void;
}

export function BatchesTab({ onBatchChange }: BatchesTabProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<{id: string, title: string}[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [subjects, setSubjects] = useState<SubjectClassProgress[]>([]);
  const [showRawJson, setShowRawJson] = useState(false);
  const [progressJson, setProgressJson] = useState('{}');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!client) return;
      const bRes = await client.execute("SELECT id, name, course_id, module_progress_json, subject_progress_json, completion_percentage, primary_teacher_id FROM batches ORDER BY created_at DESC");
      setBatches(bRes.rows as unknown as Batch[]);
      
      const cRes = await client.execute("SELECT id, title FROM courses ORDER BY title");
      setCourses(cRes.rows as unknown as {id: string, title: string}[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openModal = async (batch?: Batch) => {
    if (batch) {
      setEditId(batch.id);
      setName(batch.name || '');
      // Match course id or fallback to title/first
      const matchedCourse = courses.find(c => c.id === batch.course_id || c.title === batch.course_id);
      const selectedCId = matchedCourse ? matchedCourse.id : (batch.course_id || (courses[0]?.id || ''));
      setCourseId(selectedCId);

      const cModules = await getCourseModulesWithClassCounts(selectedCId);
      const parsedSubs = parseBatchSubjectProgress(batch as any, cModules);
      setSubjects(parsedSubs);
      setProgressJson(batch.module_progress_json || '{}');
    } else {
      setEditId(null);
      setName('');
      const defaultCourseId = courses[0]?.id || '';
      setCourseId(defaultCourseId);
      const cModules = defaultCourseId ? await getCourseModulesWithClassCounts(defaultCourseId) : [];
      const parsedSubs = parseBatchSubjectProgress({} as any, cModules);
      setSubjects(parsedSubs);
      setProgressJson('{}');
    }
    setShowRawJson(false);
    setIsModalOpen(true);
  };

  const handleCourseSelectChange = async (newCId: string) => {
    setCourseId(newCId);
    try {
      const cModules = await getCourseModulesWithClassCounts(newCId);
      if (cModules.length > 0) {
        setSubjects(prev => {
          return parseBatchSubjectProgress({ subject_progress_json: JSON.stringify(prev) } as any, cModules);
        });
      }
    } catch (e) {
      console.error("Failed to load modules for course", e);
    }
  };

  const handleAdjustSubject = (index: number, delta: number) => {
    setSubjects(prev => prev.map((item, idx) => {
      if (idx === index) {
        const maxLimit = item.total && item.total > 0 ? item.total : 999;
        return { ...item, completed: Math.min(maxLimit, Math.max(0, item.completed + delta)) };
      }
      return item;
    }));
  };

  const handleAddSubject = () => {
    const newName = prompt("Enter new subject or module name (e.g. React, Node.js, Generative AI):");
    if (!newName || !newName.trim()) return;
    if (subjects.some(s => s.subject.toLowerCase() === newName.trim().toLowerCase())) {
      alert("Subject already exists in this batch");
      return;
    }
    const countStr = prompt("Total classes in this module (optional, default 10):", "10");
    const totalCount = Math.max(1, parseInt(countStr || '10', 10) || 10);
    setSubjects(prev => [...prev, { subject: newName.trim(), completed: 0, total: totalCount }]);
  };

  const handleRemoveSubject = (index: number) => {
    setSubjects(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    if (!name || !courseId) return alert('Name and Course are required');
    
    let finalSubjects = subjects;
    let finalModuleMap: Record<string, number> = {};

    if (showRawJson) {
      try {
        finalModuleMap = JSON.parse(progressJson);
        finalSubjects = Object.entries(finalModuleMap).map(([k, v]) => ({
          subject: k,
          completed: Number(v) || 0,
          total: subjects.find(s => s.subject.toLowerCase() === k.toLowerCase())?.total || 10
        }));
      } catch {
        return alert('Invalid JSON in Module Progress');
      }
    } else {
      finalSubjects.forEach(s => {
        if (s.subject) finalModuleMap[s.subject] = s.completed;
      });
    }

    setSaving(true);
    try {
      const targetId = editId || `batch_${Date.now()}`;
      if (!editId) {
        await client!.execute({
          sql: "INSERT INTO batches (id, name, course_id, status, created_at) VALUES (?, ?, ?, 'Active', ?)",
          args: [targetId, name, courseId, new Date().toISOString()]
        });
      }

      await updateBatchSubjectProgress(targetId, finalSubjects, courseId, name);

      setIsModalOpen(false);
      await loadData();
      onBatchChange?.();
    } catch (e) {
      console.error(e);
      alert('Failed to save batch');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (batch: Batch) => {
    if (!confirm(`Are you sure you want to delete batch "${batch.name}"?`)) return;
    try {
      if (!client) return;
      await client.execute({
        sql: "DELETE FROM batches WHERE id = ?",
        args: [batch.id]
      });
      await loadData();
      onBatchChange?.();
    } catch (e) {
      console.error(e);
      alert('Failed to delete batch');
    }
  };

  const inputCls = "w-full bg-erp-background border border-erp-border rounded-xl px-3 py-2 text-sm text-erp-text focus:outline-none focus:border-indigo-500";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">Manage Batches</h2>
        <Button onClick={() => openModal()}><Plus className="w-4 h-4 mr-2" /> Create Batch</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', header: 'Batch Name' },
            { key: 'course_id', header: 'Course', render: (r) => courses.find(c => c.id === r.course_id || c.title === r.course_id)?.title || r.course_id },
            { 
              key: 'module_progress_json', 
              header: 'Module Progress & Pacing', 
              render: (r) => {
                const list = parseBatchSubjectProgress(r as any);
                return (
                  <div className="flex flex-wrap gap-1.5 items-center max-w-md py-1">
                    {list.map(s => (
                      <span 
                        key={s.subject} 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      >
                        <span>{s.subject}:</span>
                        <span className="font-black">{s.completed}</span>
                        <span className="text-[10px] text-erp-text/40">/{s.total || 10}</span>
                      </span>
                    ))}
                  </div>
                );
              } 
            },
            { key: 'actions', header: 'Actions', render: (r) => (
              <div className="flex items-center gap-1">
                <Button variant="ghost" className="p-1.5 h-auto text-indigo-400 hover:text-indigo-300" onClick={() => openModal(r as Batch)} title="Edit Batch">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" className="p-1.5 h-auto text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(r as Batch)} title="Delete Batch">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          ]}
          data={batches}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-lg shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-xl">{editId ? 'Edit Batch' : 'Create Batch'}</h2>
                {subjects.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {(() => {
                      const totalCompleted = subjects.reduce((acc, s) => acc + (s.completed || 0), 0);
                      const totalClasses = subjects.reduce((acc, s) => acc + (s.total || 0), 0);
                      return totalClasses > 0 ? Math.min(100, Math.round((totalCompleted / totalClasses) * 100)) : 0;
                    })()}% Completed
                  </span>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg hover:bg-erp-border text-erp-text/60"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Batch Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. July 2026 Data Science" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Course *</label>
                <select 
                  value={courses.find(c => c.id === courseId || c.title === courseId)?.id || courseId} 
                  onChange={e => handleCourseSelectChange(e.target.value)} 
                  className={inputCls}
                >
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              {/* Module Progress Visual Stepper List */}
              <div className="space-y-2 pt-2 border-t border-erp-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    <label className="text-xs font-bold text-erp-text">Module Progress & Class Pacing</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRawJson(!showRawJson)}
                      className="text-[11px] font-bold text-erp-text/60 hover:text-erp-primary flex items-center gap-1"
                    >
                      <Code2 className="w-3 h-3" /> {showRawJson ? 'Visual Mode' : 'Raw JSON'}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSubject}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Module
                    </button>
                  </div>
                </div>

                {showRawJson ? (
                  <div>
                    <textarea 
                      value={progressJson} 
                      onChange={e => setProgressJson(e.target.value)} 
                      className={inputCls + " font-mono text-xs"} 
                      rows={5}
                      placeholder='{"Python": 5, "SQL": 2}'
                    />
                    <p className="text-[10px] text-erp-text/50 mt-1">JSON dictionary mapping subject titles to completed class numbers.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {subjects.map((s, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-2.5 rounded-xl bg-erp-background border border-erp-border"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-xs font-bold text-erp-text block truncate">{s.subject}</span>
                          <span className="text-[10px] text-erp-text/50">Total classes: {s.total || 10}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-erp-surface border border-erp-border rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleAdjustSubject(idx, -1)}
                              disabled={s.completed <= 0}
                              className="w-6 h-6 rounded bg-erp-background hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40 flex items-center justify-center font-bold text-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-black px-2 min-w-[20px] text-center text-erp-text">{s.completed}</span>
                            <button
                              type="button"
                              onClick={() => handleAdjustSubject(idx, 1)}
                              className="w-6 h-6 rounded bg-erp-background hover:bg-emerald-500/10 hover:text-emerald-500 flex items-center justify-center font-bold text-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubject(idx)}
                            className="p-1 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remove subject"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {subjects.length === 0 && (
                      <p className="text-xs text-erp-text/50 text-center py-3">No modules configured for this batch yet.</p>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-erp-text/50">Defines current live class pace. Unlocks corresponding classes in student portals.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
