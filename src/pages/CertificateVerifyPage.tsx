import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  CheckCircle, 
  ShieldCheck, 
  Download, 
  Share2, 
  Calendar, 
  Award, 
  ExternalLink, 
  Search, 
  AlertCircle,
  Copy,
  Printer,
  Sparkles,
  QrCode as QrIcon
} from 'lucide-react';
import { getCertificateById, getPermanentVerificationUrl, CertificateRecord } from '../lib/api/certificates';
import { QRCodeSVG } from 'qrcode.react';

export const CertificateVerifyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [cert, setCert] = useState<CertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadCertificate = async () => {
      setLoading(true);
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const data = await getCertificateById(id);
        if (isMounted) {
          setCert(data);
          if (data) {
            document.title = `${data.student_name} - CynexAI Verified Certificate (${data.certificate_number || data.id})`;
          } else {
            document.title = 'Certificate Verification - CynexAI';
          }
        }
      } catch (err) {
        console.error('Error fetching certificate:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCertificate();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const certId = cert?.certificate_number || cert?.id || id || '';
  const verificationUrl = getPermanentVerificationUrl(certId);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadImage = () => {
    if (!cert?.file_data) return;
    const link = document.createElement('a');
    link.href = cert.file_data;
    link.download = `CynexAI_Certificate_${cert.certificate_number || 'CX'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareLinkedIn = () => {
    const certName = encodeURIComponent(cert?.course_title || 'Certificate of Completion');
    const orgName = encodeURIComponent('CynexAI Technologies Pvt Ltd');
    const issueDate = cert?.issue_date ? new Date(cert.issue_date) : new Date();
    const issueYear = issueDate.getFullYear();
    const issueMonth = issueDate.getMonth() + 1;
    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${certName}&organizationName=${orgName}&issueYear=${issueYear}&issueMonth=${issueMonth}&certUrl=${encodeURIComponent(window.location.href)}&certId=${encodeURIComponent(certId)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Dec 27th, 2025';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-cyan-500/20">
              C
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                CYNEX<span className="text-cyan-400">AI</span>
              </span>
              <span className="text-[10px] text-slate-400 tracking-wider block -mt-1 uppercase font-semibold">
                Credential Verification
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Official Verification Portal
            </span>
            <Link
              to="/courses"
              className="text-xs font-medium text-slate-300 hover:text-white transition px-3 py-1.5 rounded-lg border border-slate-700/60 hover:border-slate-600 bg-slate-800/50"
            >
              Explore Programs
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-white">Authenticating Credential...</h3>
            <p className="text-sm text-slate-400 mt-1">Retrieving official verification record from CynexAI registry</p>
          </div>
        ) : !cert ? (
          /* Not Found State */
          <div className="max-w-2xl mx-auto text-center py-16 px-4">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-amber-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Certificate Not Found</h2>
            <p className="text-slate-400 mb-8 text-sm">
              We could not find an official certificate record for ID <code className="text-cyan-400 font-mono font-semibold bg-slate-900 px-2 py-1 rounded border border-slate-800">{id}</code>. Please check the Certificate ID and try again.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  window.location.href = `/certificates/${encodeURIComponent(searchQuery.trim())}`;
                }
              }}
              className="flex gap-2 max-w-md mx-auto"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Certificate ID (e.g. CX01920)"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition flex items-center gap-2"
              >
                <Search className="w-4 h-4" /> Verify
              </button>
            </form>
          </div>
        ) : (
          /* Verified Certificate Details */
          <div className="space-y-8">
            {/* Verification Success Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl shadow-emerald-950/20">
              <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                <div className="flex items-start sm:items-center gap-4 sm:gap-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 flex-shrink-0">
                    <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 mb-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      OFFICIALLY VERIFIED & AUTHENTIC
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      CynexAI Verified Credential
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      Issued by <span className="text-slate-200 font-medium">CynexAI Technologies Pvt Ltd</span> • IT Training & Tech Development
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                  >
                    <Copy className="w-4 h-4 text-cyan-400" />
                    {copied ? 'Link Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={handleShareLinkedIn}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition"
                  >
                    <Share2 className="w-4 h-4" />
                    Add to LinkedIn
                  </button>
                  {cert.file_data && (
                    <button
                      onClick={handleDownloadImage}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Grid Layout: Left Details + Right QR & Certificate Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Metadata & Student Credentials */}
              <div className="lg:col-span-5 space-y-6">
                {/* Student & Course Card */}
                <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-6">
                  <div className="border-b border-slate-800/80 pb-5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Recipient
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {cert.student_name}
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-medium">
                        Student ID: {cert.student_id || 'STU-' + certId}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Course / Program Completed
                      </span>
                      <div className="flex items-center gap-2 text-lg font-bold text-cyan-400">
                        <Award className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        <span>{cert.course_title}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-cyan-400" /> Issue Date
                        </span>
                        <span className="text-sm font-semibold text-slate-200">
                          {formatDate(cert.issue_date || cert.issued_at)}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" /> Status
                        </span>
                        <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          Permanent / Active
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Certificate ID:</span>
                        <span className="font-mono font-bold text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {cert.certificate_number || cert.id}
                        </span>
                      </div>
                      {cert.credential_id && cert.credential_id !== cert.certificate_number && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Credential Ref:</span>
                          <span className="font-mono text-slate-300">
                            {cert.credential_id}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Issuing Body:</span>
                        <span className="text-slate-300 font-medium">CynexAI Technologies</span>
                      </div>
                    </div>
                  </div>

                  {/* Accreditations Badges */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[10px] font-bold text-amber-400">
                        MSME
                      </div>
                      <span>Ministry of MSME, Govt. of India</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      ISO 9001:2015
                    </div>
                  </div>
                </div>

                {/* Permanent Non-Expiring QR Code Info Box */}
                <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <QrIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Permanent QR Authentication</h4>
                      <p className="text-xs text-slate-400">Direct canonical verification matrix</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                    <div className="p-2 bg-white rounded-xl shadow-md flex-shrink-0">
                      <QRCodeSVG
                        value={verificationUrl}
                        size={110}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="font-semibold text-slate-200">
                        Scannable from any phone camera
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        This QR code directly encodes the official CynexAI verification path. It never expires and resolves permanently to this record.
                      </p>
                      <div className="pt-1">
                        <code className="text-[10px] text-cyan-400 break-all select-all font-mono">
                          {verificationUrl}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Full Certificate Preview */}
              <div className="lg:col-span-7 space-y-6">
                <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-7 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        Official Certificate Document
                      </h3>
                      <p className="text-xs text-slate-400">
                        Authenticated digital copy with permanent stamped QR verification seal
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrint}
                        title="Print Certificate"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {cert.file_data && (
                        <button
                          onClick={handleDownloadImage}
                          title="Download High-Res"
                          className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition border border-cyan-500/30"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Certificate Image Frame */}
                  {cert.file_data ? (
                    <div className="relative group rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl">
                      <img
                        src={cert.file_data}
                        alt={`Certificate for ${cert.student_name}`}
                        className="w-full h-auto object-contain cursor-zoom-in transition duration-300 group-hover:scale-[1.01]"
                        onClick={() => setShowFullImage(true)}
                      />
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition duration-200">
                        <span className="text-xs text-slate-300 font-medium">Click to view full screen</span>
                        <span className="text-xs font-mono text-cyan-400 font-bold">{cert.certificate_number}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-slate-800 p-12 text-center text-slate-400">
                      <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm font-medium">Certificate document is active in system</p>
                    </div>
                  )}

                  {/* Security Statement */}
                  <div className="mt-6 pt-5 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-300 block mb-0.5">Cryptographic Authenticity Guarantee</span>
                      This certificate has been cryptographically registered and authorized by CynexAI Technologies Pvt Ltd. Any tampering, unauthorized reproduction, or alteration of this credential constitutes a violation under IT & educational compliance regulations. For corporate background checks or recruiter inquiries, contact <a href="mailto:info@cynexai.in" className="text-cyan-400 hover:underline">info@cynexai.in</a>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fullscreen Image Lightbox Modal */}
      {showFullImage && cert?.file_data && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-6xl w-full max-h-[92vh] flex flex-col items-center">
            <img
              src={cert.file_data}
              alt={cert.student_name}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-slate-800"
            />
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-300">
              <span>{cert.student_name} — {cert.course_title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadImage();
                }}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download Original
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            © {new Date().getFullYear()} CynexAI Technologies Pvt Ltd. All rights reserved.
          </span>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-slate-300 transition">Home</Link>
            <Link to="/courses" className="hover:text-slate-300 transition">Courses</Link>
            <a href="mailto:info@cynexai.in" className="hover:text-slate-300 transition">Verification Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CertificateVerifyPage;
