import { useState, useEffect } from 'react';
import {
  Settings, Bell, Briefcase, FileText, ToggleLeft, ToggleRight,
  Plus, Trash2, Check, Loader2, Upload, ExternalLink,
  Eye, EyeOff
} from 'lucide-react';
import {
  getPortalSettings, updatePortalSetting,
  getAnnouncementsAdmin, createAnnouncement, deleteAnnouncement,
  getJobListingsAdmin, createJobListing, deleteJobListing,
  getCourseMaterials, createCourseMaterial, deleteCourseMaterial,
} from '../../../lib/api/portalSettings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalSettings { [key: string]: string }

const FEATURE_FLAGS = [
  { key: 'show_referrals',      label: 'Rewards & Materials Page', desc: 'Students can see their referral rewards and share materials' },
  { key: 'show_career',         label: 'Career Center',            desc: 'Job listings and placement resources' },
  { key: 'show_mock_interview', label: 'AI Mock Interview',        desc: 'AI-powered voice mock interview feature' },
  { key: 'show_attendance',     label: 'Attendance Page',          desc: 'Students can see their attendance history' },
  { key: 'show_gamification',   label: 'Gamification (Level/Coins)',  desc: 'Streak, coins, level system visibility' },
];

// ─── Shared Styles ────────────────────────────────────────────────────────────

const card = "bg-erp-surface border border-erp-border rounded-2xl";
const input = "w-full px-4 py-2.5 rounded-xl bg-erp-background border border-erp-border text-erp-text placeholder-erp-text/30 text-sm focus:outline-none focus:ring-2 focus:ring-erp-primary/40";
const btnPrimary = "flex items-center gap-2 px-4 py-2.5 rounded-xl bg-erp-primary text-white text-sm font-bold hover:opacity-90 transition-all";
const btnDanger = "p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors";

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl bg-erp-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-erp-primary" />
      </div>
      <div>
        <h2 className="text-erp-text font-bold text-base">{title}</h2>
        <p className="text-erp-text/50 text-sm">{desc}</p>
      </div>
    </div>
  );
}

// ─── Save Toast ───────────────────────────────────────────────────────────────

