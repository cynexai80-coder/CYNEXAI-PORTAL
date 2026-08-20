import React from 'react';
import { Task, updateTaskStatus, deleteTask } from '../../../lib/api/tasks';
import { CheckCircle, Circle, MoreVertical, Clock, AlertTriangle, Trash2 } from 'lucide-react';

interface Props {
  tasks: Task[];
  users: any[];
  onTaskClick: (task: Task) => void;
  onUpdate: () => void;
}

export const TaskListView: React.FC<Props> = ({ tasks, users, onTaskClick, onUpdate }) => {
  const handleToggleStatus = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const newStatus = task.status === 'Done' ? 'To Do' : 'Done';
    await updateTaskStatus(task.id, newStatus);
    onUpdate();
  };

  const handleDeleteTask = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (confirm(`Delete "${task.title}"?`)) {
      const res = await deleteTask(task.id);
      if (res.success) {
        onUpdate();
      } else {
        alert(res.error || 'Failed to delete task');
      }
    }
  };

  const getUserName = (id: string) => {
    const user = users.find(u => u.id === id);
    return user ? user.name : id;
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'Urgent': return 'text-red-600 bg-red-100 border-red-200';
      case 'High': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'Medium': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Low': return 'text-gray-600 bg-gray-100 dark:bg-zinc-900/50 border-gray-200 dark:border-white/10';
      default: return 'text-gray-600 bg-gray-100 dark:bg-zinc-900/50 border-gray-200 dark:border-white/10';
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-erp-border rounded-xl">
        <div className="w-16 h-16 bg-erp-surface rounded-full flex items-center justify-center mb-4 text-erp-primary">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-erp-text">No tasks found</h3>
        <p className="text-sm text-erp-text/50">You're all caught up!</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  return (
    <div className="bg-white dark:bg-black border-2 border-erp-border rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-erp-surface border-b border-erp-border text-xs font-bold text-erp-text/60 uppercase tracking-wider">
          <tr>
            <th className="p-3 w-10 text-center"></th>
            <th className="p-3">Task Name</th>
            <th className="p-3 w-40">Assigned</th>
            <th className="p-3 w-32">Due Date</th>
            <th className="p-3 w-32">Priority</th>
            <th className="p-3 w-32">Status</th>
            <th className="p-3 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-erp-border">
          {tasks.map(task => {
            const assigneeName = getUserName(task.assignee_id);
            const creatorName = task.created_by ? getUserName(task.created_by) : assigneeName;
            const isMissed = task.status === 'Missed';
            const isYesterdayMissed = isMissed && task.due_date && task.due_date.split('T')[0] === yesterday;
            return (
            <tr 
              key={task.id} 
              onClick={() => onTaskClick(task)}
              className={`group transition-colors cursor-pointer ${
                isYesterdayMissed
                  ? 'bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30 border-l-4 border-l-orange-500'
                  : 'hover:bg-erp-background'
              }`}
            >
              <td className="p-3 text-center align-middle" onClick={(e) => handleToggleStatus(e, task)}>
                <button className="text-erp-text/30 hover:text-erp-primary transition-colors focus:outline-none">
                  {task.status === 'Done' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : task.status === 'Excused' ? (
                    <Circle className="w-5 h-5 text-yellow-500" />
                  ) : task.status === 'Missed' ? (
                    <AlertTriangle className="w-5 h-5 text-orange-500 animate-pulse" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
              </td>
              <td className="p-3">
                <div className={`font-bold text-sm ${task.status === 'Done' || task.status === 'Excused' ? 'text-erp-text/50 line-through' : isMissed ? 'text-orange-700 dark:text-orange-400' : 'text-erp-text'}`}>
                  {task.title}
                  {isYesterdayMissed && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500 text-white animate-pulse">
                      <AlertTriangle className="w-2.5 h-2.5" /> MISSED YESTERDAY
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-erp-background border border-erp-border text-erp-text/60">
                    {task.task_type || 'One-Time'}
                  </span>
                  {task.task_type === 'Number' && (
                    <span className="text-[10px] font-bold text-erp-primary">
                      {task.current_number || 0} / {task.target_number || 0}
                    </span>
                  )}
                </div>
              </td>
              <td className="p-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-erp-text/40 uppercase">
                    <span title={creatorName}>{creatorName.split(' ')[0]}</span>
                    <span className="text-[7px]">▶</span>
                  </div>
                  <div className="flex items-center gap-2" title={assigneeName}>
                    <div className="w-5 h-5 rounded-full bg-erp-primary/10 text-erp-primary flex items-center justify-center text-[9px] font-bold uppercase overflow-hidden border border-erp-primary/20 shrink-0">
                      {assigneeName.slice(0,2)}
                    </div>
                    <span className="text-xs text-erp-text/80 font-medium truncate max-w-[80px]">{assigneeName}</span>
                  </div>
                </div>
              </td>
              <td className="p-3">
                <div className={`text-xs flex items-center gap-1 ${task.status === 'Done' ? 'text-erp-text/40' : 'text-erp-text/70'}`}>
                  {task.due_date ? (
                    <>
                      <Clock className="w-3 h-3" />
                      {task.due_date}
                    </>
                  ) : (
                    <span className="text-erp-text/30">-</span>
                  )}
                </div>
              </td>
              <td className="p-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
              </td>
              <td className="p-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  task.status === 'Done'        ? 'bg-green-100 text-green-700 dark:text-white' :
                  task.status === 'In Progress' ? 'bg-blue-100 text-blue-700 dark:text-white' :
                  task.status === 'Review'      ? 'bg-purple-100 text-purple-700' :
                  task.status === 'Missed'      ? 'bg-orange-100 text-orange-700 font-black animate-pulse' :
                  'bg-gray-100 dark:bg-zinc-900/50 text-gray-700 dark:text-white'
                }`}>
                  {task.status}
                </span>
              </td>
              <td className="p-3 text-right flex items-center justify-end gap-1">
                <button
                  onClick={(e) => handleDeleteTask(e, task)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 dark:text-red-400 transition-all rounded hover:bg-red-500/10"
                  title="Delete Task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};
