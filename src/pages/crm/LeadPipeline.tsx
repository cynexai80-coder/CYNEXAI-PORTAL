import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getLeads, updateLeadStatus, addActivity, createLead, claimLead } from '../../lib/api/crm';
import { getCoursesForPitch } from '../../lib/api/sales';
import { createPendingStudent } from '../../lib/api/users';
import { Lead, LeadStatus } from '../../lib/types';
import { getCurrentUser } from '../../lib/auth';
import { Button } from '../../components/ui/erp/Button';
import { LeadDetailPanel } from '../../components/crm/LeadDetailPanel';
import {
  Plus, Phone, MessageCircle, Search, Filter, User,
  Calendar, CheckCircle2, AlertTriangle, XCircle,
  PhoneOff, PhoneCall, UserX, RefreshCw, X, Upload, Download
} from 'lucide-react';

const PIPELINE_STAGES: { id: LeadStatus; label: string; color: string; bg: string; darkBg: string; icon: React.ReactNode }[] = [
  { id: 'New',                  label: 'New Lead',       color: '#6366f1', bg: '#eef2ff', darkBg: '#1e1b4b22', icon: <User className="w-3 h-3" /> },
  { id: 'Not answering',        label: 'No Answer',      color: '#6b7280', bg: '#f3f4f6', darkBg: '#11111122', icon: <PhoneOff className="w-3 h-3" /> },
  { id: 'Busy',                 label: 'Busy',           color: '#f59e0b', bg: '#fffbeb', darkBg: '#1c140022', icon: <PhoneCall className="w-3 h-3" /> },
  { id: 'Invalid number',       label: 'Invalid No.',    color: '#ef4444', bg: '#fef2f2', darkBg: '#1c050522', icon: <XCircle className="w-3 h-3" /> },
  { id: 'Interested',           label: 'Interested',     color: '#10b981', bg: '#ecfdf5', darkBg: '#05180f22', icon: <CheckCircle2 className="w-3 h-3" /> },
  { id: 'Not Interested',       label: 'Not Int.',       color: '#f43f5e', bg: '#fff1f2', darkBg: '#1c050a22', icon: <UserX className="w-3 h-3" /> },
  { id: 'Demo Scheduled',       label: 'Demo Sched.',    color: '#8b5cf6', bg: '#f5f3ff', darkBg: '#13093522', icon: <Calendar className="w-3 h-3" /> },
  { id: 'Demo Completed',       label: 'Demo Done',      color: '#0ea5e9', bg: '#f0f9ff', darkBg: '#05121e22', icon: <CheckCircle2 className="w-3 h-3" /> },
  { id: 'Admission Completed',  label: 'Admission',      color: '#f97316', bg: '#fff7ed', darkBg: '#1c0d0022', icon: <CheckCircle2 className="w-3 h-3" /> },
  { id: 'Sale Partial Closed',  label: 'Partial Sale',   color: '#eab308', bg: '#fefce8', darkBg: '#1a150022', icon: <AlertTriangle className="w-3 h-3" /> },
  { id: 'Onboarded',            label: 'Onboarded',      color: '#14b8a6', bg: '#f0fdfa', darkBg: '#05181622', icon: <CheckCircle2 className="w-3 h-3" /> },
];

const HIDDEN_BY_DEFAULT = ['Not answering', 'Busy', 'Invalid number', 'Not Interested'];

