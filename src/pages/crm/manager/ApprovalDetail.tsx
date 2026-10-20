import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { client, isTursoConfigured } from '../../../lib/turso';
import { approveSale, rejectSale, getApprovalDetails } from '../../../lib/api/manager';
import { getCurrentUser } from '../../../lib/auth';
import { Card } from '../../../components/ui/erp/Card';
import { Button } from '../../../components/ui/erp/Button';
import { ArrowLeft } from 'lucide-react';
import { LoadingNotice, UnavailableNotice } from '../../../components/ui/erp/LoadState';
import { notify } from '../../../lib/feedback';

export default function ApprovalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState<any>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [checks, setChecks] = useState({
    payment_verified: false,
    course_confirmed: false,
    batch_available: false,
    docs_received: false,
    teacher_assignable: false,
    joining_date_feasible: false
  });
  const [rejectNotes, setRejectNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchAppr = async () => {
      setLoadFailed(false);
      try {
        const details = isTursoConfigured && client ? await getApprovalDetails(id as string) : null;
        if (cancelled) return;
        if (!details) { setLoadFailed(true); return; }
        setSale(details);
        try {
          setChecks(prev => ({ ...prev, ...JSON.parse(details.checklist_json as string || '{}') }));
        } catch { /* corrupt checklist JSON: keep the default (all unchecked) */ }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    };
    fetchAppr();
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  const allChecked = Object.values(checks).every(v => v === true);

  const handleApprove = async () => {
    const user = getCurrentUser();
    if (!user) return;
    if (!allChecked) { notify('Please complete every item on the checklist before approving.'); return; }
    const result = await approveSale(id as string, user.id, sale.sale_id);
    if (!result) { notify('This approval could not be completed (it may already have been decided).'); return; }
    // Student is now onboarded, task is created, just return to manager dash
    navigate('/manager');
  };

  const handleReject = async () => {
    if (!rejectNotes) return notify("Must provide reject reason");
    const user = getCurrentUser();
    if (!user) return;
    await rejectSale(id as string, user.id, rejectNotes);
    navigate('/manager');
  };

  if (!sale) {
    return loadFailed ? (
      <UnavailableNotice
        title="Approval not found"
        message="This approval could not be loaded. The link may be wrong, it may already have been decided, or the connection failed."
        onRetry={() => setReloadKey(k => k + 1)}
        onBack={() => navigate('/manager')}
        backLabel="Back to Manager Hub"
      />
    ) : (
      <LoadingNotice />
    );
  }

  return (
    <div className="p-4 pt-8 min-h-screen bg-erp-background pb-32">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" aria-label="Back to Manager Hub" onClick={() => navigate('/manager')} className="w-12 h-12 p-0 rounded-full flex items-center justify-center">
          <ArrowLeft className="w-6 h-6" aria-hidden="true" />
        </Button>
        <h1 className="text-2xl font-display font-bold text-erp-text">Approval Gate</h1>
      </div>

      <Card className="mb-6 bg-erp-primary/10 border-erp-primary">
        <h2 className="text-2xl font-bold mb-1 text-erp-text">{sale.lead_name}</h2>
        <div className="flex justify-between items-center text-sm font-bold mt-4">
          <span className="text-erp-text/70 uppercase">Course</span>
          <span className="text-erp-text">{sale.course_id}</span>
        </div>
        <div className="flex justify-between items-center text-sm font-bold mt-2">
          <span className="text-erp-text/70 uppercase">Payment</span>
          <span className={sale.amount_paid >= sale.total_fee ? 'text-green-700 dark:text-green-500' : 'text-sky-700 dark:text-erp-secondary'}>
            ₹{sale.amount_paid} / ₹{sale.total_fee}
          </span>
        </div>
      </Card>

      <h3 className="text-sm font-bold text-erp-text/50 uppercase mb-3 px-2">Manager Checklist</h3>
      <Card className="mb-6 flex flex-col gap-4">
        {Object.entries(checks).map(([key, val]) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={val} onChange={() => setChecks({...checks, [key]: !val})} className="w-6 h-6 accent-erp-primary" />
            <span className="font-bold text-erp-text capitalize">{key.replace(/_/g, ' ')}</span>
          </label>
        ))}
      </Card>

      <div className="flex flex-col gap-4">
        <Button variant="primary" fullWidth onClick={handleApprove} className={!allChecked ? 'opacity-50' : ''}>
          Approve & Onboard
        </Button>
        
        <div className="mt-4">
          <textarea 
            placeholder="Reason for rejection..." 
            className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold mb-2 h-24 text-erp-text"
            value={rejectNotes} onChange={e => setRejectNotes(e.target.value)}
          />
          <Button variant="secondary" fullWidth onClick={handleReject}>Reject</Button>
        </div>
      </div>
    </div>
  );
}
