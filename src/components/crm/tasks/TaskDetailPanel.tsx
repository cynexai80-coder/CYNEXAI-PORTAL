import React, { useState, useEffect } from 'react';
import { Task, updateTask, deleteTask, getTaskComments, getTaskSubtasks, addTaskComment, addSubtask, updateSubtaskStatus } from '../../../lib/api/tasks';
import { Project, getProjects } from '../../../lib/api/projects';
import { Button } from '../../ui/erp/Button';
import { X, Calendar, Flag, User, Trash2, CheckCircle, AlignLeft, MessageSquare, CheckSquare, Send, Circle, FolderOpen } from 'lucide-react';
import { getErpUsers } from '../../../lib/api/manager';
import { getCurrentUser } from '../../../lib/auth';
import { TimeTracker } from './TimeTracker';
import { ProjectHierarchyPanel } from './ProjectHierarchyPanel';

interface Props {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
  currentUserRole: string;
}

export const TaskDetailPanel: React.FC<Props> = ({ task, onClose, onUpdate, currentUserRole }) => {
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [users, setUsers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Prod-Level Asana State
  const [comments, setComments] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  const currentUser = getCurrentUser();

  const loadExtraData = async () => {
    const fetchedComments = await getTaskComments(task.id);
    const fetchedSubtasks = await getTaskSubtasks(task.id);
    const fetchedProjects = await getProjects();
    setComments(fetchedComments);
    setSubtasks(fetchedSubtasks);
    setProjects(fetchedProjects);
  };

  useEffect(() => {
    setEditedTask(task);
    loadExtraData();
  }, [task]);

  useEffect(() => {
    if (['Manager', 'CEO', 'Admin'].includes(currentUserRole)) {
      getErpUsers().then(setUsers);
    }
  }, [currentUserRole]);

  const handleChange = (field: keyof Task, value: string) => {
    setEditedTask(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateTask(task.id, {
      title: editedTask.title,
      description: editedTask.description,
      priority: editedTask.priority,
      status: editedTask.status,
      due_date: editedTask.due_date,
      assignee_id: editedTask.assignee_id,
      task_type: editedTask.task_type,
      target_number: editedTask.target_number,
      current_number: editedTask.current_number,
      project_id: editedTask.project_id,
      expire_date: editedTask.expire_date,
    });
    setIsSaving(false);
    onUpdate();
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this task?')) {
      const res = await deleteTask(task.id);
      if (res.success) {
        onUpdate();
        onClose();
      } else {
        alert(res.error || 'Failed to delete');
      }
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addTaskComment(task.id, newComment);
    setNewComment('');
    loadExtraData();
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    await addSubtask(task.id, newSubtask);
    setNewSubtask('');
    loadExtraData();
  };

  const handleToggleSubtask = async (subtaskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Done' ? 'To Do' : 'Done';
    await updateSubtaskStatus(subtaskId, newStatus);
    loadExtraData();
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'Urgent': return 'text-red-600 bg-red-100';
      case 'High': return 'text-orange-600 bg-orange-100';
      case 'Medium': return 'text-blue-600 bg-blue-100';
      case 'Low': return 'text-gray-600 bg-gray-100 dark:bg-zinc-900/50';
      default: return 'text-gray-600 bg-gray-100 dark:bg-zinc-900/50';
    }
  };

  const getUserName = (id: string) => {
    const u = users.find(user => user.id === id);
    return u ? u.name : id;
  };

  return (
    <div className="flex flex-col h-full bg-erp-surface border-l-2 border-erp-border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-erp-border bg-erp-background">
        <div className="flex items-center gap-2">
          <Button variant="ghost" className={`py-1 px-3 h-8 border ${editedTask.status === 'Done' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-erp-surface border-erp-border text-erp-text/70'}`} onClick={() => {
            handleChange('status', editedTask.status === 'Done' ? 'To Do' : 'Done');
            updateTask(task.id, { status: editedTask.status === 'Done' ? 'To Do' : 'Done' }).then(onUpdate);
          }}>
            <CheckCircle className="w-4 h-4 mr-2" /> 
            {editedTask.task_type === 'Yes/No' ? (editedTask.status === 'Done' ? 'Yes' : 'No (Mark Yes)') : (editedTask.status === 'Done' ? 'Completed' : 'Mark Complete')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {['Manager', 'CEO', 'Admin'].includes(currentUserRole) && (
            <button onClick={handleDelete} className="p-2 text-red-500 hover:text-red-700 dark:text-white rounded-full hover:bg-red-50 transition-colors" title="Delete Task">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button onClick={onClose} className="p-2 text-erp-text/50 hover:text-erp-text rounded-full hover:bg-erp-background">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <input
            type="text"
            value={editedTask.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="text-2xl font-bold font-display text-erp-text bg-transparent border-none outline-none w-full placeholder-erp-text/30 focus:bg-erp-background focus:ring-1 ring-erp-border rounded px-2 -mx-2"
            placeholder="Write a task name"
          />
        </div>

        <div className="grid grid-cols-12 gap-y-4 text-sm">
          <div className="col-span-4 text-erp-text/60 flex items-center gap-2 font-medium">
            <User className="w-4 h-4" /> Assignee
          </div>
          <div className="col-span-8">
            {['Manager', 'CEO', 'Admin'].includes(currentUserRole) ? (
              <select 
                value={editedTask.assignee_id}
                onChange={(e) => handleChange('assignee_id', e.target.value)}
                className="bg-transparent hover:bg-erp-background px-2 py-1 -mx-2 rounded outline-none border-none text-erp-text font-medium cursor-pointer"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            ) : (
              <span className="font-medium text-erp-text px-2 py-1 -mx-2">{getUserName(editedTask.assignee_id)}</span>
            )}
          </div>

          <div className="col-span-4 text-erp-text/60 flex items-center gap-2 font-medium">
            <FolderOpen className="w-4 h-4" /> Project
          </div>
          <div className="col-span-8">
            <select 
              value={editedTask.project_id || ''}
              onChange={(e) => handleChange('project_id', e.target.value)}
              className="bg-transparent hover:bg-erp-background px-2 py-1 -mx-2 rounded outline-none border-none text-erp-text font-medium cursor-pointer max-w-full"
            >
              <option value="">No Project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-4 text-erp-text/60 flex items-center gap-2 font-medium">
            <Calendar className="w-4 h-4" /> Due Date
          </div>
          <div className="col-span-8">
            <input 
              type="date"
              value={editedTask.due_date || ''}
              onChange={(e) => handleChange('due_date', e.target.value)}
              className="bg-transparent hover:bg-erp-background px-2 py-1 -mx-2 rounded outline-none border-none text-erp-text font-medium cursor-pointer"
            />
          </div>

          {editedTask.task_type === 'Daily' && (
            <>
              <div className="col-span-4 text-erp-text/60 flex items-center gap-2 font-medium">
                <Calendar className="w-4 h-4" /> Expires On
              </div>
              <div className="col-span-8">
                <input 
                  type="date"
                  value={editedTask.expire_date || ''}
                  onChange={(e) => handleChange('expire_date', e.target.value)}
                  className="bg-transparent hover:bg-erp-background px-2 py-1 -mx-2 rounded outline-none border-none text-erp-text font-medium cursor-pointer"
                />
              </div>
            </>
          )}

          <div className="col-span-4 text-erp-text/60 flex items-center gap-2 font-medium">
            <Flag className="w-4 h-4" /> Priority
          </div>
          <div className="col-span-8">
            <select
              value={editedTask.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className={`px-2 py-1 rounded outline-none border-none font-bold text-xs cursor-pointer ${getPriorityColor(editedTask.priority)}`}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          
          <div className="col-span-4 text-erp-text/60 flex items-center gap-2 font-medium">
            <div className="w-4 h-4 rounded-full border-2 border-erp-text/40" /> Status
          </div>
          <div className="col-span-8">
            <select
              value={editedTask.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="bg-transparent hover:bg-erp-background px-2 py-1 -mx-2 rounded outline-none border-none text-erp-text font-medium cursor-pointer"
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Review">Review</option>
              <option value="Done">Done</option>
              <option value="Excused">Excused</option>
            </select>
          </div>

          <div className="col-span-4 text-erp-text/60 flex items-center gap-2 font-medium">
            <Flag className="w-4 h-4" /> Category
          </div>
          <div className="col-span-8">
            <select
              value={editedTask.task_type || 'One-Time'}
              onChange={(e) => handleChange('task_type', e.target.value)}
              className="bg-transparent hover:bg-erp-background px-2 py-1 -mx-2 rounded outline-none border-none text-erp-text font-medium cursor-pointer"
            >
              <option value="One-Time">One-Time</option>
              <option value="Daily">Daily</option>
              <option value="Yes/No">Yes/No</option>
              <option value="Number">Number Track</option>
            </select>
          </div>

          {['Number', 'Daily'].includes(editedTask.task_type || '') && (
            <>
              <div className="col-span-4 text-erp-text/60 flex items-center gap-2 font-medium">
                <AlignLeft className="w-4 h-4" /> Goal Target
              </div>
              <div className="col-span-8">
                <input 
                  type="number"
                  value={editedTask.target_number || ''}
                  onChange={(e) => handleChange('target_number', e.target.value)}
                  className="bg-transparent hover:bg-erp-background px-2 py-1 -mx-2 rounded outline-none border border-erp-border text-erp-text font-medium w-24"
                />
              </div>
              <div className="col-span-4 text-erp-text/60 flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4" /> Current
              </div>
              <div className="col-span-8 flex items-center gap-2">
                <input 
                  type="number"
                  value={editedTask.current_number || ''}
                  onChange={(e) => handleChange('current_number', e.target.value)}
                  className="bg-transparent hover:bg-erp-background px-2 py-1 -mx-2 rounded outline-none border border-erp-border text-erp-text font-medium w-24"
                />
                <span className="text-xs text-erp-text/50 font-bold">
                  / {editedTask.target_number || 0}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Subtasks Section */}
        <div className="pt-4 border-t border-erp-border">
          <div className="flex items-center gap-2 text-erp-text/70 font-bold mb-3">
            <CheckSquare className="w-4 h-4" /> Subtasks
          </div>
          <div className="space-y-2 mb-3">
            {subtasks.map(st => (
              <div key={st.id} className="flex items-center gap-3">
                <button 
                  onClick={() => handleToggleSubtask(st.id, st.status)}
                  className={`w-5 h-5 rounded flex items-center justify-center ${st.status === 'Done' ? 'bg-erp-primary text-white' : 'border-2 border-erp-border text-transparent'}`}
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <span className={`text-sm ${st.status === 'Done' ? 'text-erp-text/50 line-through' : 'text-erp-text font-medium'}`}>
                  {st.title}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="text"
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
              placeholder="Add subtask..."
              className="flex-1 bg-erp-background border border-erp-border rounded-lg px-3 py-2 text-sm text-erp-text outline-none focus:border-erp-primary"
            />
            <Button variant="secondary" onClick={handleAddSubtask} className="px-3">Add</Button>
          </div>
        </div>

        <div className="pt-4 border-t border-erp-border">
          <div className="flex items-center gap-2 text-erp-text/70 font-bold mb-2">
            <AlignLeft className="w-4 h-4" /> Description
          </div>
          <textarea
            value={editedTask.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full min-h-[100px] bg-transparent border-none outline-none resize-y text-sm text-erp-text placeholder-erp-text/40 p-2 hover:bg-erp-background focus:bg-erp-background focus:ring-1 ring-erp-border rounded transition-colors"
            placeholder="Add more details to this task..."
          />
          {editedTask.description?.includes('/manager/assign-batch/') && (
            <div className="mt-3">
              <Button onClick={() => window.open(editedTask.description?.match(/(\/manager\/assign-batch\/[^\s]+)/)?.[0], '_self')} variant="primary" className="bg-indigo-600 hover:bg-indigo-700 w-full">
                🚀 Take Action: Assign Batch
              </Button>
            </div>
          )}
        </div>

        {/* Time Tracking */}
        <TimeTracker taskId={task.id} />

        {/* Project Hierarchy (if task is in a project, CEO only) */}
        {editedTask.project_id && projects.find(p => p.id === editedTask.project_id) && currentUser?.role === 'CEO' && (
          <ProjectHierarchyPanel project={projects.find(p => p.id === editedTask.project_id)!} />
        )}

        {/* Activity & Comments Feed */}
        <div className="pt-4 border-t border-erp-border">
          <div className="flex items-center gap-2 text-erp-text/70 font-bold mb-4">
            <MessageSquare className="w-4 h-4" /> Activity Feed
          </div>
          
          <div className="space-y-4 mb-4">
            {comments.length === 0 ? (
              <p className="text-center text-erp-text/40 text-sm font-bold py-2">No comments yet.</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-erp-primary text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {comment.user_name ? comment.user_name.substring(0, 2) : 'U'}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-sm text-erp-text">{comment.user_name || 'User'}</span>
                      <span className="text-xs text-erp-text/50">{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-erp-text mt-1 bg-erp-background p-3 rounded-xl border border-erp-border">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-end gap-2">
            <textarea 
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Ask a question or post an update..."
              className="flex-1 min-h-[40px] bg-erp-background border border-erp-border rounded-xl px-3 py-2 text-sm text-erp-text outline-none focus:border-erp-primary resize-y"
            />
            <Button onClick={handleAddComment} className="h-10 px-4">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

      </div>
      
      <div className="p-4 border-t border-erp-border bg-erp-background flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};
