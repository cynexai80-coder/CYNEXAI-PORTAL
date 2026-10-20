import React, { useEffect, useState } from 'react';
import { toWhatsAppNumber } from '../../lib/phoneUtils';
import { updateLeadStatus, getLeadById, getLeadActivities, addActivity, deleteLead } from '../../lib/api/crm';
import { Lead, CrmActivity } from '../../lib/types';
import { Card } from '../ui/erp/Card';
import { Button } from '../ui/erp/Button';
import { X, Phone, MessageCircle, RefreshCw, Activity, Mail, Users, PenTool, Send, Trash2 } from 'lucide-react';
import { AdmissionForm } from '../../pages/crm/forms/AdmissionForm';
import { SaleForm } from '../../pages/crm/forms/SaleForm';
import { SalesPitchModal } from '../../pages/crm/forms/SalesPitchModal';
import { getSaleForLead } from '../../lib/api/sales';
import { getCurrentUser } from '../../lib/auth';
import { ActivityLog } from './ActivityLog';
import { notify, confirmDialog, promptDialog } from '../../lib/feedback';

const STATUS_BUCKETS = [
  'New',
  'Not answering',
  'Busy',
  'Invalid number',
  'Interested',
  'Not Interested',
  'Demo Scheduled',
  'Demo Completed',
  'Admission Completed',
  'Sale Partial Closed',
  'Onboarded'
];

interface LeadDetailPanelProps {
  leadId: string;
  onClose: () => void;
  onUpdate: () => void;
  onRequestOnboard?: (lead: Lead) => void;
}

