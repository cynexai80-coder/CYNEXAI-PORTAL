import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { BookOpen, Upload, FileText, Plus, Sparkles, Video, Radio, RefreshCw, Loader2, Settings2, X } from 'lucide-react';
import { getTeacherCMSModules, getClassesForModules, createClass, updateClassMaterials } from '../../lib/api/teacher';
import { generateAIMaterials } from '../../lib/aiGenerator';
import { getCurrentUser } from '../../lib/auth';
import { useNavigate } from 'react-router-dom';

export default function TeacherCMS() {
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  
  const [addingToModule, setAddingToModule] = useState<string | null>(null);
  const [newClassTitle, setNewClassTitle] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [generatingForClass, setGeneratingForClass] = useState<string | null>(null);
  
  // AI Settings Modal
  const [showAiSettings, setShowAiSettings] = useState<any | null>(null); // the class object
  const [selectedTheme, setSelectedTheme] = useState('modern-dark');
  const [selectedContentStyle, setSelectedContentStyle] = useState('storytelling');
  const [includeImages, setIncludeImages] = useState(true);

  const user = getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    try {
      const isSuper = ['Admin', 'Manager', 'CEO'].includes(user?.role);
      const resolvedUserId = user?.id || 'usr_teacher';
      
      const mRows = await getTeacherCMSModules(isSuper, resolvedUserId);

      // 2. Fetch classes for those modules
      if (mRows.length > 0) {
        const modIds = mRows.map((m: any) => `'${m.id}'`).join(',');
        const cRows = await getClassesForModules(modIds);
        
        const merged = mRows.map((m: any) => ({
          ...m,
          classes: cRows.filter((c: any) => c.module_id === m.id)
        }));
        setModules(merged);
      } else {
        setModules([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const generateAiContent = async (classId: string, title: string, description: string) => {
    setShowAiSettings(null); // Close modal
    setGeneratingForClass(classId);
    
    // Set theme for presentation view
    localStorage.setItem('cynexai_live_theme', selectedTheme);
    
    try {
      const aiContent = await generateAIMaterials(title, description, selectedTheme, selectedContentStyle, includeImages);
      await updateClassMaterials(classId, aiContent.ppt, aiContent.script, aiContent.keypoints);
      await fetchModules();
    } catch (err) {
      console.error(err);
      alert('Failed to generate materials. Please try again.');
    } finally {
      setGeneratingForClass(null);
    }
  };

  const viewSlides = (classId: string) => {
    window.open(`/teacher/presentation-view?classId=${classId}`, '_blank');
  };

  const handleAddClass = async (moduleId: string) => {
    if (!newClassTitle.trim()) return;
    await createClass(moduleId, newClassTitle, newClassDesc);
    setAddingToModule(null);
    setNewClassTitle('');
    setNewClassDesc('');
    fetchModules();
  };

  if (loading) return <div className="p-8 text-erp-text">Loading Curriculum...</div>;

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-32">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text">Course CMS</h1>
            <p className="text-erp-text/70 font-medium mt-1">Manage your assigned modules and generate AI lessons</p>
          </div>
          {modules.length > 0 && (
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="bg-erp-surface border border-erp-border text-erp-text rounded-lg px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Modules</option>
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          )}
        </div>

        {modules.length === 0 ? (
          <div className="bg-white dark:bg-black/5 border border-white/10 rounded-2xl p-12 text-center">
            <BookOpen className="w-12 h-12 text-erp-text/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-erp-text mb-2">No modules assigned</h2>
            <p className="text-erp-text/50">Please contact the manager to assign modules to your account.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {modules.filter(mod => selectedModuleId === 'all' || mod.id === selectedModuleId).map(mod => (
              <Card key={mod.id as string} className="border-l-4 border-erp-primary">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-erp-text">{mod.title}</h2>
                    <p className="text-sm font-bold text-erp-text/50">{mod.description}</p>
                  </div>
                  <Button onClick={() => setAddingToModule(mod.id)} variant="outline" className="h-9 px-3 text-xs">
                    <Plus className="w-4 h-4 mr-1" /> Add Class
                  </Button>
                </div>
                
                {addingToModule === mod.id && (
                  <div className="mb-4 bg-erp-surface p-4 rounded-xl border border-erp-border space-y-3">
                    <input 
                      value={newClassTitle} onChange={e => setNewClassTitle(e.target.value)} 
                      placeholder="Class Title" 
                      className="w-full bg-white dark:bg-black border border-erp-border rounded-lg px-3 py-2 text-sm text-erp-text" 
                    />
                    <textarea 
                      value={newClassDesc} onChange={e => setNewClassDesc(e.target.value)} 
                      placeholder="Description (Optional)" 
                      className="w-full bg-white dark:bg-black border border-erp-border rounded-lg px-3 py-2 text-sm text-erp-text resize-none" 
                      rows={2} 
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" className="h-9 text-xs" onClick={() => setAddingToModule(null)}>Cancel</Button>
                      <Button className="h-9 text-xs" onClick={() => handleAddClass(mod.id)}>Save Class</Button>
                    </div>
                  </div>
                )}
                
                <div className="bg-erp-surface rounded-xl border border-erp-border p-4 space-y-3">
                  {mod.classes.length === 0 ? (
                    <div className="text-center p-4 text-erp-text/50 text-sm">No classes in this module yet.</div>
                  ) : (
                    mod.classes.map((cls: any) => (
                      <div key={cls.id as string} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-black p-3 rounded-lg border border-erp-border gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${cls.status === 'in_progress' ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'}`}>
                            {cls.status === 'in_progress' ? <Radio className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-800 dark:text-white">{cls.title}</span>
                              {cls.status === 'in_progress' && (
                                <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                  Live Now
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate max-w-sm">{cls.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          {cls.ai_ppt_markdown ? (
                            <>
                              <Button 
                                onClick={() => viewSlides(cls.id as string)}
                                variant="ghost" className="h-9 px-3 text-xs bg-green-50 text-green-700 dark:text-white hover:bg-green-100 border border-green-200"
                              >
                                <FileText className="w-4 h-4 mr-2" /> View Slides
                              </Button>
                              <Button 
                                onClick={() => setShowAiSettings(cls)}
                                variant="ghost" className="h-9 px-3 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                                title="Regenerate Slides (Applies new AI Settings)"
                                disabled={generatingForClass === cls.id}
                              >
                                {generatingForClass === cls.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings2 className="w-4 h-4 mr-2" />}
                                {generatingForClass === cls.id ? 'Generating...' : 'AI Settings & Regenerate'}
                              </Button>
                            </>
                          ) : (
                            <Button 
                              onClick={() => setShowAiSettings(cls)}
                              variant="ghost" className="h-9 px-3 text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800/60"
                              disabled={generatingForClass === cls.id}
                            >
                              {generatingForClass === cls.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                              {generatingForClass === cls.id ? 'Generating AI Slides...' : 'Generate AI Slides'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* AI Settings Modal */}
        {showAiSettings && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-erp-surface rounded-2xl w-full max-w-md border border-erp-border overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-erp-border bg-white dark:bg-black">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-erp-text">AI Generation Settings</h3>
                </div>
                <button onClick={() => setShowAiSettings(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4 bg-slate-50 dark:bg-zinc-900/50">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">PPT Theme Template</label>
                  <select
                    value={selectedTheme}
                    onChange={e => setSelectedTheme(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-erp-border rounded-lg px-4 py-3 font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="modern-dark">Modern Dark (Sleek, tech-focused)</option>
                    <option value="glassmorphism">Glassmorphism (Vibrant, dynamic)</option>
                    <option value="retro">Retro Mac (Nostalgic 90s OS)</option>
                    <option value="minimalist">Minimalist (Clean, elegant reading)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">AI Content Style</label>
                  <select
                    value={selectedContentStyle}
                    onChange={e => setSelectedContentStyle(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-erp-border rounded-lg px-4 py-3 font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="storytelling">Storytelling (Narrative-driven, examples)</option>
                    <option value="technical">Technical (Precise, code-heavy)</option>
                    <option value="academic">Academic (Formal, structured)</option>
                    <option value="standard">Standard (Clear & Informative)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-black border border-erp-border rounded-lg px-4 py-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">Include Images</label>
                    <p className="text-xs text-slate-500">Auto-generate contextual layout imagery</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={includeImages} onChange={e => setIncludeImages(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-900/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-black after:border-gray-300 dark:border-white/10 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Settings will apply to the upcoming generation for <strong>{showAiSettings.title}</strong>. 
                  The generation takes about 5-10 seconds and happens in the background.
                </p>
              </div>
              <div className="p-4 border-t border-erp-border flex justify-end gap-2 bg-white dark:bg-black">
                <Button variant="ghost" onClick={() => setShowAiSettings(null)}>Cancel</Button>
                <Button onClick={() => generateAiContent(showAiSettings.id, showAiSettings.title, showAiSettings.description)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6">
                  <Sparkles className="w-4 h-4 mr-2" /> Start Generation
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const RadioIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="2"></circle>
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
  </svg>
);
