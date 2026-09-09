import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { assignBatchToStudent, getOnboardingDetails, getErpUsers } from '../../../lib/api/manager';
import { getBatchesForAssignment, findPendingTaskForEntity } from '../../../lib/api/batches';
import { Button } from '../../../components/ui/erp/Button';
import { SearchableDropdown } from '../../../components/ui/erp/SearchableDropdown';

export default function BatchAssignment() {
  const { id } = useParams(); // This is the studentId
  const navigate = useNavigate();
  
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  const [batch, setBatch] = useState('');
  const [teacher, setTeacher] = useState('');
  const [mode, setMode] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch onboarding details using studentId
      const details = await getOnboardingDetails(id as string);
      if (details) setStudentInfo(details);

      // Fetch teachers
      const users = await getErpUsers();
      setTeachers(users.filter((u: any) => u.role === 'Teacher'));

      // Fetch batches
      const batchesRes = await getBatchesForAssignment();
      setBatches(batchesRes);
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch || !teacher || !mode || !joiningDate) return alert("Fill all fields");
    
    setIsSubmitting(true);
    // Find task ID if any task links here
    const taskId = await findPendingTaskForEntity(id as string) || undefined;

    const result = await assignBatchToStudent(id as string, batch, teacher, mode, joiningDate, remarks, taskId);
    if (result) {
      alert("Batch assigned successfully!");
      navigate('/manager/tasks');
    } else {
      alert("Failed to assign batch.");
    }
    setIsSubmitting(false);
  };

  if (!studentInfo) return <div className="p-10 text-center font-bold">Loading...</div>;

  const batchOptions = batches.map(b => ({ value: b.id, label: `${b.name} (${b.course_id || 'Global'})` }));
  const teacherOptions = teachers.map(t => ({ value: t.id, label: t.name }));

  return (
    <div className="p-4 pt-8 min-h-screen bg-erp-background pb-32">
      <h1 className="text-2xl font-display font-bold text-erp-text mb-6">Assign Batch: {studentInfo.lead_name}</h1>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Select Batch</label>
          <SearchableDropdown 
            options={batchOptions}
            value={batch} onChange={setBatch} placeholder="Choose Batch"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Assigned Teacher</label>
          <SearchableDropdown 
            options={teacherOptions}
            value={teacher} onChange={setTeacher} placeholder="Choose Teacher"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Mode</label>
            <select className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3.5 font-bold text-erp-text outline-none" value={mode} onChange={e => setMode(e.target.value)} required>
              <option value="" disabled>Select</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Joining Date</label>
            <input required type="date" className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-erp-text/70 mb-1 uppercase">Remarks</label>
          <textarea className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold text-erp-text h-20" value={remarks} onChange={e => setRemarks(e.target.value)} />
        </div>
        
        <Button type="submit" variant="primary" fullWidth className="mt-4" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Confirm Assignment'}
        </Button>
      </form>
    </div>
  );
}