// ── Mobile Lead Card ──────────────────────────────────────────────────────────
function MobileLeadCard({ lead, stage, onClick }: { lead: Lead; stage: typeof PIPELINE_STAGES[0]; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-erp-surface border border-erp-border rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
      style={{ borderLeft: `3px solid ${stage.color}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-bold text-sm text-erp-text leading-snug">{lead.name}</p>
        {lead.assignee_name && (
          <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
            {lead.assignee_name.split(' ')[0]}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {lead.course_interest && (
          <span className="text-[10px] font-semibold text-erp-primary bg-erp-primary/10 px-1.5 py-0.5 rounded-full">
            {lead.course_interest}
          </span>
        )}
        {lead.source && (
          <span className="text-[10px] font-semibold text-erp-text/60 bg-erp-border px-1.5 py-0.5 rounded-full">
            {lead.source}
          </span>
        )}
        {(lead.qualification || lead.grad_year) && (
          <span className="text-[10px] font-medium text-erp-text/60">
            {[lead.qualification, lead.grad_year].filter(Boolean).join(' • ')}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-erp-text/50 font-medium">{lead.phone || '—'}</span>
        <div className="flex gap-1.5">
          <a
            href={`https://wa.me/${lead.phone?.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </a>
          <a
            href={`tel:${lead.phone}`}
            onClick={e => e.stopPropagation()}
            className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LeadPipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenStages, setHiddenStages] = useState<Set<string>>(new Set(HIDDEN_BY_DEFAULT));
  const [showAllStages, setShowAllStages] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'All' | 'Mine'>('All');
  const [filterYear, setFilterYear] = useState('');
  const [filterQual, setFilterQual] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterIt, setFilterIt] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [onboardingLead, setOnboardingLead] = useState<Lead | null>(null);
  const [courses, setCourses] = useState<string[]>([]);
  const [onboardForm, setOnboardForm] = useState({
    name: '', email: '', phone: '', fees_total: '', fees_paid: '', fees_pending: '',
    joining_date: new Date().toISOString().split('T')[0], training_start_date: '',
    course: '', documents_submitted: 0, gender: 'Male', dob: ''
  });

  // Mobile: currently selected stage tab
  const [mobileStageIdx, setMobileStageIdx] = useState(0);

  const navigate = useNavigate();
  const user = getCurrentUser();

  const loadData = useCallback(() => { 
    getLeads().then(res => setLeads(res || [])); 
    getCoursesForPitch().then(res => setCourses(res ? res.map(c => String(c.title)) : []));
  }, []);
  useEffect(() => { loadData(); }, []);

  const visibleStages = showAllStages
    ? PIPELINE_STAGES
    : PIPELINE_STAGES.filter(s => !hiddenStages.has(s.id));

  const filteredLeads = leads.filter(l => {
    const matchesSearch = !searchQuery.trim() ||
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.phone && l.phone.includes(searchQuery)) ||
      (l.course_interest && l.course_interest.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesYear   = !filterYear   || (l.grad_year      && l.grad_year.includes(filterYear));
    const matchesQual   = !filterQual   || (l.qualification  && l.qualification.toLowerCase().includes(filterQual.toLowerCase()));
    const matchesCourse = !filterCourse || (l.course_interest && l.course_interest.toLowerCase().includes(filterCourse.toLowerCase()));
    const matchesIt     = !filterIt     || (l.it_background === filterIt);
    const matchesView   = viewMode === 'All' || l.assigned_to === user?.id;
    return matchesSearch && matchesYear && matchesQual && matchesCourse && matchesIt && matchesView;
  });

  const handleDragStart = () => setIsDragging(true);

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    if (!result.destination) return;
    const leadId = result.draggableId;
    const newStatus = result.destination.droppableId as LeadStatus;
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    setMoveError(null);

    let partialAmount = '';
    if (newStatus === 'Sale Partial Closed') {
      const amount = prompt("How much was paid for the partial close?");
      if (amount === null) { setLeads([...leads]); return; }
      partialAmount = amount;
    }
    if (newStatus === 'Onboarded') {
      setOnboardingLead(lead);
      setOnboardForm({
        name: lead.name || '', email: lead.email || '', phone: lead.phone || '',
        fees_total: '', fees_paid: '', fees_pending: '',
        joining_date: new Date().toISOString().split('T')[0], training_start_date: '',
        course: lead.course_interest || '', documents_submitted: 0, gender: 'Male', dob: ''
      });
      return;
    }

    // Optimistic Update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    executeMove(leadId, newStatus, partialAmount);
  };

  const executeMove = async (leadId: string, newStatus: LeadStatus, partialAmount = '', onboardData?: any) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const res = await updateLeadStatus(leadId, newStatus, user?.id || '');
    if (!res.success) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: lead.status } : l));
      setMoveError(res.error || 'Cannot move lead to this stage');
      setTimeout(() => setMoveError(null), 5000);
    } else if (user) {
      let note = `Status changed to: ${newStatus}`;
      if (partialAmount) note += ` (Amount: ${partialAmount})`;
      if (onboardData) note += ` (Fee: ${onboardData.fees_total})`;
      await addActivity(leadId, user.id, 'Note', note);
    }
  };

  const handleCardClick = async (lead: Lead) => {
    if (user && (!lead.assigned_to || lead.assigned_to === '')) {
      const res = await claimLead(lead.id, user.id);
      if (!res.success && res.alreadyClaimed) { alert('This lead is already being handled by someone else!'); loadData(); return; }
      else loadData();
    }
    setSelectedLeadId(lead.id);
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingLead) return;

    await createPendingStudent({
      name: onboardForm.name,
      email: onboardForm.email,
      phone: onboardForm.phone,
      fees_total: Number(onboardForm.fees_total) || 0,
      fees_paid: Number(onboardForm.fees_paid) || 0,
      fees_pending: Number(onboardForm.fees_pending) || 0,
      joining_date: onboardForm.joining_date,
      training_start_date: onboardForm.training_start_date,
      course: onboardForm.course,
      documents_submitted: onboardForm.documents_submitted,
      gender: onboardForm.gender,
      dob: onboardForm.dob
    });

    setLeads(prev => prev.map(l => l.id === onboardingLead.id ? { ...l, status: 'Onboarded' } : l));
    executeMove(onboardingLead.id, 'Onboarded', '', onboardForm);
    alert(`Student sent to Manager for Approval: ${onboardingLead.name}.`);
    setOnboardingLead(null);
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploadingCsv(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      let successCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const leadData: any = { name: '', email: '', phone: '', course_interest: '', source: 'CSV Upload', status: 'New', assigned_to: '' };
        headers.forEach((h, index) => {
          const val = values[index];
          if (!val) return;
          
          if (h.includes('name')) leadData.name = val;
          else if (h.includes('email')) leadData.email = val;
          else if (h.includes('phone') || h.includes('number')) {
            // Strip any non-digit characters. If the column had a name by mistake, it will become empty.
            const sanitizedPhone = val.replace(/\D/g, '');
            // Only accept if it looks like a valid phone length (at least 7 digits)
            if (sanitizedPhone.length >= 7) leadData.phone = sanitizedPhone;
          }
          else if (h.includes('course')) leadData.course_interest = val;
          else if (h.includes('source')) leadData.source = val;
          else if (h === 'status') {
            const matchedStage = PIPELINE_STAGES.find(s => s.id.toLowerCase() === val.toLowerCase());
            leadData.status = matchedStage ? matchedStage.id : 'New';
          }
          // Any other unrecognized columns are simply ignored!
        });

        // Only create lead if it has a name, AND (a valid phone OR an email)
        if (leadData.name && (leadData.phone || leadData.email)) {
          const newId = await createLead(leadData);
          if (newId) successCount++;
        }
      }
      alert(`Successfully imported ${successCount} leads!`);
      loadData();
    } catch (e: any) {
      alert("Error importing CSV: " + e.message);
    } finally {
      setIsUploadingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const leadsByStage = (stageId: string) => filteredLeads.filter(l => l.status === stageId);
  const totalByStage = (stageId: string) => leads.filter(l => l.status === stageId).length;
  const mobileStage = visibleStages[mobileStageIdx] || visibleStages[0];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-erp-background">

      {/* ── Desktop Header ─────────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between px-5 py-3.5 border-b-2 border-erp-border bg-erp-surface flex-shrink-0 gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-display font-black text-erp-text leading-tight">CRM Pipeline</h1>
          <p className="text-[11px] font-medium text-erp-text/40 mt-0.5">{leads.length} total leads · Drag cards to update stage</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-erp-text/40" />
            <input
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search leads or phone..."
              className="bg-erp-background border-2 border-erp-border rounded-xl pl-8 pr-3 py-2 text-sm w-48 focus:outline-none focus:border-erp-primary font-medium transition-all text-erp-text placeholder:text-erp-text/30"
            />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2.5"><X className="w-4 h-4 text-erp-text/30 hover:text-erp-text" /></button>}
          </div>

          <div className="flex bg-erp-background border-2 border-erp-border rounded-xl overflow-hidden p-0.5">
            <button onClick={() => setViewMode('All')} className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${viewMode === 'All' ? 'bg-erp-surface shadow-sm text-erp-text' : 'text-erp-text/50'}`}>All Leads</button>
            <button onClick={() => setViewMode('Mine')} className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${viewMode === 'Mine' ? 'bg-erp-surface shadow-sm text-erp-text' : 'text-erp-text/50'}`}>My Leads</button>
          </div>
          <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border-2 transition-colors ${showAdvancedFilters ? 'border-erp-primary text-erp-primary' : 'border-erp-border text-erp-text/70'}`}>
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
          <button onClick={() => setShowAllStages(v => !v)} className="text-xs font-bold px-3 py-2 rounded-xl border-2 border-erp-border text-erp-text/70 hover:border-erp-primary transition-colors">
            {showAllStages ? 'Fewer Stages' : 'All Stages'}
          </button>
          <button onClick={loadData} className="p-2 rounded-xl border-2 border-erp-border text-erp-text/50 hover:text-erp-primary hover:border-erp-primary transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {(user?.role === 'Manager' || user?.role === 'CEO') && (
            <>
              <a href="/sample-leads.csv" download className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-erp-surface border-2 border-erp-border text-erp-text rounded-xl hover:bg-erp-background transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV
              </a>
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvUpload} />
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingCsv} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-2 border-erp-border rounded-xl text-erp-text/70 hover:border-erp-primary transition-colors disabled:opacity-50">
                <Upload className="w-3.5 h-3.5" /> {isUploadingCsv ? 'Uploading…' : 'Upload CSV'}
              </button>
            </>
          )}
          <Button onClick={() => navigate('/sales/leads/new')} className="flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* ── Mobile Header ──────────────────────────────────────────────────── */}
      <div className="md:hidden flex-shrink-0 bg-erp-surface border-b border-erp-border">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <div>
            <h1 className="text-lg font-display font-black text-erp-text leading-tight">CRM Pipeline</h1>
            <p className="text-[10px] text-erp-text/40 font-medium">{filteredLeads.length} of {leads.length} leads</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(s => !s)} className="w-9 h-9 rounded-xl border-2 border-erp-border flex items-center justify-center text-erp-text/60">
              <Search className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/sales/leads/new')} className="h-9 px-3 rounded-xl bg-erp-primary text-white font-bold text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        {/* Mobile search (expandable) */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-erp-text/40" />
              <input
                autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name, phone, course…"
                className="w-full bg-erp-background border-2 border-erp-border rounded-xl pl-9 pr-9 py-2 text-sm font-medium focus:outline-none focus:border-erp-primary text-erp-text placeholder:text-erp-text/30"
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5"><X className="w-4 h-4 text-erp-text/30" /></button>}
            </div>
          </div>
        )}

        {/* Mobile All/Mine toggle */}
        <div className="flex px-4 pb-2 gap-2">
          <button onClick={() => setViewMode('All')} className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${viewMode === 'All' ? 'bg-erp-primary text-white border-erp-primary' : 'border-erp-border text-erp-text/60'}`}>All</button>
          <button onClick={() => setViewMode('Mine')} className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${viewMode === 'Mine' ? 'bg-erp-primary text-white border-erp-primary' : 'border-erp-border text-erp-text/60'}`}>Mine</button>
        </div>

        {/* Stage tabs — horizontal scrollable */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {visibleStages.map((stage, idx) => {
            const count = leadsByStage(stage.id).length;
            const active = idx === mobileStageIdx;
            return (
              <button
                key={stage.id}
                onClick={() => setMobileStageIdx(idx)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
                style={{
                  borderColor: active ? stage.color : 'var(--erp-border)',
                  background: active ? stage.color : 'transparent',
                  color: active ? '#fff' : 'var(--erp-text)',
                  opacity: active ? 1 : 0.7,
                }}
              >
                {stage.label}
                {count > 0 && (
                  <span className="ml-0.5 min-w-[16px] text-center" style={{ opacity: active ? 0.85 : 0.6 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Filters (desktop only) */}
      {showAdvancedFilters && (
        <div className="hidden md:flex px-5 py-3 border-b-2 border-erp-border bg-erp-surface gap-3 items-center flex-wrap">
          <input type="text" placeholder="Grad Year" value={filterYear} onChange={e => setFilterYear(e.target.value)} className="border-2 border-erp-border rounded-xl px-3 py-1.5 text-sm font-bold w-32 focus:outline-none focus:border-erp-primary bg-erp-background text-erp-text" />
          <input type="text" placeholder="Degree/Qual" value={filterQual} onChange={e => setFilterQual(e.target.value)} className="border-2 border-erp-border rounded-xl px-3 py-1.5 text-sm font-bold w-36 focus:outline-none focus:border-erp-primary bg-erp-background text-erp-text" />
          <input type="text" placeholder="Course Interest" value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="border-2 border-erp-border rounded-xl px-3 py-1.5 text-sm font-bold w-36 focus:outline-none focus:border-erp-primary bg-erp-background text-erp-text" />
          <select value={filterIt} onChange={e => setFilterIt(e.target.value)} className="border-2 border-erp-border rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-erp-primary bg-erp-background text-erp-text">
            <option value="">Any Background</option>
            <option value="IT">IT</option>
            <option value="Non-IT">Non-IT</option>
          </select>
          {(filterYear || filterQual || filterCourse || filterIt) && (
            <button onClick={() => { setFilterYear(''); setFilterQual(''); setFilterCourse(''); setFilterIt(''); }} className="text-xs font-bold text-erp-primary hover:underline">Clear Filters</button>
          )}
        </div>
      )}

      {/* Hidden stages badges (desktop) */}
      {!showAllStages && hiddenStages.size > 0 && (
        <div className="hidden md:flex items-center gap-2 px-5 pt-3 flex-wrap flex-shrink-0">
          <span className="text-xs font-bold text-erp-text/40">Hidden:</span>
          {Array.from(hiddenStages).map(s => {
            const stage = PIPELINE_STAGES.find(p => p.id === s);
            const count = totalByStage(s);
            return stage ? (
              <button key={s} onClick={() => setHiddenStages(prev => { const n = new Set(prev); n.delete(s); return n; })}
                className="text-xs font-bold px-2 py-1 rounded-full border-2 hover:border-erp-primary transition-colors"
                style={{ borderColor: stage.color + '44', color: stage.color, background: stage.bg }}>
                {stage.label} {count > 0 && `(${count})`} ×
              </button>
            ) : null;
          })}
        </div>
      )}

      {/* Error Banner */}
      {moveError && (
        <div className="mx-4 mt-2 p-3 bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-sm font-bold text-red-700 dark:text-red-400 flex-shrink-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{moveError}</span>
          <button onClick={() => setMoveError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Mobile: Vertical card list for selected stage ─────────────────── */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {mobileStage && (
          <div className="p-4 space-y-3">
            {leadsByStage(mobileStage.id).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-erp-text/30">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: mobileStage.color + '20' }}>
                  <span style={{ color: mobileStage.color }}>{mobileStage.icon}</span>
                </div>
                <p className="font-bold text-sm">No leads in {mobileStage.label}</p>
              </div>
            ) : (
              leadsByStage(mobileStage.id).map(lead => (
                <MobileLeadCard key={lead.id} lead={lead} stage={mobileStage} onClick={() => handleCardClick(lead)} />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Desktop: Horizontal Kanban ─────────────────────────────────────── */}
      <div className="hidden md:block flex-1 overflow-x-auto overflow-y-hidden">
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 p-4 h-full items-start min-w-max">
            {visibleStages.map(stage => {
              const stageLeads = leadsByStage(stage.id);
              return (
                <div
                  key={stage.id}
                  className="flex-shrink-0 w-[255px] flex flex-col rounded-2xl overflow-hidden"
                  style={{ background: stage.bg, border: `1.5px solid ${stage.color}33`, maxHeight: 'calc(100vh - 200px)' }}
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0" style={{ borderColor: `${stage.color}33` }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span style={{ color: stage.color }}>{stage.icon}</span>
                      <h3 className="font-bold text-[11px] uppercase tracking-wide truncate" style={{ color: stage.color }}>{stage.label}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: stage.color }}>{stageLeads.length}</span>
                      {!showAllStages && (
                        <button onClick={() => setHiddenStages(prev => { const n = new Set(prev); n.add(stage.id); return n; })} className="opacity-30 hover:opacity-70 transition-opacity">
                          <X className="w-3 h-3" style={{ color: stage.color }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cards */}
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 overflow-y-auto flex flex-col gap-2 p-2 min-h-[100px] transition-colors duration-150"
                        style={{ background: snapshot.isDraggingOver ? `${stage.color}18` : 'transparent' }}
                      >
                        {stageLeads.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-xl" style={{ borderColor: `${stage.color}44` }}>
                            <p className="text-xs font-medium text-erp-text/30">No leads</p>
                          </div>
                        )}
                        {stageLeads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => handleCardClick(lead)}
                                className="bg-erp-surface rounded-xl p-3 cursor-pointer group select-none flex flex-col gap-1.5"
                                style={{
                                  ...provided.draggableProps.style,
                                  boxShadow: snapshot.isDragging ? '0 16px 32px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
                                  borderLeft: `3px solid ${stage.color}`,
                                  outline: selectedLeadId === lead.id ? `2px solid ${stage.color}` : 'none',
                                  transform: snapshot.isDragging
                                    ? `${provided.draggableProps.style?.transform} rotate(2deg) scale(1.02)`
                                    : provided.draggableProps.style?.transform,
                                }}
                              >
                                <p className="font-bold text-[13px] text-erp-text truncate">{lead.name}</p>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {lead.course_interest && (
                                    <span className="text-[10px] font-semibold text-erp-primary bg-erp-primary/10 px-1.5 py-0.5 rounded-full">{lead.course_interest}</span>
                                  )}
                                  {lead.source && (
                                    <span className="text-[10px] font-semibold text-erp-text/70 bg-erp-border/60 px-1.5 py-0.5 rounded-full">{lead.source}</span>
                                  )}
                                </div>
                                {(lead.qualification || lead.grad_year) && (
                                  <p className="text-[10px] font-medium text-erp-text/50 truncate mt-0.5">
                                    {[lead.qualification, lead.grad_year].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[11px] text-erp-text/50 font-medium truncate flex-1">{lead.phone || '—'}</span>
                                  {lead.assignee_name && (
                                    <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded ml-1 truncate">
                                      {lead.assignee_name.split(' ')[0]}
                                    </span>
                                  )}
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0">
                                    <button onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${lead.phone?.replace(/\D/g, '')}`, '_blank'); }}
                                      className="w-6 h-6 rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center transition-colors">
                                      <MessageCircle className="w-3 h-3" />
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); window.open(`tel:${lead.phone}`, '_self'); }}
                                      className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center transition-colors">
                                      <Phone className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Onboarding Modal */}
      {onboardingLead && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center px-5 py-4 border-b border-erp-border">
              <h2 className="text-lg font-bold text-erp-text flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-500" /> Onboard Student
              </h2>
              <button onClick={() => setOnboardingLead(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-erp-text/50 hover:text-erp-text hover:bg-erp-border/40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleOnboardSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-sm text-erp-text/70 mb-4">Complete details for <strong className="text-erp-text">{onboardingLead.name}</strong> to send for Manager approval.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Name</label>
                  <input type="text" required value={onboardForm.name} onChange={e => setOnboardForm({...onboardForm, name: e.target.value})} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Email</label>
                  <input type="email" required value={onboardForm.email} onChange={e => setOnboardForm({...onboardForm, email: e.target.value})} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Mobile No.</label>
                  <input type="tel" required value={onboardForm.phone} onChange={e => setOnboardForm({...onboardForm, phone: e.target.value})} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Course</label>
                  <input 
                    list="onboard-course-options"
                    type="text" 
                    required 
                    value={onboardForm.course} 
                    onChange={e => setOnboardForm({...onboardForm, course: e.target.value})} 
                    className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm" 
                    placeholder="Select or type course" 
                  />
                  <datalist id="onboard-course-options">
                    {courses.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Total Fees</label>
                  <input type="number" required value={onboardForm.fees_total} onChange={e => setOnboardForm({...onboardForm, fees_total: e.target.value})} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Paid Fee</label>
                  <input type="number" required value={onboardForm.fees_paid} onChange={e => {
                    const paid = Number(e.target.value);
                    const total = Number(onboardForm.fees_total);
                    setOnboardForm({...onboardForm, fees_paid: e.target.value, fees_pending: String(total - paid)});
                  }} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Pending Fee</label>
                  <input type="number" value={onboardForm.fees_pending} readOnly className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text/50 text-sm cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Date of Joining</label>
                  <input type="date" required value={onboardForm.joining_date} onChange={e => setOnboardForm({...onboardForm, joining_date: e.target.value})} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Training Start Date</label>
                  <input type="date" required value={onboardForm.training_start_date} onChange={e => setOnboardForm({...onboardForm, training_start_date: e.target.value})} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Date of Birth</label>
                  <input type="date" required value={onboardForm.dob} onChange={e => setOnboardForm({...onboardForm, dob: e.target.value})} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Gender</label>
                  <select value={onboardForm.gender} onChange={e => setOnboardForm({...onboardForm, gender: e.target.value})} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm">
                    <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-erp-text/60 mb-1.5">Documents Submitted?</label>
                  <select value={onboardForm.documents_submitted} onChange={e => setOnboardForm({...onboardForm, documents_submitted: Number(e.target.value)})} className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-3 py-2 text-erp-text focus:outline-none focus:border-erp-primary text-sm">
                    <option value={1}>Yes (Y)</option><option value={0}>No (N)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-erp-border mt-4">
                <button type="button" onClick={() => setOnboardingLead(null)} className="px-4 py-2 rounded-xl border-2 border-erp-border text-erp-text/70 font-bold text-sm hover:bg-erp-border/40 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-500 transition-colors">Submit to Manager</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Detail Panel */}
      {selectedLeadId && (
        <div className="fixed inset-0 z-30 bg-erp-background md:inset-auto md:absolute md:right-0 md:top-0 md:h-full md:w-[480px] shadow-[-10px_0_40px_rgba(0,0,0,0.12)] border-l-2 border-erp-border">
          <LeadDetailPanel 
            leadId={selectedLeadId} 
            onClose={() => setSelectedLeadId(null)} 
            onUpdate={loadData} 
            onRequestOnboard={(l) => {
              setSelectedLeadId(null);
              setOnboardingLead(l);
              setOnboardForm({
                name: l.name || '', email: l.email || '', phone: l.phone || '',
                fees_total: '', fees_paid: '', fees_pending: '',
                joining_date: new Date().toISOString().split('T')[0], training_start_date: '',
                course: l.course_interest || '', documents_submitted: 0, gender: 'Male', dob: ''
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