function SaveToast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-white font-bold text-sm shadow-xl animate-in fade-in slide-in-from-bottom-2">
      <Check className="w-4 h-4" /> Saved!
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentPortalSettings() {
  const [activeTab, setActiveTab] = useState<'features' | 'announcements' | 'jobs' | 'materials'>('features');
  const [settings, setSettings] = useState<PortalSettings>({});
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  // Form states
  const [annForm, setAnnForm] = useState({ title: '', body: '' });
  const [jobForm, setJobForm] = useState({ title: '', company: '', location: '', qualifications: '', source_url: '', expire_date: '' });
  const [matForm, setMatForm] = useState({ title: '', description: '', file_url: '', material_type: 'pdf', course_id: '' });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, ann, j, m] = await Promise.all([
        getPortalSettings(),
        getAnnouncementsAdmin(),
        getJobListingsAdmin(),
        getCourseMaterials(),
      ]);
      setSettings(s);
      setAnnouncements(ann);
      setJobs(j);
      setMaterials(m);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  const toggleFeature = async (key: string) => {
    const newVal = settings[key] === '1' ? '0' : '1';
    setSettings(prev => ({ ...prev, [key]: newVal }));
    await updatePortalSetting(key, newVal);
    showToast();
  };

  const handleCreateAnn = async () => {
    if (!annForm.title.trim()) return;
    setSaving(true);
    try {
      await createAnnouncement(annForm.title, annForm.body);
      setAnnForm({ title: '', body: '' });
      const ann = await getAnnouncementsAdmin();
      setAnnouncements(ann);
      showToast();
    } finally { setSaving(false); }
  };

  const handleDeleteAnn = async (id: string) => {
    await deleteAnnouncement(id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const handleCreateJob = async () => {
    if (!jobForm.title.trim() || !jobForm.company.trim()) return;
    setSaving(true);
    try {
      await createJobListing(jobForm);
      setJobForm({ title: '', company: '', location: '', qualifications: '', source_url: '', expire_date: '' });
      const j = await getJobListingsAdmin();
      setJobs(j);
      showToast();
    } finally { setSaving(false); }
  };

  const handleDeleteJob = async (id: string) => {
    await deleteJobListing(id);
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const handleCreateMaterial = async () => {
    if (!matForm.title.trim()) return;
    setSaving(true);
    try {
      await createCourseMaterial(matForm);
      setMatForm({ title: '', description: '', file_url: '', material_type: 'pdf', course_id: '' });
      const m = await getCourseMaterials();
      setMaterials(m);
      showToast();
    } finally { setSaving(false); }
  };

  const handleDeleteMaterial = async (id: string) => {
    await deleteCourseMaterial(id);
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const TABS = [
    { key: 'features',      icon: ToggleLeft,  label: 'Features'      },
    { key: 'announcements', icon: Bell,        label: 'Announcements' },
    { key: 'jobs',          icon: Briefcase,   label: 'Job Listings'  },
    { key: 'materials',     icon: FileText,    label: 'Materials'     },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-erp-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-erp-primary/10 flex items-center justify-center">
          <Settings className="w-6 h-6 text-erp-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-erp-text">Student Portal Settings</h1>
          <p className="text-erp-text/50 text-sm">Control what students see and manage content</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1.5 p-1 rounded-2xl bg-erp-surface border border-erp-border overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                active
                  ? 'bg-erp-primary text-white shadow-sm'
                  : 'text-erp-text/50 hover:text-erp-text hover:bg-erp-background'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── FEATURES TAB ── */}
      {activeTab === 'features' && (
        <div className={`${card} overflow-hidden`}>
          <SectionHeader icon={ToggleLeft} title="Portal Feature Toggles" desc="Toggle which sections are visible to students in their portal" />
          <div className="divide-y divide-erp-border">
            {FEATURE_FLAGS.map(flag => {
              const isOn = settings[flag.key] !== '0';
              return (
                <div key={flag.key} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isOn
                      ? <Eye className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      : <EyeOff className="w-4 h-4 text-erp-text/30 flex-shrink-0" />
                    }
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${isOn ? 'text-erp-text' : 'text-erp-text/40'}`}>{flag.label}</p>
                      <p className="text-erp-text/40 text-xs truncate">{flag.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFeature(flag.key)}
                    className="flex-shrink-0 transition-transform hover:scale-105"
                  >
                    {isOn
                      ? <ToggleRight className="w-8 h-8 text-erp-primary" />
                      : <ToggleLeft className="w-8 h-8 text-erp-text/30" />
                    }
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ANNOUNCEMENTS TAB ── */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className={`${card} p-6`}>
            <SectionHeader icon={Bell} title="Create Announcement" desc="Announcements scroll as a banner on the student dashboard" />
            <div className="space-y-3">
              <input
                className={input}
                placeholder="Announcement title *"
                value={annForm.title}
                onChange={e => setAnnForm(p => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className={`${input} min-h-[80px] resize-none`}
                placeholder="Optional body / details"
                value={annForm.body}
                onChange={e => setAnnForm(p => ({ ...p, body: e.target.value }))}
              />
              <button onClick={handleCreateAnn} disabled={saving || !annForm.title.trim()} className={btnPrimary}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Publish Announcement
              </button>
            </div>
          </div>

          <div className={card}>
            <div className="px-6 py-4 border-b border-erp-border flex items-center gap-2">
              <Bell className="w-4 h-4 text-erp-text/50" />
              <span className="text-sm font-bold text-erp-text">Active Announcements</span>
              <span className="ml-auto text-xs text-erp-text/30 font-bold">{announcements.filter(a => a.is_active).length} active</span>
            </div>
            {announcements.length === 0 ? (
              <div className="py-12 text-center text-erp-text/30 text-sm">No announcements yet</div>
            ) : (
              <div className="divide-y divide-erp-border">
                {announcements.map(ann => (
                  <div key={ann.id} className="flex items-start gap-3 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-erp-text">{ann.title}</p>
                      {ann.body && <p className="text-erp-text/50 text-xs mt-0.5 line-clamp-2">{ann.body}</p>}
                    </div>
                    <button onClick={() => handleDeleteAnn(ann.id)} className={btnDanger} title="Deactivate">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── JOB LISTINGS TAB ── */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className={`${card} p-6`}>
            <SectionHeader icon={Briefcase} title="Add Job Listing" desc="Job listings appear in the student Career Center" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={input} placeholder="Job title *" value={jobForm.title} onChange={e => setJobForm(p => ({ ...p, title: e.target.value }))} />
              <input className={input} placeholder="Company *" value={jobForm.company} onChange={e => setJobForm(p => ({ ...p, company: e.target.value }))} />
              <input className={input} placeholder="Location" value={jobForm.location} onChange={e => setJobForm(p => ({ ...p, location: e.target.value }))} />
              <input className={input} placeholder="Expire date (YYYY-MM-DD)" value={jobForm.expire_date} onChange={e => setJobForm(p => ({ ...p, expire_date: e.target.value }))} />
              <input className={`${input} sm:col-span-2`} placeholder="Job URL (optional)" value={jobForm.source_url} onChange={e => setJobForm(p => ({ ...p, source_url: e.target.value }))} />
              <textarea className={`${input} sm:col-span-2 min-h-[70px] resize-none`} placeholder="Qualifications / requirements" value={jobForm.qualifications} onChange={e => setJobForm(p => ({ ...p, qualifications: e.target.value }))} />
            </div>
            <button onClick={handleCreateJob} disabled={saving || !jobForm.title.trim() || !jobForm.company.trim()} className={`${btnPrimary} mt-3`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Job Listing
            </button>
          </div>

          <div className={card}>
            <div className="px-6 py-4 border-b border-erp-border flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-erp-text/50" />
              <span className="text-sm font-bold text-erp-text">Job Listings</span>
              <span className="ml-auto text-xs text-erp-text/30 font-bold">{jobs.length} total</span>
            </div>
            {jobs.length === 0 ? (
              <div className="py-12 text-center text-erp-text/30 text-sm">No job listings yet</div>
            ) : (
              <div className="divide-y divide-erp-border">
                {jobs.map(job => (
                  <div key={job.id} className="flex items-start gap-3 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-erp-text">{job.title}</p>
                      <p className="text-erp-text/50 text-xs mt-0.5">{job.company} {job.location && `· ${job.location}`}</p>
                      {job.source_url && (
                        <a href={job.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-erp-primary/70 mt-1 hover:text-erp-primary">
                          <ExternalLink className="w-3 h-3" /> Apply Link
                        </a>
                      )}
                    </div>
                    <button onClick={() => handleDeleteJob(job.id)} className={btnDanger} title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MATERIALS TAB ── */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className={`${card} p-6`}>
            <SectionHeader icon={Upload} title="Upload Shareable Material" desc="Materials students can download and share with their network" />
            <div className="space-y-3">
              <input className={input} placeholder="Material title *" value={matForm.title} onChange={e => setMatForm(p => ({ ...p, title: e.target.value }))} />
              <textarea className={`${input} min-h-[70px] resize-none`} placeholder="Short description (what is this material?)" value={matForm.description} onChange={e => setMatForm(p => ({ ...p, description: e.target.value }))} />
              <input className={input} placeholder="File URL (Google Drive, Canva, PDF link etc.)" value={matForm.file_url} onChange={e => setMatForm(p => ({ ...p, file_url: e.target.value }))} />
              <div className="flex gap-3">
                <select
                  className={`${input} flex-1`}
                  value={matForm.material_type}
                  onChange={e => setMatForm(p => ({ ...p, material_type: e.target.value }))}
                >
                  <option value="pdf">PDF</option>
                  <option value="brochure">Brochure</option>
                  <option value="template">Template</option>
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button onClick={handleCreateMaterial} disabled={saving || !matForm.title.trim()} className={btnPrimary}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Add Material
              </button>
            </div>
          </div>

          <div className={card}>
            <div className="px-6 py-4 border-b border-erp-border flex items-center gap-2">
              <FileText className="w-4 h-4 text-erp-text/50" />
              <span className="text-sm font-bold text-erp-text">Shareable Materials</span>
              <span className="ml-auto text-xs text-erp-text/30 font-bold">{materials.length} total</span>
            </div>
            {materials.length === 0 ? (
              <div className="py-12 text-center text-erp-text/30 text-sm">No materials yet — add some above</div>
            ) : (
              <div className="divide-y divide-erp-border">
                {materials.map(mat => (
                  <div key={mat.id} className="flex items-start gap-3 px-6 py-4">
                    <div className="w-8 h-8 rounded-lg bg-erp-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-erp-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-erp-text">{mat.title}</p>
                      {mat.description && <p className="text-erp-text/40 text-xs mt-0.5 line-clamp-2">{mat.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-erp-primary/50">{mat.material_type}</span>
                        {mat.file_url && (
                          <a href={mat.file_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-erp-primary/60 hover:text-erp-primary flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Preview
                          </a>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteMaterial(mat.id)} className={btnDanger} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <SaveToast show={toast} />
    </div>
  );
}
