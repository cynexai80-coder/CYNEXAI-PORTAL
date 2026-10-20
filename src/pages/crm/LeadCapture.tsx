import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { SearchableDropdown } from '../../components/ui/erp/SearchableDropdown';
import { createLead, findDuplicateLead } from '../../lib/api/crm';
import { getCoursesForPitch } from '../../lib/api/sales';
import { getCurrentUser } from '../../lib/auth';
import { notify, confirmDialog } from '../../lib/feedback';

// Defined OUTSIDE the component to prevent focus loss on re-render
const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-bold text-erp-text/60 mb-1.5 uppercase tracking-wider">
      {label} {required ? <span className="text-red-700 dark:text-red-500">*</span> : <span className="text-erp-text/30 font-medium normal-case tracking-normal">(optional)</span>}
    </label>
    {children}
  </div>
);

export default function LeadCapture() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [qualification, setQualification] = useState('');
  const [itBackground, setItBackground] = useState('');
  const [mode, setMode] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState('Manual Entry');
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<{value: string, label: string}[]>([]);

  React.useEffect(() => {
    getCoursesForPitch().then(res => {
      setCourses(res.map(c => ({ value: c.title || '', label: c.title || '' })));
    });
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return notify('Name is required.');
    if (!phone.trim()) return notify('Phone number is required.');
    const phoneClean = phone.replace(/\D/g, '');
    if (phoneClean.length < 10) return notify('Phone number must be at least 10 digits.');

    setLoading(true);
    const dup = await findDuplicateLead(phone, email);
    if (dup && !(await confirmDialog({ title: 'Possible duplicate', message: `A lead with the same phone/email already exists (${dup.name}). Create another one anyway?`, confirmLabel: 'Create anyway' }))) {
      setLoading(false);
      return;
    }
    const createdId = await createLead({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim(),
      course_interest: course || '',
      grad_year: gradYear || undefined,
      qualification: qualification || undefined,
      it_background: itBackground || undefined,
      preferred_mode: mode || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      source: source || 'Manual Entry',
      status: 'New',
      assigned_to: '',
      created_by: user?.id,
    });
    setLoading(false);
    if (!createdId) {
      notify('The lead could not be saved. Please check your connection and try again.');
      return;
    }
    navigate('/sales/pipeline');
  };

  const qualOptions = [
    { value: 'B.Tech', label: 'B.Tech' },
    { value: 'Degree', label: 'Degree' },
    { value: 'BCA', label: 'BCA' },
    { value: 'MCA', label: 'MCA' },
    { value: 'B.Sc', label: 'B.Sc' },
    { value: 'M.Sc', label: 'M.Sc' },
    { value: 'MBA', label: 'MBA' },
    { value: 'BBA', label: 'BBA' },
    { value: 'B.Com', label: 'B.Com' },
    { value: 'Diploma', label: 'Diploma' },
    { value: '12th Pass', label: '12th Pass' },
    { value: '10th Pass', label: '10th Pass' },
    { value: 'Other', label: 'Other' },
  ];

  const sourceOptions = [
    { value: 'Manual Entry', label: 'Manual Entry' },
    { value: 'Walk-in', label: 'Walk-in' },
    { value: 'Referral', label: 'Referral' },
    { value: 'Instagram', label: 'Instagram' },
    { value: 'Facebook', label: 'Facebook' },
    { value: 'WhatsApp', label: 'WhatsApp' },
    { value: 'Website', label: 'Website' },
    { value: 'Google Ads', label: 'Google Ads' },
    { value: 'YouTube', label: 'YouTube' },
    { value: 'Campus Visit', label: 'Campus Visit' },
    { value: 'Cold Call', label: 'Cold Call' },
    { value: 'Other', label: 'Other' },
  ];


  const inputClass = "w-full bg-erp-surface border-2 border-erp-border rounded-2xl p-3.5 font-semibold text-erp-text outline-none focus:border-erp-primary transition-colors placeholder-erp-text/30 text-sm";

  return (
    <div className="p-4 pt-8 h-full bg-erp-background overflow-y-auto">
      <div className="flex items-center justify-between mb-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-display font-bold text-erp-text">New Lead</h1>
          <p className="text-sm text-erp-text/50 mt-1">Only Name & Phone are required. Everything else is optional.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/sales/pipeline')} className="px-4">Cancel</Button>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Required fields */}
          <div className="bg-erp-primary/5 border-2 border-erp-primary/20 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-black text-erp-primary uppercase tracking-wider">Required</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input
                  required
                  className={inputClass}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                />
              </Field>
              <Field label="Phone Number" required>
                <input
                  type="tel"
                  required
                  minLength={10}
                  maxLength={15}
                  pattern="[0-9\+\-\s]+"
                  className={inputClass}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                />
              </Field>
            </div>
          </div>

          {/* Optional fields */}
          <div className="space-y-4">
            <p className="text-xs font-black text-erp-text/40 uppercase tracking-wider">Optional Details</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </Field>
              <Field label="Location">
                <input
                  className={inputClass}
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Hyderabad"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Course Interest">
                <input 
                  list="lead-course-options"
                  type="text" 
                  value={course} 
                  onChange={e => setCourse(e.target.value)} 
                  className="w-full bg-erp-background border-2 border-erp-border rounded-xl px-4 py-3 text-erp-text focus:outline-none focus:border-erp-primary transition-colors" 
                  placeholder="Select or type a Course (optional)" 
                />
                <datalist id="lead-course-options">
                  {courses.map(c => <option key={c.value} value={c.value} />)}
                </datalist>
              </Field>
              <Field label="Source">
                <SearchableDropdown
                  options={sourceOptions}
                  value={source}
                  onChange={setSource}
                  placeholder="Where did this lead come from?"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Qualification">
                <SearchableDropdown
                  options={qualOptions}
                  value={qualification}
                  onChange={setQualification}
                  placeholder="Select"
                />
              </Field>
              <Field label="IT Background">
                <SearchableDropdown
                  options={[
                    { value: 'IT', label: 'IT' },
                    { value: 'Non-IT', label: 'Non-IT' },
                  ]}
                  value={itBackground}
                  onChange={setItBackground}
                  placeholder="Select"
                />
              </Field>
              <Field label="Grad Year">
                <input
                  className={inputClass}
                  value={gradYear}
                  onChange={e => setGradYear(e.target.value)}
                  placeholder="e.g. 2024"
                />
              </Field>
            </div>

            <Field label="Preferred Mode">
              <SearchableDropdown
                options={[
                  { value: 'Online', label: 'Online' },
                  { value: 'Offline', label: 'Offline' },
                  { value: 'Hybrid', label: 'Hybrid' },
                ]}
                value={mode}
                onChange={setMode}
                placeholder="Online / Offline / Hybrid"
              />
            </Field>

            <Field label="Notes">
              <textarea
                rows={3}
                className={`${inputClass} resize-none`}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any notes about this lead..."
              />
            </Field>
          </div>

          {/* Added by */}
          <div className="flex items-center gap-2 text-xs text-erp-text/40 font-medium bg-erp-surface rounded-xl px-3 py-2 border border-erp-border">
            <span>Added by:</span>
            <span className="font-bold text-erp-text/60">{user?.name || 'Unknown'} ({user?.role})</span>
          </div>

          <Button type="submit" disabled={loading} className="py-3.5 text-base" fullWidth>
            {loading ? 'Saving...' : 'Save Lead'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
