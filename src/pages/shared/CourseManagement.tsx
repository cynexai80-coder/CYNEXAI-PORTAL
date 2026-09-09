import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { ConfirmModal } from '../../components/ui/erp/ConfirmModal';
import { BookOpen, FolderOpen, Users, BarChart, FileVideo, Plus, ArrowRight, X, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../../lib/auth';
import { client } from '../../lib/turso';
import { getCoursesFull, createCourse, createModule, updateCoursePitch, getAllModules, mapExistingModuleToCourse, deleteCourse, removeModuleFromCourse, updateModuleInstructor, getTeachersList } from '../../lib/api/cms';
import { getAllBatches } from '../../lib/api/batches';

export default function CourseManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  let basePath = '/ceo';
  if (location.pathname.startsWith('/manager')) basePath = '/manager';
  else if (location.pathname.startsWith('/teacher')) basePath = '/teacher';
  else if (location.pathname.startsWith('/sales')) basePath = '/sales';
  else if (location.pathname.startsWith('/dm')) basePath = '/dm';

  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Course Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');

  // Add Module Modal State
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleCreationMode, setModuleCreationMode] = useState<'new' | 'existing'>('new');
  const [allModulesList, setAllModulesList] = useState<any[]>([]);
  const [selectedExistingModule, setSelectedExistingModule] = useState('');
  
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleIsIt, setNewModuleIsIt] = useState(true);
  const [selectedCourseForModule, setSelectedCourseForModule] = useState<string | null>(null);

  // Confirm Modal State
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
    fetchCourses();
    fetchAllModulesList();
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const tList = await getTeachersList();
      setTeachers(tList);
    } catch (e) {
      console.error("fetchTeachers error:", e);
    }
  };

  const fetchAllModulesList = async () => {
    if (!client) return;
    try {
      const mods = await getAllModules();
      setAllModulesList(mods);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCourses = async () => {
    if (!client) {
      console.error("Turso client not configured.");
      setLoading(false);
      return;
    }
    try {
      const [{ courses: cRows, modules: mRows, classes: clsRows }, allBatchesList] = await Promise.all([
        getCoursesFull(),
        getAllBatches().catch(() => [])
      ]);

      const courseMap = new Map();
      
      cRows.forEach((c: any) => {
        const matchingBatches = allBatchesList.filter(b => 
          b.course_id === c.id || 
          (b.course_name && b.course_name.toLowerCase() === (c.title || '').toLowerCase())
        );
        const totalEnrolledInCourse = matchingBatches.reduce((acc, b) => acc + (b.current_enrolled || 0), 0);

        courseMap.set(c.id, {
          id: c.id,
          name: c.title,
          description: c.description,
          sales_pitch_summary: c.sales_pitch_summary || '',
          sales_pitch_script: c.sales_pitch_script || '',
          studentsEnrolled: totalEnrolledInCourse,
          modules: [],
          batches: matchingBatches.map(b => ({
            name: b.name,
            students: b.current_enrolled || 0,
            progress: b.status === 'Completed' ? 100 : b.status === 'Active' ? 50 : 0
          }))
        });
      });

      const classesByModuleId = new Map();
      clsRows.forEach((cls: any) => {
        if (!classesByModuleId.has(cls.module_id)) {
          classesByModuleId.set(cls.module_id, []);
        }
        classesByModuleId.get(cls.module_id).push({
          id: cls.id,
          title: cls.title,
          type: cls.type
        });
      });

      mRows.forEach((m: any) => {
        const mod = {
          id: m.id,
          course_id: m.course_id,
          name: m.title,
          instructor_id: m.instructor_id,
          classes: classesByModuleId.get(m.id) || [],
          completedBy: 0
        };
        if (courseMap.has(m.course_id as string)) {
          courseMap.get(m.course_id as string).modules.push(mod);
        }
      });

      const finalCourses = Array.from(courseMap.values());
      if (finalCourses.length > 0 && !expandedCourse) {
        setExpandedCourse(finalCourses[0].id);
      }
      setCourses(finalCourses);
    } catch (e) {
      console.error("Failed to fetch courses:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!client || !newCourseName) return;
    const courseId = 'course_' + Date.now();
    try {
      await createCourse(courseId, newCourseName, newCourseDesc, user?.id || 'sys', 'published');
      setIsModalOpen(false);
      setNewCourseName('');
      setNewCourseDesc('');
      await fetchCourses();
      setExpandedCourse(courseId);
    } catch (e) {
      console.error("Error creating course:", e);
      alert("Failed to create course. Please try again.");
    }
  };

  const handleAddModule = async () => {
    if (!client || !selectedCourseForModule) return;
    
    try {
      const course = courses.find(c => c.id === selectedCourseForModule);
      const nextOrder = course ? course.modules.length : 0;
      
      if (moduleCreationMode === 'new') {
        if (!newModuleName) return;
        const moduleId = 'mod_' + Date.now();
        await createModule(moduleId, selectedCourseForModule, newModuleName, nextOrder, newModuleIsIt);
      } else {
        if (!selectedExistingModule) return;
        // Check if module already in course
        if (course?.modules.find((m: any) => m.id === selectedExistingModule)) {
          alert('This module is already in this course!');
          return;
        }
        await mapExistingModuleToCourse(selectedCourseForModule, selectedExistingModule, nextOrder);
      }
      
      setIsModuleModalOpen(false);
      setNewModuleName('');
      setSelectedExistingModule('');
      setNewModuleIsIt(true);
      await fetchCourses();
      await fetchAllModulesList(); // refresh global list
    } catch (e) {
      console.error("Error adding module:", e);
      alert("Failed to add module.");
    }
  };

  const handleDeleteCourse = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Course',
      message: 'Are you sure you want to completely delete this course? This action cannot be undone and will remove all module associations.',
      onConfirm: async () => {
        try {
          await deleteCourse(courseId);
          if (expandedCourse === courseId) setExpandedCourse(null);
          await fetchCourses();
        } catch (e) {
          console.error(e);
          alert('Failed to delete course');
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleRemoveModule = async (courseId: string, moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModalConfig({
      isOpen: true,
      title: 'Remove Module',
      message: 'Are you sure you want to remove this module from the course? The module itself will not be deleted if it is used in other courses.',
      onConfirm: async () => {
        try {
          await removeModuleFromCourse(courseId, moduleId);
          await fetchCourses();
        } catch (e) {
          console.error(e);
          alert('Failed to remove module');
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Pitch Modal State
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [pitchCourseId, setPitchCourseId] = useState<string | null>(null);
  const [pitchSummary, setPitchSummary] = useState('');
  const [pitchScript, setPitchScript] = useState('');

  const handleSavePitch = async () => {
    if (!client || !pitchCourseId) return;
    try {
      await updateCoursePitch(pitchCourseId, pitchSummary, pitchScript);
      setIsPitchModalOpen(false);
      await fetchCourses();
    } catch (e) {
      console.error("Error updating pitch:", e);
      alert("Failed to update pitch.");
    }
  };

  if (loading) {
    return <div className="p-8 text-erp-text flex items-center gap-4">
       <div className="w-8 h-8 border-4 border-erp-primary border-t-transparent rounded-full animate-spin"></div>
       Loading courses from Turso...
    </div>;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-16 sm:pb-24 p-4 md:p-8 bg-erp-background relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-500" /> Course Management
          </h1>
          <p className="text-erp-text/70 font-medium mt-1">Manage curriculum, track batch progress, and generate AI materials.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Course List & Modules */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-display text-erp-text">Active Courses</h2>
            <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Course
            </Button>
          </div>

          <div className="space-y-4">
            {courses.length === 0 && (
               <div className="p-8 text-center bg-erp-surface border border-erp-border rounded-xl text-erp-text/50">
                 No courses found. Click "New Course" to begin.
               </div>
            )}
            {courses.map(course => (
              <Card key={course.id} className="bg-erp-surface border-erp-border p-0 overflow-hidden transition-all">
                <div 
                  className="p-6 flex justify-between items-center cursor-pointer hover:bg-slate-800/50"
                  onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-erp-text">{course.name}</h3>
                      <p className="text-sm text-erp-text/50">{course.modules.length} Modules • {course.studentsEnrolled} Students Enrolled</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={(e) => handleDeleteCourse(course.id, e)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" className="text-erp-secondary">
                      {expandedCourse === course.id ? 'Hide Details' : 'View Details'}
                    </Button>
                  </div>
                </div>

                {expandedCourse === course.id && (
                  <div className="border-t border-erp-border bg-black/20 p-6 space-y-6">
                    
                    {/* Modules List */}
                    <div>
                      <h4 className="font-bold text-erp-text mb-4 flex items-center gap-2">
                        <FileVideo className="w-4 h-4 text-purple-400" /> Modules & Curriculum
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {course.modules.map((mod: any) => (
                          <div 
                            key={mod.id} 
                            className="bg-erp-surface border border-erp-border rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all cursor-pointer group" 
                            onClick={() => navigate(`${basePath}/courses/${course.id}/modules/${mod.id}`)}
                          >
                            <div className="mb-4">
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <h5 className="font-bold text-erp-text text-base group-hover:text-indigo-400 transition-colors truncate flex-1">{mod.name}</h5>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-2">
                                <p className="text-xs text-erp-text/60 font-medium flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block"></span>
                                  {mod.classes.length} {mod.classes.length === 1 ? 'Class' : 'Classes'}
                                </p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-erp-border/50">
                              <div className="text-xs font-bold text-emerald-400">{mod.completedBy}% Completion</div>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  type="button"
                                  onClick={(e) => handleRemoveModule(course.id, mod.id, e)} 
                                  className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-all cursor-pointer"
                                  title="Remove Module from Course"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`${basePath}/courses/${course.id}/modules/${mod.id}`);
                                  }}
                                  className="h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 transition-all cursor-pointer shadow-sm"
                                >
                                  Edit Classes <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="bg-erp-surface border-2 border-dashed border-erp-border rounded-lg p-4 flex flex-col items-center justify-center text-erp-text/50 hover:text-indigo-400 hover:border-indigo-400 cursor-pointer transition-colors min-h-[120px]" onClick={() => {
                          setSelectedCourseForModule(course.id);
                          setIsModuleModalOpen(true);
                        }}>
                          <Plus className="w-6 h-6 mb-2" />
                          <span className="font-bold text-sm">Add Module</span>
                        </div>
                      </div>
                    </div>

                    {/* Sales Pitch Settings */}
                    <div>
                      <h4 className="font-bold text-erp-text mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-green-400" /> Sales Pitch Settings</span>
                        <Button variant="ghost" className="h-8 text-xs border border-erp-border" onClick={() => {
                          setPitchCourseId(course.id);
                          setPitchSummary(course.sales_pitch_summary);
                          setPitchScript(course.sales_pitch_script);
                          setIsPitchModalOpen(true);
                        }}>
                          Edit Pitch <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </h4>
                      <div className="bg-erp-surface border border-erp-border rounded-lg p-4 space-y-4">
                        <div>
                          <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-1">Summary</p>
                          <p className="text-sm text-erp-text">{course.sales_pitch_summary || <span className="italic text-erp-text/30">No summary defined</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider mb-1">Script</p>
                          <p className="text-sm text-erp-text italic">"{course.sales_pitch_script || <span className="text-erp-text/30">No script defined</span>}"</p>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Batch Progress Widget */}
        <div className="space-y-6">
          <Card className="bg-erp-surface border-erp-border sticky top-8">
            <h2 className="text-xl font-bold font-display text-erp-text mb-6 flex items-center gap-2">
              <BarChart className="w-5 h-5 text-green-500" /> Batch Progress
            </h2>
            
            {expandedCourse ? (
              <div className="space-y-6">
                <h3 className="font-bold text-erp-text/80 text-sm">
                  {courses.find(c => c.id === expandedCourse)?.name}
                </h3>
                {courses.find(c => c.id === expandedCourse)?.batches.length === 0 && (
                  <p className="text-erp-text/50 text-sm">No batches assigned to this course yet.</p>
                )}
                {courses.find(c => c.id === expandedCourse)?.batches.map((batch: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-erp-text">{batch.name}</span>
                      <span className="text-xs font-bold bg-slate-800 px-2 py-1 rounded text-slate-300">
                        {batch.students} Students
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${batch.progress > 70 ? 'bg-green-500' : batch.progress > 30 ? 'bg-blue-500' : 'bg-orange-500'}`} 
                        style={{ width: `${batch.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-right font-bold text-erp-text/50">{batch.progress}% Completed</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-erp-text/50">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a course to view detailed batch progress.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* New Course Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-erp-border bg-slate-900/50">
              <h2 className="text-xl font-bold text-erp-text font-display flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" /> Create New Course
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-erp-text/50 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-2">Course Name</label>
                <input 
                  type="text" 
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="e.g. Advanced AI Integration"
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-2">Short Description</label>
                <textarea 
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  placeholder="What will students learn?"
                  rows={3}
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-erp-border bg-slate-900/30 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateCourse} disabled={!newCourseName.trim()}>
                Create Course <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Module Modal */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-erp-border bg-slate-900/50">
              <h2 className="text-xl font-bold text-erp-text font-display flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-400" /> Add New Module
              </h2>
              <button onClick={() => setIsModuleModalOpen(false)} className="text-erp-text/50 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex bg-erp-background border border-erp-border rounded-lg p-1 mb-4">
                <button
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${moduleCreationMode === 'new' ? 'bg-indigo-500 text-white' : 'text-erp-text/60 hover:text-erp-text'}`}
                  onClick={() => setModuleCreationMode('new')}
                >
                  Create New
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${moduleCreationMode === 'existing' ? 'bg-indigo-500 text-white' : 'text-erp-text/60 hover:text-erp-text'}`}
                  onClick={() => setModuleCreationMode('existing')}
                >
                  Add Existing
                </button>
              </div>

              {moduleCreationMode === 'new' ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-erp-text/70 mb-2">Module Name</label>
                    <input 
                      type="text" 
                      value={newModuleName}
                      onChange={(e) => setNewModuleName(e.target.value)}
                      placeholder="e.g. Module 1: Introduction to Python"
                      className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-sm font-bold text-erp-text/70">IT Module (Includes Coding)?</span>
                    <button 
                      onClick={() => setNewModuleIsIt(!newModuleIsIt)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${newModuleIsIt ? 'bg-indigo-500' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform ${newModuleIsIt ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-erp-text/70 mb-2">Select Existing Module</label>
                  <select 
                    value={selectedExistingModule}
                    onChange={(e) => setSelectedExistingModule(e.target.value)}
                    className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Module --</option>
                    {allModulesList.map(mod => (
                      <option key={mod.id} value={mod.id}>{mod.title}</option>
                    ))}
                  </select>
                  <p className="text-xs text-erp-text/50 mt-2">
                    Changes made to this module will reflect across all courses it is assigned to.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-erp-border bg-slate-900/30 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsModuleModalOpen(false)}>Cancel</Button>
              <Button 
                variant="primary" 
                onClick={handleAddModule} 
                disabled={moduleCreationMode === 'new' ? !newModuleName.trim() : !selectedExistingModule}
              >
                Add Module <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Pitch Modal */}
      {isPitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-erp-border bg-slate-900/50">
              <h2 className="text-xl font-bold text-erp-text font-display flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" /> Edit Sales Pitch
              </h2>
              <button onClick={() => setIsPitchModalOpen(false)} className="text-erp-text/50 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-2">Pitch Summary</label>
                <input 
                  type="text" 
                  value={pitchSummary}
                  onChange={(e) => setPitchSummary(e.target.value)}
                  placeholder="Short description for the sales agent"
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-2">Detailed Pitch Script</label>
                <textarea 
                  value={pitchScript}
                  onChange={(e) => setPitchScript(e.target.value)}
                  placeholder="The exact script sales agents should read to leads..."
                  rows={4}
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-erp-border bg-slate-900/30 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsPitchModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSavePitch}>
                Save Pitch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal 
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
