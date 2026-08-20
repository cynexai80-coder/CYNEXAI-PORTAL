import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Task, updateTaskStatus, deleteTask } from '../../../lib/api/tasks';
import { Clock, CheckCircle, MessageSquare, MoreVertical, AlertCircle, Trash2 } from 'lucide-react';

interface Props {
  tasks: Task[];
  users: any[];
  onTaskClick: (task: Task) => void;
  onUpdate: () => void;
}

const COLUMNS: { id: string; label: string; color: string; bg: string }[] = [
  { id: 'To Do',      label: 'To Do',      color: '#6b7280', bg: '#f3f4f6' },
  { id: 'In Progress',label: 'In Progress',color: '#3b82f6', bg: '#eff6ff' },
  { id: 'Review',     label: 'Review',     color: '#a855f7', bg: '#faf5ff' },
  { id: 'Done',       label: 'Done',       color: '#22c55e', bg: '#f0fdf4' },
];

const PRIORITY_STYLES: Record<string, { dot: string; label: string }> = {
  Urgent: { dot: '#ef4444', label: 'text-red-600 bg-red-50 border-red-200' },
  High:   { dot: '#f97316', label: 'text-orange-600 bg-orange-50 border-orange-200' },
  Medium: { dot: '#3b82f6', label: 'text-blue-600 bg-blue-50 border-blue-200' },
  Low:    { dot: '#9ca3af', label: 'text-gray-500 bg-gray-50 dark:bg-zinc-900/50 border-gray-200 dark:border-white/10' },
};

const TYPE_LABELS: Record<string, string> = {
  'One-Time': '📌 One-Time',
  'Daily':    '🔁 Daily',
  'Yes/No':   '✅ Yes/No',
  'Number':   '📊 Track',
};

export const TaskBoardView: React.FC<Props> = ({ tasks, users, onTaskClick, onUpdate }) => {
  const getUserName = (id: string) => {
    const user = users.find(u => u.id === id);
    return user ? user.name : id;
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
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const task = tasks.find(t => t.id === draggableId);
    if (!task || task.status === newStatus) return;

    const res = await updateTaskStatus(draggableId, newStatus);
    if (res.success) {
      onUpdate();
    } else {
      alert(res.error || 'Failed to move task');
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-5 overflow-x-auto pb-8 min-h-[70vh] items-start">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          return (
            <div key={col.id} className="flex-shrink-0 w-[300px] flex flex-col rounded-2xl" style={{ background: col.bg, border: `1.5px solid ${col.color}22` }}>
              {/* Column Header */}
              <div className="flex items-center justify-between px-4 py-3 rounded-t-2xl border-b" style={{ borderColor: `${col.color}22` }}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                  <h3 className="font-bold text-sm text-gray-700 dark:text-white uppercase tracking-wider">{col.label}</h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: col.color }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Droppable Zone */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex-1 flex flex-col gap-3 p-3 min-h-[200px] transition-colors rounded-b-2xl"
                    style={{ background: snapshot.isDraggingOver ? `${col.color}14` : 'transparent' }}
                  >
                    {colTasks.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-xl" style={{ borderColor: `${col.color}33` }}>
                        <div className="text-3xl mb-2 opacity-30">📋</div>
                        <p className="text-xs font-medium text-gray-400">Drop tasks here</p>
                      </div>
                    )}

                    {colTasks.map((task, index) => {
                      const pStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Low;
                      const progress = task.task_type === 'Number' && task.target_number
                        ? Math.min(100, Math.round(((task.current_number || 0) / task.target_number) * 100))
                        : null;
                      const isOverdue = task.due_date && task.status !== 'Done' &&
                        new Date(task.due_date) < new Date();

                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onTaskClick(task)}
                              className="bg-white dark:bg-black rounded-xl p-4 shadow-sm cursor-pointer group select-none"
                              style={{
                                ...provided.draggableProps.style,
                                opacity: task.status === 'Done' ? 0.65 : 1,
                                boxShadow: snapshot.isDragging
                                  ? '0 12px 30px rgba(0,0,0,0.15)'
                                  : '0 1px 4px rgba(0,0,0,0.08)',
                                transform: snapshot.isDragging
                                  ? `${provided.draggableProps.style?.transform} rotate(2deg)`
                                  : provided.draggableProps.style?.transform,
                                borderLeft: `3px solid ${pStyle.dot}`,
                              }}
                            >
                              {/* Top row: type badge + priority + delete */}
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-400">
                                  {TYPE_LABELS[task.task_type || 'One-Time'] || task.task_type}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pStyle.label}`}>
                                    {task.priority}
                                  </span>
                                  <button
                                    onClick={(e) => handleDeleteTask(e, task)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-red-500 hover:text-red-700 dark:text-red-400 transition-all rounded hover:bg-red-500/10"
                                    title="Delete Task"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Title */}
                              <p className={`font-bold text-sm text-gray-800 dark:text-white leading-snug mb-2 ${task.status === 'Done' ? 'line-through text-gray-400' : ''}`}>
                                {task.title}
                              </p>

                              {/* Progress bar for Number tasks */}
                              {progress !== null && (
                                <div className="mb-3">
                                  <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1 items-center">
                                    <span>Progress</span>
                                    <div className="flex items-center gap-1.5">
                                      <button 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const newCount = Math.max(0, (task.current_number || 0) - 1);
                                          const { updateTask } = await import('../../../lib/api/tasks');
                                          await updateTask(task.id, { current_number: newCount });
                                          onUpdate();
                                        }}
                                        className="w-4 h-4 rounded bg-gray-100 dark:bg-zinc-900/50 hover:bg-gray-200 dark:bg-zinc-900/50 flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-white transition-colors"
                                      >-</button>
                                      <span style={{ color: col.color }}>{task.current_number || 0} / {task.target_number}</span>
                                      <button 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const target = task.target_number || 100;
                                          const newCount = Math.min(target, (task.current_number || 0) + 1);
                                          const { updateTask } = await import('../../../lib/api/tasks');
                                          await updateTask(task.id, { current_number: newCount });
                                          if (newCount >= target && task.status !== 'Done') {
                                            const { updateTaskStatus } = await import('../../../lib/api/tasks');
                                            await updateTaskStatus(task.id, 'Done');
                                          }
                                          onUpdate();
                                        }}
                                        className="w-4 h-4 rounded bg-gray-100 dark:bg-zinc-900/50 hover:bg-gray-200 dark:bg-zinc-900/50 flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-white transition-colors"
                                      >+</button>
                                    </div>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 dark:bg-zinc-900/50 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{ width: `${progress}%`, background: col.color }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Footer: due date + assignee avatar */}
                              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-900/50 rounded-full pr-2 pl-1 py-1 border border-gray-100">
                                  {task.created_by && task.created_by !== task.assignee_id && (
                                    <>
                                      <span className="text-[9px] font-bold text-gray-400 uppercase truncate max-w-[40px]" title={getUserName(task.created_by)}>
                                        {getUserName(task.created_by).split(' ')[0]}
                                      </span>
                                      <span className="text-[7px] text-gray-300">▶</span>
                                    </>
                                  )}
                                  <div className="flex items-center gap-1" title={getUserName(task.assignee_id)}>
                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-bold uppercase border border-indigo-200 shrink-0">
                                      {getUserName(task.assignee_id).slice(0, 2)}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-600 truncate max-w-[50px]">
                                      {getUserName(task.assignee_id).split(' ')[0]}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {task.due_date && (
                                    <div className={`flex items-center gap-1 text-[10px] font-semibold ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                                      {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                      {task.due_date}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};
