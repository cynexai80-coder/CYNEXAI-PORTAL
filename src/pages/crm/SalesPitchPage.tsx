import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { getCoursesForPitch, getCourseModules, updateCoursePitch } from '../../lib/api/sales';
import { createLead } from '../../lib/api/crm';
import { getCourseMaterials, addCourseMaterial, deleteCourseMaterial, CourseMaterial } from '../../lib/api/materials';
import { Button } from '../../components/ui/erp/Button';
import { BookOpen, Share2, ClipboardList, CheckCircle, AlertCircle, Edit2, Save, X, Download, UserPlus, Phone, Mail, User, Tag, MapPin, GraduationCap, Monitor, FileText, Plus, Trash2, MessageSquare, Copy, Send } from 'lucide-react';
import { getCurrentUser } from '../../lib/auth';

interface CoursePitchData {
  id: string;
  title: string;
  sales_pitch_summary: string;
  sales_pitch_script: string;
  modules: string[];
}

export default function SalesPitchPage() {
  const [courses, setCourses] = useState<CoursePitchData[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editScript, setEditScript] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [saving, setSaving] = useState(false);

  // Material upload state
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', url: '' });

  // Full Lead Entry state
  const initialLeadState = { 
    name: '', phone: '', email: '', source: '', course_interest: '',
    grad_year: '', qualification: '', it_background: '', preferred_mode: '', location: '', notes: ''
  };
  const [newLead, setNewLead] = useState(initialLeadState);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState('');

  // Pitch template (what we send) — stored per course in localStorage
  const [pitchTemplate, setPitchTemplate] = useState('');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);

  const user = getCurrentUser();
  const canEdit = user?.role === 'Manager' || user?.role === 'CEO' || user?.role === 'DM' || user?.role === 'Admin';
  
  const scriptTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchPitchData = async () => {
      try {
        const { client, isTursoConfigured } = await import('../../lib/turso');
        if (!isTursoConfigured || !client) {
          setLoading(false);
          return;
        }

        const courseRes = await getCoursesForPitch();
        
        const fetchedCourses: CoursePitchData[] = [];
        for (const c of courseRes) {
          const modules = await getCourseModules(c.id as string);
          fetchedCourses.push({
            id: c.id as string,
            title: c.title as string,
            sales_pitch_summary: (c.sales_pitch_summary as string) || `Master ${c.title}. Enroll now!`,
            sales_pitch_script: (c.sales_pitch_script as string) || `Hi! This is our flagship ${c.title} course. You'll get hands-on experience and direct placement support!`,
            modules
          });
        }
        
        setCourses(fetchedCourses);
        if (fetchedCourses.length > 0) {
          setSelectedCourseId(fetchedCourses[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch pitch data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPitchData();
  }, []);

  const selectedData = courses.find(c => c.id === selectedCourseId);

  useEffect(() => {
    setIsEditing(false);
    if (selectedData) {
      setEditScript(selectedData.sales_pitch_script);
      setEditSummary(selectedData.sales_pitch_summary);
      setNewLead(prev => ({ ...prev, course_interest: selectedData.title }));
    }
  }, [selectedCourseId, selectedData]);

  useEffect(() => {
    if (selectedCourseId) {
      getCourseMaterials(selectedCourseId).then(setMaterials);
    }
  }, [selectedCourseId]);

  // Load pitch template from localStorage when course changes
  useEffect(() => {
    if (!selectedCourseId) return;
    const saved = localStorage.getItem(`pitch_template_${selectedCourseId}`);
    if (saved) {
      setPitchTemplate(saved);
    } else if (selectedData) {
      // Default template
      setPitchTemplate(
        `Hi [Name]! 👋

Thank you for your interest in our *${selectedData.title}* program at CynexAI!

Here's what you'll get:
${selectedData.modules.slice(0, 5).map(m => `✅ ${m}`).join('\n')}

This program is designed to give you hands-on experience and direct placement support. 🚀

Would love to get on a quick call to walk you through everything. When are you free?

— CynexAI Team`
      );
    }
  }, [selectedCourseId, selectedData?.title]);

  const handleSave = async () => {
    if (!selectedData) return;
    setSaving(true);
    const success = await updateCoursePitch(selectedData.id, editSummary, editScript);
    if (success) {
      setCourses(prev => prev.map(c => c.id === selectedData.id ? { ...c, sales_pitch_script: editScript, sales_pitch_summary: editSummary } : c));
      setIsEditing(false);
    } else {
      alert("Failed to save changes.");
    }
    setSaving(false);
  };

  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditScript(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };
  
  useEffect(() => {
    if (isEditing && scriptTextareaRef.current) {
      scriptTextareaRef.current.style.height = 'auto';
      scriptTextareaRef.current.style.height = scriptTextareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError('');
    
    if (!newLead.name || !newLead.phone || !newLead.email || !newLead.source) {
      setLeadError('Please fill out Name, Phone, Email, and Source.');
      return;
    }

    const phoneClean = newLead.phone.replace(/\D/g, '');
    if (phoneClean.length < 10 || phoneClean.length > 15) {
      setLeadError('Please enter a valid 10-15 digit phone number.');
      return;
    }
    
    setLeadSubmitting(true);
    const leadData = {
      ...newLead,
      status: 'New' as any,
      assigned_to: user?.id || ''
    };
    
    const id = await createLead(leadData);
    
    if (id) {
      setLeadSuccess(true);
      setNewLead({ ...initialLeadState, course_interest: selectedData?.title || '' });
      setTimeout(() => setLeadSuccess(false), 3000);
    } else {
      setLeadError('Failed to create lead. Please try again.');
    }
    setLeadSubmitting(false);
  };

  const handleAddMaterial = async () => {
    if (!selectedCourseId || !newMaterial.title || !newMaterial.url) return;
    const id = await addCourseMaterial(selectedCourseId, newMaterial.title, newMaterial.url);
    if (id) {
      setMaterials([...materials, { id, course_id: selectedCourseId, title: newMaterial.title, url: newMaterial.url, type: 'Demo Material' }]);
      setIsAddingMaterial(false);
      setNewMaterial({ title: '', url: '' });
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (window.confirm("Delete this demo material?")) {
      const success = await deleteCourseMaterial(id);
      if (success) {
        setMaterials(materials.filter(m => m.id !== id));
      }
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-32">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-erp-primary" /> Sales Pitch Assistant
            </h1>
            <p className="text-erp-text/70 font-medium mt-1">Dynamically updated pitch scripts, materials, and comprehensive lead entry.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64 text-erp-text/50 font-bold">
            <div className="w-8 h-8 border-4 border-erp-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : courses.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-erp-text/50">
            <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
            <h2 className="text-xl font-bold mb-2">No Courses Found</h2>
            <p>Please ensure courses are created in the Course CMS.</p>
          </Card>
        ) : selectedData ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              
              {/* Course Selection */}
              <Card className="bg-white dark:bg-black">
                <h2 className="text-xl font-bold font-display mb-4 text-erp-text">1. Select Course Target</h2>
                <div className="flex gap-3 mb-6 overflow-x-auto pb-2 no-scrollbar">
                  {courses.map(course => (
                    <button
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      className={`px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${selectedCourseId === course.id ? 'bg-erp-primary text-white shadow-lg shadow-erp-primary/30 transform scale-105' : 'bg-erp-surface text-erp-text/70 hover:bg-erp-primary/10 hover:text-erp-primary border border-erp-border'}`}
                    >
                      {course.title}
                    </button>
                  ))}
                </div>

                {/* Script Box */}
                <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/40 dark:to-slate-900 border-2 border-blue-200 dark:border-blue-800/40 rounded-2xl p-6 relative shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2 text-lg">
                      <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Calling Script
                    </h3>
                    {canEdit && !isEditing && (
                      <button onClick={() => setIsEditing(true)} className="bg-white dark:bg-black px-3 py-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm flex items-center gap-2 font-bold shadow-sm border border-blue-200 dark:border-blue-800/60 transition-colors">
                        <Edit2 className="w-4 h-4" /> Edit Script
                      </button>
                    )}
                    {isEditing && (
                      <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="bg-white dark:bg-black px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-white text-sm flex items-center gap-2 font-bold shadow-sm border border-gray-200 dark:border-white/10 transition-colors">
                          <X className="w-4 h-4" /> Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving} className="bg-blue-600 px-4 py-1.5 rounded-lg text-white hover:bg-blue-700 text-sm flex items-center gap-2 font-bold shadow-sm transition-colors">
                          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <textarea 
                      ref={scriptTextareaRef}
                      value={editScript}
                      onChange={handleScriptChange}
                      className="w-full min-h-[200px] p-4 rounded-xl border-2 border-blue-300 dark:border-blue-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none bg-white dark:bg-black font-medium text-blue-950 dark:text-blue-100 text-lg resize-none shadow-inner"
                      placeholder="Enter the sales script here..."
                    />
                  ) : (
                    <p className="text-xl font-medium text-blue-950 dark:text-blue-100 leading-relaxed whitespace-pre-wrap">
                      "{selectedData.sales_pitch_script}"
                    </p>
                  )}
                </div>
              </Card>

              {/* Modules List */}
              <Card>
                <h3 className="font-bold text-erp-text mb-4 text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-erp-primary" /> 
                  Curriculum & Modules ({selectedData.modules.length})
                </h3>
                <div className="flex flex-wrap gap-3">
                  {selectedData.modules.length > 0 ? (
                    selectedData.modules.map((mod, idx) => (
                      <span key={idx} className="bg-erp-surface border-2 border-erp-border text-erp-text font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {mod}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm font-bold text-erp-text/40 bg-erp-surface p-4 rounded-xl w-full text-center border-2 border-dashed border-erp-border">No modules added yet.</p>
                  )}
                </div>
              </Card>

              {/* Course Summary */}
              <Card>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-erp-text text-sm uppercase">Course Summary</h3>
                </div>
                {isEditing ? (
                  <textarea 
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    className="w-full min-h-[100px] p-3 rounded-xl border-2 border-slate-200 dark:border-white/10 focus:border-slate-400 focus:outline-none bg-erp-surface font-medium text-sm text-erp-text/80 resize-y"
                  />
                ) : (
                  <p className="text-erp-text/70 font-medium text-sm leading-relaxed">{selectedData.sales_pitch_summary}</p>
                )}
              </Card>
            </div>

            {/* Right Sidebar */}
            <div className="xl:col-span-1 space-y-6">
              
              {/* Full Lead Entry Form */}
              <Card className="border-2 border-erp-primary/20 shadow-lg">
                <h3 className="font-bold text-erp-text mb-4 text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-erp-primary" /> Lead Entry Form
                </h3>
                
                <form onSubmit={handleCreateLead} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative col-span-2">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                      <input type="text" required placeholder="Full Name *" value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg pl-10 pr-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors text-gray-900 dark:text-white placeholder-gray-500" />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                      <input type="tel" required minLength={10} maxLength={15} pattern="[0-9\+\-\s]+" title="Valid phone number required" placeholder="Phone *" value={newLead.phone} onChange={e => setNewLead({...newLead, phone: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg pl-10 pr-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors text-gray-900 dark:text-white placeholder-gray-500" />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                      <input type="email" required placeholder="Email *" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg pl-10 pr-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors text-gray-900 dark:text-white placeholder-gray-500" />
                    </div>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                      <select required value={newLead.source} onChange={e => setNewLead({...newLead, source: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg pl-10 pr-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors appearance-none text-gray-900 dark:text-white">
                        <option value="" disabled className="text-gray-500">Source *</option>
                        <option value="Walk-in">Walk-in</option>
                        <option value="Facebook Ad">Facebook Ad</option>
                        <option value="Google Ad">Google Ad</option>
                        <option value="Website">Website</option>
                        <option value="Referral">Referral</option>
                        <option value="Cold Call">Cold Call</option>
                      </select>
                    </div>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                      <select value={newLead.course_interest} onChange={e => setNewLead({...newLead, course_interest: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg pl-10 pr-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors appearance-none text-gray-900 dark:text-white">
                        <option value="" disabled className="text-gray-500">Course Interest</option>
                        {courses.map(course => (
                          <option key={course.id} value={course.title}>{course.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                      <input type="text" placeholder="Location" value={newLead.location} onChange={e => setNewLead({...newLead, location: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg pl-10 pr-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors text-gray-900 dark:text-white placeholder-gray-500" />
                    </div>
                    <div className="relative">
                      <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                      <select value={newLead.preferred_mode} onChange={e => setNewLead({...newLead, preferred_mode: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg pl-10 pr-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors appearance-none text-gray-900 dark:text-white">
                        <option value="" disabled className="text-gray-500">Pref. Mode</option>
                        <option value="Online">Online</option>
                        <option value="Offline">Offline</option>
                      </select>
                    </div>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                      <select value={newLead.qualification} onChange={e => setNewLead({...newLead, qualification: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg pl-10 pr-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors appearance-none text-gray-900 dark:text-white">
                        <option value="" disabled className="text-gray-500">Qualification</option>
                        <option value="B.Tech/BE">B.Tech/BE</option>
                        <option value="M.Tech/ME">M.Tech/ME</option>
                        <option value="BCA">BCA</option>
                        <option value="MCA">MCA</option>
                        <option value="BSc">BSc</option>
                        <option value="MSc">MSc</option>
                        <option value="BBA/BBM">BBA/BBM</option>
                        <option value="MBA">MBA</option>
                        <option value="BCom">BCom</option>
                        <option value="Diploma">Diploma</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-erp-text/40" />
                      <input type="text" placeholder="Grad Year" value={newLead.grad_year} onChange={e => setNewLead({...newLead, grad_year: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg pl-10 pr-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors text-gray-900 dark:text-white placeholder-gray-500" />
                    </div>
                    <div className="relative col-span-2">
                      <select value={newLead.it_background} onChange={e => setNewLead({...newLead, it_background: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg px-4 py-2 font-bold focus:border-erp-primary outline-none transition-colors appearance-none text-gray-900 dark:text-white">
                        <option value="" disabled className="text-gray-500">IT Background?</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div className="relative col-span-2">
                      <textarea placeholder="Additional Notes..." value={newLead.notes} onChange={e => setNewLead({...newLead, notes: e.target.value})} className="w-full bg-erp-surface border border-erp-border rounded-lg px-4 py-2 font-medium focus:border-erp-primary outline-none transition-colors min-h-[60px] resize-y text-sm text-gray-900 dark:text-white placeholder-gray-500" />
                    </div>
                  </div>
                  
                  {leadError && (
                    <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded-md border border-red-200">{leadError}</p>
                  )}
                  {leadSuccess && (
                    <p className="text-green-600 text-xs font-bold bg-green-50 p-2 rounded-md border border-green-200 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Lead assigned as 'New'
                    </p>
                  )}
                  
                  <div className="flex gap-2 mt-2">
                    <Button type="submit" variant="primary" fullWidth disabled={leadSubmitting} className="text-sm shadow-md h-10">
                      {leadSubmitting ? 'Saving...' : 'Add Lead Record'}
                    </Button>
                    {newLead.phone.replace(/\D/g, '').length >= 10 && (
                      <button
                        type="button"
                        title="Send WhatsApp using pitch template"
                        onClick={() => {
                          const phone = newLead.phone.replace(/\D/g, '');
                          const intlPhone = phone.startsWith('91') ? phone : `91${phone}`;
                          const msg = pitchTemplate
                            .replace(/\[Name\]/g, newLead.name || '[Name]')
                            .replace(/\[Course\]/g, newLead.course_interest || selectedData?.title || '[Course]');
                          window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        className="flex-shrink-0 flex items-center justify-center gap-1 px-3 h-10 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-colors shadow-md"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                    )}
                  </div>
                </form>
              </Card>

              {/* What We Send — Pitch Message Template */}
              <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-erp-text text-lg flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    What We Send
                  </h3>
                  <div className="flex gap-2">
                    {canEdit && (
                      <button
                        onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                        className="p-1.5 rounded-lg bg-white dark:bg-black/20 text-green-700 dark:text-green-400 text-xs font-bold"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(pitchTemplate);
                        setTemplateCopied(true);
                        setTimeout(() => setTemplateCopied(false), 2000);
                      }}
                      className="p-1.5 rounded-lg bg-white dark:bg-black/20 text-green-700 dark:text-green-400 text-xs font-bold flex items-center gap-1"
                    >
                      {templateCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-erp-text/50 mb-2">Use <code className="bg-black/10 px-1 rounded">[Name]</code> and <code className="bg-black/10 px-1 rounded">[Course]</code> as placeholders.</p>
                {isEditingTemplate ? (
                  <>
                    <textarea
                      value={pitchTemplate}
                      onChange={e => setPitchTemplate(e.target.value)}
                      className="w-full min-h-[180px] p-3 rounded-xl border-2 border-green-300 focus:border-green-500 focus:outline-none bg-white dark:bg-black/30 font-medium text-sm text-erp-text resize-y"
                    />
                    <button
                      onClick={() => {
                        localStorage.setItem(`pitch_template_${selectedCourseId}`, pitchTemplate);
                        setIsEditingTemplate(false);
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-xl text-sm transition-colors"
                    >
                      <Save className="w-4 h-4" /> Save Template
                    </button>
                  </>
                ) : (
                  <p className="text-sm font-medium text-erp-text/80 whitespace-pre-wrap bg-white/60 dark:bg-black/20 p-3 rounded-xl border border-green-200 dark:border-green-800">
                    {pitchTemplate || 'No template set. Click edit to add one.'}
                  </p>
                )}
              </Card>

              {/* Demo Materials Box */}
              <Card className="bg-gradient-to-br from-blue-600 to-sky-600 text-white border-none shadow-xl shadow-blue-500/20">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Download className="w-5 h-5" /> Demo Materials
                    </h3>
                    <p className="text-blue-100 text-sm">Download or share course materials.</p>
                  </div>
                  {canEdit && (
                    <button onClick={() => setIsAddingMaterial(!isAddingMaterial)} className="bg-white dark:bg-black/20 hover:bg-white dark:bg-black/30 p-1.5 rounded-lg transition-colors">
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>

                {isAddingMaterial && (
                  <div className="bg-black/20 p-3 rounded-lg mb-4 space-y-2">
                    <input type="text" placeholder="Material Title (e.g. PDF Brochure)" value={newMaterial.title} onChange={e => setNewMaterial({...newMaterial, title: e.target.value})} className="w-full bg-white dark:bg-black/10 border border-white/20 rounded px-3 py-1.5 text-sm text-white placeholder-white/50 focus:outline-none" />
                    <input type="url" placeholder="URL Link (Drive, DropBox, etc)" value={newMaterial.url} onChange={e => setNewMaterial({...newMaterial, url: e.target.value})} className="w-full bg-white dark:bg-black/10 border border-white/20 rounded px-3 py-1.5 text-sm text-white placeholder-white/50 focus:outline-none" />
                    <div className="flex gap-2">
                      <Button variant="info" className="flex-1 py-1 h-auto text-xs bg-white dark:bg-black text-blue-700 dark:text-blue-300 font-bold" onClick={handleAddMaterial}>Add</Button>
                      <Button variant="ghost" className="flex-1 py-1 h-auto text-xs text-white hover:bg-white dark:bg-black/20" onClick={() => setIsAddingMaterial(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {materials.length === 0 ? (
                    <div className="bg-white dark:bg-black/10 border border-white/20 border-dashed p-4 rounded-xl text-center text-sm font-medium text-white/70">
                      No materials assigned yet.
                    </div>
                  ) : (
                    materials.map(mat => (
                      <div key={mat.id} className="flex gap-2 items-stretch">
                        <Button variant="info" className="flex-1 flex flex-col items-center justify-center gap-1 bg-white dark:bg-black text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-bold border-none shadow-md py-3 h-auto" onClick={() => window.open(mat.url, '_blank')}>
                          <Download className="w-4 h-4" />
                          <span className="text-xs truncate max-w-full px-1">{mat.title}</span>
                        </Button>
                        <Button variant="info" className="w-10 flex-shrink-0 flex items-center justify-center bg-green-500 text-white hover:bg-green-600 font-bold border-none shadow-md p-0" onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this material: ${mat.title}\n${mat.url}`)}`, '_blank'); }} title="Share on WhatsApp">
                          <Share2 className="w-4 h-4" />
                        </Button>
                        {canEdit && (
                          <Button variant="info" className="w-10 flex-shrink-0 flex items-center justify-center bg-red-500/20 text-white hover:bg-red-500 font-bold border border-red-500/50 shadow-md p-0" onClick={() => handleDeleteMaterial(mat.id)} title="Delete Material">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
