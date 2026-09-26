import React, { useState, useEffect, useRef } from 'react';
import { 
  Award, 
  Upload, 
  Search, 
  Plus, 
  CheckCircle, 
  Download, 
  ExternalLink, 
  Trash2, 
  Sliders, 
  QrCode as QrIcon,
  RefreshCw,
  Eye,
  FileCheck
} from 'lucide-react';
import { 
  getAllCertificates, 
  saveCertificate, 
  deleteCertificate, 
  stampPermanentQR, 
  getPermanentVerificationUrl,
  CertificateRecord 
} from '../../../lib/api/certificates';
import { QRCodeSVG } from 'qrcode.react';

export const CertificatesManager: React.FC = () => {
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);

  // Form State
  const [formId, setFormId] = useState('');
  const [formStudentName, setFormStudentName] = useState('');
  const [formCourseTitle, setFormCourseTitle] = useState('Python Programming');
  const [formIssueDate, setFormIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [rawImageBase64, setRawImageBase64] = useState<string | null>(null);
  const [stampedImageBase64, setStampedImageBase64] = useState<string | null>(null);
  
  // Stamping Sliders
  const [qrSize, setQrSize] = useState<number>(88);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [showWebsiteText, setShowWebsiteText] = useState(true);
  const [isStamping, setIsStamping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const list = await getAllCertificates();
      setCertificates(list);
    } catch (err) {
      console.error('Error fetching certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  // Whenever raw image, formId, or sliders change, re-stamp in preview
  useEffect(() => {
    if (!rawImageBase64 || !formId) return;

    let active = true;
    const updateStamp = async () => {
      setIsStamping(true);
      try {
        const stamped = await stampPermanentQR(rawImageBase64, formId, {
          size: qrSize,
          offsetX,
          offsetY,
          showWebsiteText
        });
        if (active) {
          setStampedImageBase64(stamped);
        }
      } catch (err) {
        console.error('Auto-stamp error:', err);
      } finally {
        if (active) setIsStamping(false);
      }
    };

    const timer = setTimeout(updateStamp, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [rawImageBase64, formId, qrSize, offsetX, offsetY, showWebsiteText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setRawImageBase64(result);
      if (!formId) {
        // Generate a clean CX number if not entered
        setFormId(`CX${Math.floor(10000 + Math.random() * 90000)}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenNewModal = () => {
    setFormId(`CX${Math.floor(10000 + Math.random() * 90000)}`);
    setFormStudentName('');
    setFormCourseTitle('Python Programming');
    setFormIssueDate(new Date().toISOString().split('T')[0]);
    setRawImageBase64(null);
    setStampedImageBase64(null);
    setQrSize(88);
    setOffsetX(0);
    setOffsetY(0);
    setShowWebsiteText(true);
    setIsModalOpen(true);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!formId.trim()) {
      setMessage({ type: 'error', text: 'Certificate ID is required' });
      return;
    }
    if (!formStudentName.trim()) {
      setMessage({ type: 'error', text: 'Student name is required' });
      return;
    }
    if (!stampedImageBase64 && !rawImageBase64) {
      setMessage({ type: 'error', text: 'Please upload a certificate image template' });
      return;
    }

    setIsSaving(true);
    try {
      const finalImage = stampedImageBase64 || rawImageBase64 || '';
      const success = await saveCertificate({
        id: formId.trim(),
        certificate_number: formId.trim(),
        credential_id: formId.trim(),
        student_name: formStudentName.trim(),
        course_title: formCourseTitle.trim(),
        issue_date: formIssueDate,
        file_data: finalImage,
        file_type: 'image/jpeg',
        status: 'active'
      });

      if (success) {
        setMessage({ type: 'success', text: `Certificate ${formId} published successfully!` });
        await fetchCertificates();
        setTimeout(() => {
          setIsModalOpen(false);
          setMessage(null);
        }, 1200);
      } else {
        setMessage({ type: 'error', text: 'Failed to save certificate to database' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving certificate' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete certificate ${id}?`)) return;
    await deleteCertificate(id);
    await fetchCertificates();
  };

  const filtered = certificates.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.student_name && c.student_name.toLowerCase().includes(q)) ||
      (c.certificate_number && c.certificate_number.toLowerCase().includes(q)) ||
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.course_title && c.course_title.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                Certificate Management & QR Engine
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Issue certificates with permanent non-expiring QR verification seals pointing to <code className="text-cyan-400 font-mono">/certificates/:id</code>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCertificates}
            title="Refresh database"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenNewModal}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition"
          >
            <Plus className="w-4 h-4" /> Issue & Stamp Certificate
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Student Name, Certificate ID (e.g. CX01920), or Course..."
          className="flex-1 bg-transparent border-none text-white text-xs placeholder-slate-500 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-white mr-2">
            Clear
          </button>
        )}
      </div>

      {/* Certificates Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Registered Credentials ({filtered.length})
          </span>
          <span className="text-xs text-cyan-400 font-medium">
            All QR codes guaranteed permanent & non-expiring
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
            Loading certificates from Turso LibSQL...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No certificates found matching "{search}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Certificate ID</th>
                  <th className="py-3.5 px-4">Student Name</th>
                  <th className="py-3.5 px-4">Course</th>
                  <th className="py-3.5 px-4">Issue Date</th>
                  <th className="py-3.5 px-4">Permanent QR</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((c) => {
                  const certNum = c.certificate_number || c.id;
                  const publicUrl = `/certificates/${certNum}`;
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                        {certNum}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {c.student_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {c.course_title}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {c.issue_date || (c.issued_at ? c.issued_at.split('T')[0] : '—')}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="p-1 bg-white rounded inline-block shadow-sm">
                          <QRCodeSVG
                            value={getPermanentVerificationUrl(certNum)}
                            size={28}
                            level="M"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition flex items-center gap-1 text-[11px] font-medium"
                            title="Open Public Verification Link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Verify
                          </a>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition"
                            title="Delete Certificate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issue / Stamp Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-cyan-400" />
                  Issue Certificate & Stamp Permanent QR
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload any certificate template image. The permanent non-expiring QR code is automatically placed in the bottom middle.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-2"
              >
                ✕
              </button>
            </div>

            {message && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold ${
                message.type === 'success' 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}>
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Form Details */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Certificate ID (e.g. CX01920)
                  </label>
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value.toUpperCase())}
                    placeholder="CX01920"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Verification path will be: <code className="text-cyan-400">/certificates/{formId || 'ID'}</code>
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Student Full Name
                  </label>
                  <input
                    type="text"
                    value={formStudentName}
                    onChange={(e) => setFormStudentName(e.target.value)}
                    placeholder="e.g. Ramba Venkata Krishna"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Course / Program Title
                  </label>
                  <input
                    type="text"
                    value={formCourseTitle}
                    onChange={(e) => setFormCourseTitle(e.target.value)}
                    placeholder="Python Programming"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Upload Certificate Image */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Upload Certificate Image Template
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white transition bg-slate-950/50"
                  >
                    <Upload className="w-5 h-5 text-cyan-400" />
                    <span>{rawImageBase64 ? 'Change Certificate Image' : 'Select Certificate JPG / PNG'}</span>
                  </button>
                </div>

                {/* Fine-Tuning Controls */}
                {rawImageBase64 && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-cyan-400" /> QR Placement Controls
                      </span>
                      {isStamping && <span className="text-[10px] text-cyan-400 animate-pulse">Rendering...</span>}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>QR Size (px): {qrSize}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="160"
                        value={qrSize}
                        onChange={(e) => setQrSize(Number(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 block">Nudge X: {offsetX}px</span>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={offsetX}
                          onChange={(e) => setOffsetX(Number(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 block">Nudge Y: {offsetY}px</span>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={offsetY}
                          onChange={(e) => setOffsetY(Number(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={showWebsiteText}
                        onChange={(e) => setShowWebsiteText(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                      />
                      <span>Include 'www.cynexai.in' under QR code</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Right Column: Live Stamped Preview */}
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Live Stamped Certificate Preview</span>
                  {stampedImageBase64 && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                      <CheckCircle className="w-3 h-3" /> Permanent QR Applied
                    </span>
                  )}
                </div>

                <div className="flex-1 min-h-[260px] bg-slate-950 border border-slate-800 rounded-2xl p-2 flex items-center justify-center overflow-hidden">
                  {stampedImageBase64 ? (
                    <img
                      src={stampedImageBase64}
                      alt="Stamped Preview"
                      className="w-full h-auto max-h-[360px] object-contain rounded-xl shadow-lg"
                    />
                  ) : rawImageBase64 ? (
                    <img
                      src={rawImageBase64}
                      alt="Raw Preview"
                      className="w-full h-auto max-h-[360px] object-contain rounded-xl opacity-75"
                    />
                  ) : (
                    <div className="text-center text-slate-500 text-xs p-8">
                      <FileCheck className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                      Upload a certificate image on the left to see live permanent QR stamping.
                    </div>
                  )}
                </div>

                {stampedImageBase64 && (
                  <div className="text-[11px] text-slate-400 bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="font-mono text-cyan-400">https://www.cynexai.in/certificates/{formId}</span>
                    <span className="text-emerald-400 font-bold">Never Expires</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800 pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving || !rawImageBase64}
                onClick={handleSave}
                className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" /> Save & Issue Certificate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificatesManager;
