import React, { useState } from 'react';
import { BottomSheet } from '../../../components/ui/erp/BottomSheet';
import { Button } from '../../../components/ui/erp/Button';
import { SearchableDropdown } from '../../../components/ui/erp/SearchableDropdown';
import { recordSale, getAdmissionForLead, getCoursesForPitch, validateSaleAmounts } from '../../../lib/api/sales';
import { getCurrentUser } from '../../../lib/auth';
import { notify } from '../../../lib/feedback';

type SaleFormProps = {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  onSuccess: () => void;
};

export const SaleForm: React.FC<SaleFormProps> = ({ isOpen, onClose, leadId, onSuccess }) => {
  const [course, setCourse] = useState('');
  const [totalFee, setTotalFee] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [activeAdmission, setActiveAdmission] = useState<any>(null);
  const [courseOptions, setCourseOptions] = useState<{ value: string; label: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  
  const user = getCurrentUser();

  React.useEffect(() => {
    if (isOpen) {
      getCoursesForPitch().then((rows: any[]) =>
        setCourseOptions((rows || []).map(c => ({ value: String(c.id), label: String(c.title || c.id) })))
      );
      getAdmissionForLead(leadId).then(adm => {
        if (adm) {
          setActiveAdmission(adm);
          if (adm.discount_locked) {
            // we could theoretically parse this and deduct from totalFee but for now just showing it is good
          }
        }
      });
    }
  }, [isOpen, leadId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return notify("Must be logged in to record a sale");
    if (submitting) return;
    if (!course) { setFormError('Please select a course.'); return; }
    const amountError = validateSaleAmounts(Number(totalFee), Number(amountPaid));
    if (amountError) { setFormError(amountError); return; }
    setFormError('');
    setSubmitting(true);
    try {
      const saleId = await recordSale(leadId, course, Number(totalFee), Number(amountPaid), activeAdmission?.id || null, user.id, referredBy || null, paymentMode);
      if (!saleId) {
        setFormError('The sale could not be saved. Please try again.');
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const paidPct = totalFee && amountPaid ? Math.min(100, (Number(amountPaid) / Number(totalFee)) * 100) : 0;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Record Sale">
      <div className="bg-erp-primary/10 p-3 rounded-xl border border-erp-primary mb-4">
        <p className="text-[10px] font-bold text-erp-primary text-center">
          ⚠ AFTER RECEIVING PAYMENT, DO NOT PROMISE BATCH DATES. BATCH ALLOCATION HAPPENS ONLY AFTER MANAGER APPROVAL.
        </p>
      </div>

      {activeAdmission && (
        <div className="bg-green-50 p-3 rounded-xl border border-green-200 mb-4">
          <p className="text-xs font-bold text-green-700 dark:text-white">✓ Active Admission Found!</p>
          <p className="text-xs text-green-600">Locked Discount: {activeAdmission.discount_locked}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Select Course</label>
          <SearchableDropdown 
            options={courseOptions}
            value={course} onChange={setCourse} placeholder="Course"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Total Fee (₹)</label>
            <input required type="number" className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={totalFee} onChange={e => setTotalFee(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Amount Paid (₹)</label>
            <input required type="number" className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Payment Mode</label>
          <select required className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            <option value="">Select Mode</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
            <option value="Credit Card">Credit Card</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Referred By (Student ID / Optional)</label>
          <input placeholder="e.g. stu_demo_1" className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={referredBy} onChange={e => setReferredBy(e.target.value)} />
        </div>

        {totalFee && amountPaid && (
          <div className="mt-2">
            <div className="flex justify-between text-xs font-bold mb-1">
              <span>Payment Progress</span>
              <span className={paidPct >= 100 ? 'text-erp-primary' : 'text-sky-700 dark:text-erp-secondary'}>{paidPct.toFixed(0)}%</span>
            </div>
            <div className="w-full h-3 bg-erp-border rounded-full overflow-hidden">
              <div 
                className={`h-full ${paidPct >= 100 ? 'bg-erp-primary' : 'bg-erp-secondary'} transition-all`} 
                style={{ width: `${paidPct}%` }}
              ></div>
            </div>
          </div>
        )}

        {formError && <p className="text-red-700 dark:text-red-500 text-xs font-bold">{formError}</p>}
        <Button type="submit" variant="primary" fullWidth className="mt-4" disabled={submitting}>{submitting ? 'Saving…' : 'Submit Payment & Request Approval'}</Button>
      </form>
    </BottomSheet>
  );
};
