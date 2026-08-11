import React, { useState, useEffect } from 'react';
import { client } from '../../../lib/turso';
import { Button } from '../../../components/ui/erp/Button';
import { Loader2, Plus, Edit2, X, Save } from 'lucide-react';
import { DataTable } from '../../../components/ui/erp/DataTable';

interface Batch {
  id: string;
  name: string;
  course_id: string;
  module_progress_json: string; // e.g. {"Python": 5, "SQL": 2}
  primary_teacher_id?: string;
}

export function BatchesTab() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<{id: string, title: string}[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [progressJson, setProgressJson] = useState('{}');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!client) return;
      const bRes = await client.execute("SELECT id, name, course_id, module_progress_json, primary_teacher_id FROM batches ORDER BY created_at DESC");
      setBatches(bRes.rows as unknown as Batch[]);
      
      const cRes = await client.execute("SELECT id, title FROM courses ORDER BY title");
      setCourses(cRes.rows as unknown as {id: string, title: string}[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (batch?: Batch) => {
    if (batch) {
      setEditId(batch.id);
      setName(batch.name || '');
      setCourseId(batch.course_id || '');
      setProgressJson(batch.module_progress_json || '{}');
    } else {
      setEditId(null);
      setName('');
      setCourseId('');
      setProgressJson('{}');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name || !courseId) return alert('Name and Course are required');
    
    // Validate JSON
    try {
      JSON.parse(progressJson);
    } catch {
      return alert('Invalid JSON in Module Progress');
    }

    setSaving(true);
    try {
      if (editId) {
        await client!.execute({
          sql: "UPDATE batches SET name = ?, course_id = ?, module_progress_json = ? WHERE id = ?",
          args: [name, courseId, progressJson, editId]
        });
      } else {
        const newId = `batch_${Date.now()}`;
        await client!.execute({
          sql: "INSERT INTO batches (id, name, course_id, module_progress_json, created_at) VALUES (?, ?, ?, ?, ?)",
          args: [newId, name, courseId, progressJson, new Date().toISOString()]
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to save batch');
    } finally {
      setSaving(false);
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
            { key: 'module_progress_json', header: 'Module Progress (JSON)', render: (r) => <pre className="text-xs text-erp-text/70">{r.module_progress_json}</pre> },
            { key: 'actions', header: 'Actions', render: (r) => (
              <Button variant="ghost" onClick={() => openModal(r as Batch)}><Edit2 className="w-4 h-4" /></Button>
            )}
          ]}
          data={batches}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-lg shadow-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-xl">{editId ? 'Edit Batch' : 'Create Batch'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Batch Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. July 2026 Data Science" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Course *</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} className={inputCls}>
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Module Progress (JSON)</label>
                <textarea 
                  value={progressJson} 
                  onChange={e => setProgressJson(e.target.value)} 
                  className={inputCls + " font-mono text-xs"} 
                  rows={5}
                  placeholder='{"Python": 5, "SQL": 2}'
                />
                <p className="text-[10px] text-erp-text/50 mt-1">Defines the current live class number for each module to lock future content.</p>
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
