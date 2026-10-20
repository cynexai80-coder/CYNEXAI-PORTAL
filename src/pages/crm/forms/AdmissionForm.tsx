import React, { useState } from 'react';
import { BottomSheet } from '../../../components/ui/erp/BottomSheet';
import { Button } from '../../../components/ui/erp/Button';
import { recordAdmission } from '../../../lib/api/sales';

type AdmissionFormProps = {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  onSuccess: () => void;
};

export const AdmissionForm: React.FC<AdmissionFormProps> = ({ isOpen, onClose, leadId, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [expiry, setExpiry] = useState('');
  const [expectedSale, setExpectedSale] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!(Number(amount) > 0)) { setFormError('Reservation fee must be greater than 0.'); return; }
    if (expiry && expectedSale && expectedSale > expiry) { setFormError('Expected sale date cannot be after the offer expiry.'); return; }
    setFormError('');
    setSubmitting(true);
    try {
      const id = await recordAdmission(leadId, Number(amount), discount, expiry, expectedSale, referredBy || null);
      if (!id) { setFormError('The admission could not be saved. Please try again.'); return; }
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Record Admission">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Reservation Fee (₹)</label>
          <input required type="number" className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Discount Locked</label>
          <input required placeholder="e.g. 10% or ₹5000" className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={discount} onChange={e => setDiscount(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Offer Expiry</label>
            <input required type="date" className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={expiry} onChange={e => setExpiry(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Expected Sale</label>
            <input required type="date" className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={expectedSale} onChange={e => setExpectedSale(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Referred By (Student ID / Optional)</label>
          <input placeholder="e.g. stu_demo_1" className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={referredBy} onChange={e => setReferredBy(e.target.value)} />
        </div>
        <div className="bg-erp-secondary/10 p-3 rounded-xl border border-erp-secondary mt-2">
          <p className="text-xs font-bold text-sky-700 dark:text-erp-secondary">Note: Admission does not create a student account. It only reserves a seat and locks the discount.</p>
        </div>
        {formError && <p className="text-red-700 dark:text-red-500 text-xs font-bold">{formError}</p>}
        <Button type="submit" variant="secondary" fullWidth className="mt-2" disabled={submitting}>{submitting ? 'Saving…' : 'Confirm Admission'}</Button>
      </form>
    </BottomSheet>
  );
};
