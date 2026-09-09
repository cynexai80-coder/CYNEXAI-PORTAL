import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { FolderOpen, Plus, ArrowRight, Video, FileText, ArrowLeft, X, Edit, Trash2, ArrowUp, ArrowDown, HelpCircle, Link as LinkIcon, Lock, Unlock } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getModuleDetails, createClassForModule, deleteClass, updateModuleCoding, updateClassOrder, updateClassAccessStatus } from '../../lib/api/cms';
import { ConfirmModal } from '../../components/ui/erp/ConfirmModal';

export default function ModuleEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  let basePath = '/ceo';
  if (location.pathname.startsWith('/manager')) basePath = '/manager';
  else if (location.pathname.startsWith('/teacher')) basePath = '/teacher';
  else if (location.pathname.startsWith('/sales')) basePath = '/sales';
  else if (location.pathname.startsWith('/dm')) basePath = '/dm';
  const { courseId, moduleId } = useParams();

  const [moduleData, setModuleData] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Class Modal
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [newClassTitle, setNewClassTitle] = useState('');
  const [newClassType, setNewClassType] = useState('video'); // video, zoom, pdf, quiz

  // Confirm Modal
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchModuleData();
  }, [moduleId]);

  const fetchModuleData = async () => {
    try {
      const data = await getModuleDetails(moduleId as string);
      if (data.module) {
        setModuleData(data.module);
      }
      setClasses(data.classes as any);
    } catch (e) {
      console.error("Failed to fetch module data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    if (!moduleId || !newClassTitle.trim()) return;
    const classId = 'cls_' + Date.now();
    try {
      const nextOrder = classes.length;
      await createClassForModule(classId, moduleId, newClassTitle.trim(), nextOrder, newClassType);
      setIsClassModalOpen(false);
      setNewClassTitle('');
      setNewClassType('video');
      await fetchModuleData();
    } catch (e: any) {
      console.error("Error creating class:", e);
      alert("Failed to create class: " + (e.message || JSON.stringify(e)));
    }
  };

  const handleDeleteClass = (classId: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Class',
      message: 'Are you sure you want to delete this class? This will also remove any questions and materials associated with this class.',
      onConfirm: async () => {
        try {
          await deleteClass(classId);
          await fetchModuleData();
        } catch (e) {
          console.error("Failed to delete class", e);
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleMoveClass = async (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= classes.length) return;

    const newClasses = [...classes];
    const [moved] = newClasses.splice(index, 1);
    newClasses.splice(newIdx, 0, moved);

    const updatedWithOrder = newClasses.map((cls, idx) => ({
      ...cls,
      order_index: idx
    }));

    setClasses(updatedWithOrder);

    try {
      await updateClassOrder(updatedWithOrder.map(c => ({ id: c.id, order_index: c.order_index })));
    } catch (e) {
      console.error("Failed to save reordered classes", e);
      await fetchModuleData();
    }
  };

  const handleToggleAccess = async (classId: string, currentStatus: string) => {
    const isCurrentlyUnlocked = currentStatus === 'unlocked' || currentStatus === 'in_progress' || currentStatus === 'active' || currentStatus === 'completed';
    const newStatus = isCurrentlyUnlocked ? 'locked' : 'unlocked';
    try {
      await updateClassAccessStatus(classId, newStatus);
      await fetchModuleData();
    } catch (e) {
      console.error("Failed to update class access status", e);
    }
  };

  const handleToggleItModule = async () => {
    if (!moduleData) return;
    const newVal = !(moduleData.is_it_module === 1);
    try {
      await updateModuleCoding(moduleData.id, newVal);
      setModuleData({ ...moduleData, is_it_module: newVal ? 1 : 0 });
    } catch (e) {
      console.error("Failed to update module type", e);
    }
  };

  const getClassIcon = (type: string) => {
    switch (type) {
      case 'zoom':
        return <LinkIcon className="w-5 h-5 text-indigo-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-emerald-400" />;
      case 'quiz':
        return <HelpCircle className="w-5 h-5 text-amber-400" />;
      default:
        return <Video className="w-5 h-5 text-blue-400" />;
    }
  };

  const getClassBadgeStyle = (type: string) => {
    switch (type) {
      case 'zoom':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'pdf':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'quiz':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-erp-text flex items-center gap-4">
        <div className="w-8 h-8 border-4 border-erp-primary border-t-transparent rounded-full animate-spin"></div>
        Loading module classes...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-16 sm:pb-24 p-4 md:p-8 bg-erp-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button 
            onClick={() => navigate(`${basePath}/courses`)} 
            className="flex items-center gap-2 text-sm text-erp-text/50 font-bold mb-2 hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Courses
          </button>
          <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-indigo-500" /> 
            {moduleData?.title || 'Module Editor'}
          </h1>
          {moduleData && (
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm font-bold text-erp-text/70">IT Module (Includes Coding)?</span>
              <button 
                onClick={handleToggleItModule}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${moduleData.is_it_module === 1 ? 'bg-indigo-500' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform ${moduleData.is_it_module === 1 ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}
        </div>
        <Button onClick={() => setIsClassModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Class
        </Button>
      </div>

      <div className="space-y-4 max-w-4xl">
        {classes.length === 0 ? (
          <div className="p-12 text-center bg-erp-surface border border-erp-border rounded-xl text-erp-text/50">
            No classes found in this module. Click "Add Class" to start building.
          </div>
        ) : (
          classes.map((cls, idx) => (
            <Card key={cls.id} className="bg-erp-surface border-erp-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-500/40 transition-all">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <button 
                    disabled={idx === 0}
                    onClick={() => handleMoveClass(idx, 'up')}
                    className="p-1 rounded text-erp-text/40 hover:text-indigo-400 disabled:opacity-20 disabled:hover:text-erp-text/40 transition-colors cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    disabled={idx === classes.length - 1}
                    onClick={() => handleMoveClass(idx, 'down')}
                    className="p-1 rounded text-erp-text/40 hover:text-indigo-400 disabled:opacity-20 disabled:hover:text-erp-text/40 transition-colors cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-800/80 border border-slate-700/50">
                  {getClassIcon(cls.type)}
                </div>
                <div>
                  <h3 className="font-bold text-erp-text text-base">Class {idx + 1}: {cls.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getClassBadgeStyle(cls.type)}`}>
                      {cls.type === 'zoom' ? 'Live Session' : cls.type === 'pdf' ? 'PDF Notes' : cls.type === 'quiz' ? 'Quiz / Exam' : 'Video Lesson'}
                    </span>
                    {cls.description && (
                      <span className="text-xs text-erp-text/50 truncate max-w-[200px]">
                        {cls.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button 
                  type="button"
                  onClick={() => handleToggleAccess(cls.id as string, cls.status)} 
                  className={`h-8 px-2.5 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer ${
                    (cls.status === 'unlocked' || cls.status === 'in_progress' || cls.status === 'active' || cls.status === 'completed')
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600 hover:text-white'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-600 hover:text-white'
                  }`}
                  title={(cls.status === 'unlocked' || cls.status === 'in_progress' || cls.status === 'active' || cls.status === 'completed') ? "Click to lock student access" : "Click to grant access to students"}
                >
                  {(cls.status === 'unlocked' || cls.status === 'in_progress' || cls.status === 'active' || cls.status === 'completed') ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {(cls.status === 'unlocked' || cls.status === 'in_progress' || cls.status === 'active' || cls.status === 'completed') ? 'Unlocked 🔓' : 'Give Access 🔓'}
                </button>
                <button 
                  type="button"
                  onClick={() => navigate(`${basePath}/courses/${courseId}/modules/${moduleId}/classes/${cls.id}`)} 
                  className="h-8 px-3 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 rounded-lg transition-all cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit Content
                </button>
                <button 
                  type="button"
                  onClick={() => handleDeleteClass(cls.id as string)} 
                  className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                  title="Delete Class"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Class Modal */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-erp-border bg-slate-900/50">
              <h2 className="text-xl font-bold text-erp-text font-display flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-400" /> Add New Class
              </h2>
              <button onClick={() => setIsClassModalOpen(false)} className="text-erp-text/50 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-2">Class Title</label>
                <input 
                  type="text" 
                  value={newClassTitle}
                  onChange={(e) => setNewClassTitle(e.target.value)}
                  placeholder="e.g. Introduction to Variables & Data Types"
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-2">Content Type</label>
                <select 
                  value={newClassType}
                  onChange={(e) => setNewClassType(e.target.value)}
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text focus:outline-none focus:border-indigo-500"
                >
                  <option value="video">Video Lesson</option>
                  <option value="zoom">Live Zoom / Jitsi Session</option>
                  <option value="pdf">Document / PDF Notes</option>
                  <option value="quiz">Interactive Quiz / MCQ</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-erp-border bg-slate-900/30 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsClassModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleAddClass} disabled={!newClassTitle.trim()}>
                Create Class <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        onConfirm={confirmModalConfig.onConfirm}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
