import React, { useEffect, useState } from 'react';
import { toWhatsAppNumber } from '../../lib/phoneUtils';
import { useParams, useNavigate } from 'react-router-dom';
import { client, isTursoConfigured } from '../../lib/turso';
import { updateLeadStatus, getLeadById } from '../../lib/api/crm';
import { Lead, LeadStatus } from '../../lib/types';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { ArrowLeft, Phone, Calendar, MessageCircle, RefreshCw } from 'lucide-react';
import { AdmissionForm } from './forms/AdmissionForm';
import { SaleForm } from './forms/SaleForm';
import { SalesPitchModal } from './forms/SalesPitchModal';
import { getCurrentUser } from '../../lib/auth';
import { notify } from '../../lib/feedback';

const STATUS_BUCKETS: LeadStatus[] = [
  'New',
  'Contacted',
  'Demo Scheduled',
  'Demo Completed',
  'Admission',
  'Closed Won',
  'Closed Lost'
];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [lead, setLead] = useState<Lead | null>(null);
  const [showAdmission, setShowAdmission] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [showPitch, setShowPitch] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchLead = async () => {
    if (id) {
      const result = await getLeadById(id);
      setLead(result);
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id]);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as LeadStatus;
    setIsUpdatingStatus(true);
    
    const result = await updateLeadStatus(id as string, newStatus, user?.id || 'unknown');
    if (!result.success) {
      notify(result.error || "Failed to update lead status");
    }
    
    await fetchLead();
    setIsUpdatingStatus(false);
  };

  const handleWhatsApp = () => {
    if (lead) {
      const msg = encodeURIComponent(`Hi ${lead.name}, welcome to CynexAI! I'm reaching out regarding your interest in our ${lead.course_interest} course.`);
      // Strip non-numeric from phone
      const phone = toWhatsAppNumber(lead.phone);
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    }
  };

  if (!lead) return <div className="p-10 text-center font-bold text-erp-text">Loading...</div>;

  return (
    <div className="p-4 pt-8 min-h-screen bg-erp-background pb-32">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/crm/leads')} className="w-12 h-12 p-0 rounded-full flex items-center justify-center">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-2xl font-display font-bold text-erp-text">Lead Profile</h1>
      </div>

      <Card className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1 text-erp-text">{lead.name}</h2>
            <div className="flex items-center text-erp-text/70 font-bold">
              <Phone className="w-4 h-4 mr-2" />
              {lead.phone}
            </div>
          </div>
          <div className="inline-block bg-erp-secondary/10 text-sky-700 dark:text-erp-secondary font-bold px-3 py-1 rounded-xl text-sm text-right">
            {lead.course_interest}
          </div>
        </div>

        <div className="mt-4 p-4 bg-erp-background rounded-2xl border-2 border-erp-border">
          <label className="block text-sm font-bold text-erp-text/70 mb-2">Current Status (Bucket)</label>
          <div className="flex items-center gap-2">
            <select 
              value={lead.status} 
              onChange={handleStatusChange}
              disabled={isUpdatingStatus}
              className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold text-erp-text focus:outline-none focus:border-erp-primary"
            >
              {/* Legacy support if they are in Bucket A,B,C etc */}
              {!STATUS_BUCKETS.includes(lead.status) && (
                 <option value={lead.status}>Legacy: Bucket {lead.status}</option>
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

      <h3 className="text-sm font-bold text-erp-text/50 uppercase mb-3 px-2">Actions</h3>
      <div className="flex flex-col gap-4">
        <Button variant="info" onClick={() => setShowPitch(true)} fullWidth>Sales Pitch Assistant</Button>
        <Button variant="secondary" onClick={() => setShowAdmission(true)} fullWidth>Record Admission</Button>
        <Button variant="primary" onClick={() => setShowSale(true)} fullWidth>Record Sale</Button>
      </div>
      
      <SalesPitchModal isOpen={showPitch} onClose={() => setShowPitch(false)} courseInterest={lead.course_interest} />
      <AdmissionForm isOpen={showAdmission} onClose={() => setShowAdmission(false)} leadId={id as string} onSuccess={() => navigate('/crm/leads')} />
      <SaleForm isOpen={showSale} onClose={() => setShowSale(false)} leadId={id as string} onSuccess={() => navigate('/crm/leads')} />
    </div>
  );
}