export function LeadDetailPanel({ leadId, onClose, onUpdate, onRequestOnboard }: LeadDetailPanelProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [sale, setSale] = useState<any | null>(null);
  const [showAdmission, setShowAdmission] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [showPitch, setShowPitch] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const user = getCurrentUser();

  const fetchLeadData = async () => {
    const result = await getLeadById(leadId);
    setLead(result);
    if (result) {
      const saleResult = await getSaleForLead(result.id);
      setSale(saleResult);
    }
  };

  useEffect(() => {
    fetchLeadData();
  }, [leadId]);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    
    if (newStatus === 'Onboarded') {
      if (onRequestOnboard && lead) {
        onRequestOnboard(lead);
      } else {
        notify('Onboarding not available from this context.');
      }
      return;
    }

    setIsUpdatingStatus(true);
    
    let partialAmount = '';
    if (newStatus === 'Sale Partial Closed') {
      const amount = await promptDialog({ title: 'Partial payment', message: 'How much was paid for the partial close?', inputType: 'number', placeholder: 'Amount in ₹', confirmLabel: 'Save', validate: v => (v.trim() === '' || Number(v) > 0 ? null : 'Enter an amount greater than zero.') });
      if (amount) partialAmount = amount;
    }

    const res = await updateLeadStatus(leadId, newStatus as any, user?.id || '');
    if (!res.success) {
      notify(res.error || 'Failed to update status');
    } else if (user) {
      let note = `Status changed to: ${newStatus}`;
      if (partialAmount) note += ` (Amount: ${partialAmount})`;
      await addActivity(leadId, user.id, 'Note', note);
    }
    
    await fetchLeadData();
    setIsUpdatingStatus(false);
    onUpdate(); // refresh table
  };

  const handleSaveDetails = async () => {
    if (!lead) return;
    const { updateLeadDetails } = await import('../../lib/api/crm');
    
    // Track what changed for the activity log
    const changes: string[] = [];
    (Object.keys(editForm) as Array<keyof Lead>).forEach(key => {
      if (editForm[key] !== lead[key] && editForm[key] !== undefined) {
        changes.push(`${key}: '${lead[key] || 'empty'}' ➔ '${editForm[key]}'`);
      }
    });

    const res = await updateLeadDetails(lead.id, editForm);
    if (res.success) {
      if (changes.length > 0 && user) {
        const note = `Updated details:\n- ${changes.join('\n- ')}`;
        await addActivity(lead.id, user.id, 'Note', note);
      }
      await fetchLeadData();
      setIsEditing(false);
      onUpdate();
    } else {
      notify(res.error || 'Failed to update lead');
    }
  };

  const handleDeleteLead = async () => {
    if (!lead) return;
    const confirmDelete = await confirmDialog({ title: 'Delete lead', message: `Are you sure you want to permanently delete lead: ${lead.name}?`, confirmLabel: 'Delete', danger: true });
    if (!confirmDelete) return;

    const res = await deleteLead(lead.id);
    if (res.success) {
      onClose();
      onUpdate();
    } else {
      notify(res.error || 'Failed to delete lead');
    }
  };

  const handleWhatsApp = () => {
    if (lead) {
      const msg = encodeURIComponent(`Hi ${lead.name}, welcome to CynexAI! I'm reaching out regarding your interest in our ${lead.course_interest} course.`);
      const phone = toWhatsAppNumber(lead.phone);
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    }
  };

  if (!lead) return <div className="p-10 text-center font-bold text-erp-text">Loading...</div>;

  return (
    <div className="h-full flex flex-col bg-erp-background border-l-2 border-erp-border">
      <div className="flex items-center justify-between p-4 border-b-2 border-erp-border bg-erp-surface">
        <h2 className="text-xl font-display font-bold text-erp-text">Lead Details</h2>
        <Button variant="ghost" onClick={onClose} className="p-2 h-auto rounded-full">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <Card className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              {isEditing ? (
                <div className="flex flex-col gap-2 mb-2">
                  <input className="text-xl font-bold p-2 border-2 rounded-xl" value={editForm.name ?? lead.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                  <input className="text-sm p-2 border-2 rounded-xl" value={editForm.phone ?? lead.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-1 text-erp-text">{lead.name}</h2>
                  <div className="flex items-center text-erp-text/70 font-bold">
                    <Phone className="w-4 h-4 mr-2" />
                    {lead.phone}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button variant="primary" onClick={handleSaveDetails}>Save</Button>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => { setEditForm({}); setIsEditing(true); }} className="text-xs px-3">Edit Details</Button>
              )}
              <div className="inline-block bg-erp-secondary/10 text-sky-700 dark:text-erp-secondary font-bold px-3 py-1 rounded-xl text-sm text-right h-fit">
                {lead.course_interest}
              </div>
              {(user?.role === 'CEO' || user?.role === 'Manager') && !isEditing && (
                <Button variant="ghost" onClick={handleDeleteLead} className="text-xs px-3 text-red-700 hover:text-red-800 dark:text-white hover:bg-red-50 mt-1">
                  <Trash2 className="w-3.5 h-3.5 mr-1 inline" /> Delete
                </Button>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="grid grid-cols-2 gap-4 mt-4 bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-gray-200 dark:border-white/10">
              <div><label className="text-xs font-bold">Email</label><input className="w-full p-2 border rounded-md" value={editForm.email ?? lead.email ?? ''} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
              <div><label className="text-xs font-bold">Course</label><input className="w-full p-2 border rounded-md" value={editForm.course_interest ?? lead.course_interest} onChange={e => setEditForm({...editForm, course_interest: e.target.value})} /></div>
              <div><label className="text-xs font-bold">Grad Year</label><input className="w-full p-2 border rounded-md" value={editForm.grad_year ?? lead.grad_year ?? ''} onChange={e => setEditForm({...editForm, grad_year: e.target.value})} /></div>
              <div><label className="text-xs font-bold">Qual</label><input className="w-full p-2 border rounded-md" value={editForm.qualification ?? lead.qualification ?? ''} onChange={e => setEditForm({...editForm, qualification: e.target.value})} /></div>
              <div><label className="text-xs font-bold">IT/Non-IT</label><input className="w-full p-2 border rounded-md" value={editForm.it_background ?? lead.it_background ?? ''} onChange={e => setEditForm({...editForm, it_background: e.target.value})} /></div>
              <div><label className="text-xs font-bold">Mode</label><input className="w-full p-2 border rounded-md" value={editForm.preferred_mode ?? lead.preferred_mode ?? ''} onChange={e => setEditForm({...editForm, preferred_mode: e.target.value})} /></div>
              <div><label className="text-xs font-bold">Location</label><input className="w-full p-2 border rounded-md" value={editForm.location ?? lead.location ?? ''} onChange={e => setEditForm({...editForm, location: e.target.value})} /></div>
            </div>
          )}

          {!isEditing && (
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm font-medium text-gray-600">
              {lead.email && <div><span className="text-gray-600 dark:text-gray-400 font-bold">Email:</span> {lead.email}</div>}
              {lead.grad_year && <div><span className="text-gray-600 dark:text-gray-400 font-bold">Grad:</span> {lead.grad_year}</div>}
              {lead.qualification && <div><span className="text-gray-600 dark:text-gray-400 font-bold">Qual:</span> {lead.qualification}</div>}
              {lead.it_background && <div><span className="text-gray-600 dark:text-gray-400 font-bold">IT Background:</span> {lead.it_background}</div>}
              {lead.preferred_mode && <div><span className="text-gray-600 dark:text-gray-400 font-bold">Mode:</span> {lead.preferred_mode}</div>}
              {lead.location && <div><span className="text-gray-600 dark:text-gray-400 font-bold">Location:</span> {lead.location}</div>}
            </div>
          )}
          
          <div className="mb-4">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Added By</span>
            <p className="text-sm font-bold text-erp-text">{lead.assigned_to || 'Unknown Agent'}</p>
          </div>
          
          {sale && (
            <div className="mb-4 bg-green-50 rounded-xl p-4 border border-green-200">
              <h3 className="text-sm font-bold text-green-900 dark:text-white mb-2 uppercase tracking-wider">Financials</h3>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-green-800 dark:text-white">Total Fee</span>
                <span className="font-bold text-green-900 dark:text-white">₹{sale.total_fee}</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-green-800 dark:text-white">Amount Paid</span>
                <span className="font-bold text-green-900 dark:text-white">₹{sale.amount_paid}</span>
              </div>
              <div className="flex justify-between items-center border-t border-green-200 pt-1 mt-1">
                <span className="text-sm font-bold text-green-800 dark:text-white">Amount Due</span>
                <span className="font-bold text-red-600">₹{Math.max(0, sale.total_fee - sale.amount_paid)}</span>
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-erp-background rounded-2xl border-2 border-erp-border">
            <label className="block text-sm font-bold text-erp-text/70 mb-2">Current Status (Stage)</label>
            <div className="flex items-center gap-2">
              <select 
                value={lead.status} 
                onChange={handleStatusChange}
                disabled={isUpdatingStatus}
                className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold text-erp-text focus:outline-none focus:border-erp-primary"
              >
                {!STATUS_BUCKETS.includes(lead.status) && (
                   <option value={lead.status}>Legacy: {lead.status}</option>
                )}
                {STATUS_BUCKETS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              {isUpdatingStatus && <RefreshCw className="w-5 h-5 text-erp-primary animate-spin" />}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Button 
            variant="info" 
            onClick={handleWhatsApp}
            className="flex flex-col items-center gap-2 py-4"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs">WhatsApp</span>
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => window.open(`tel:${lead.phone}`)}
            className="flex flex-col items-center gap-2 py-4 border-2 border-erp-border bg-erp-surface"
          >
            <Phone className="w-6 h-6" />
            <span className="text-xs">Call</span>
          </Button>
        </div>

        {/* Activity Timeline */}
        <ActivityLog key={`${leadId}-${lead.status}`} entityType="lead" entityId={leadId} />

        <h3 className="text-sm font-bold text-erp-text/50 uppercase mb-3 px-2">Actions</h3>
        <div className="flex flex-col gap-4">
          <Button variant="info" onClick={() => setShowPitch(true)} fullWidth>Sales Pitch Assistant</Button>
          <Button variant="secondary" onClick={() => setShowAdmission(true)} fullWidth>Record Admission</Button>
          <Button variant="primary" onClick={() => setShowSale(true)} fullWidth>Record Sale</Button>
          
          {sale && (lead.status === 'Admission' || lead.status === 'Closed Won') && (
            <Button variant="info" onClick={() => window.open(`/sales/onboarding/${sale.id}`, '_self')} fullWidth className="bg-indigo-600 hover:bg-indigo-700">
              Start Onboarding
            </Button>
          )}
        </div>
      </div>

      <SalesPitchModal isOpen={showPitch} onClose={() => setShowPitch(false)} courseInterest={lead.course_interest} />
      <AdmissionForm isOpen={showAdmission} onClose={() => setShowAdmission(false)} leadId={leadId} onSuccess={() => { setShowAdmission(false); onUpdate(); }} />
      <SaleForm isOpen={showSale} onClose={() => setShowSale(false)} leadId={leadId} onSuccess={() => { setShowSale(false); onUpdate(); }} />
    </div>
  );
}
