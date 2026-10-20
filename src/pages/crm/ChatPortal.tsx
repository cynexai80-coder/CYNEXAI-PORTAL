import React, { useState, useEffect } from 'react';
import { toWhatsAppNumber } from '../../lib/phoneUtils';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { MessageCircle, FileText, Send, Download, Users, Server, QrCode, Plus, Edit2, Trash2 } from 'lucide-react';
import { getLeads, addActivity } from '../../lib/api/crm';
import { Lead } from '../../lib/types';
import { QRCodeSVG } from 'qrcode.react';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, WhatsAppTemplate } from '../../lib/api/whatsapp';
import { getCurrentUser } from '../../lib/auth';
import { notify, confirmDialog, promptDialog } from '../../lib/feedback';

// WhatsApp service (backend/server.js on Render). Dev falls back to the local backend; production needs VITE_WHATSAPP_API_URL.
const WHATSAPP_API = String(import.meta.env.VITE_WHATSAPP_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '');

export default function ChatPortal() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'templates' | 'bulk' | 'server' | 'manage'>('server');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<string>('checking...');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState('');
  
  const [editingTemplate, setEditingTemplate] = useState<Partial<WhatsAppTemplate> | null>(null);

  const user = getCurrentUser();
  const canManageTemplates = user && ['Manager', 'CEO', 'DM'].includes(user.role);

  useEffect(() => {
    getLeads().then(setLeads);
    loadTemplates();
    checkWhatsAppStatus();
    const interval = setInterval(checkWhatsAppStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadTemplates = async () => {
    const t = await getTemplates();
    setTemplates(t);
  };

  const checkWhatsAppStatus = async () => {
    if (!WHATSAPP_API) { setWaStatus('offline'); return; }
    try {
      const res = await fetch(`${WHATSAPP_API}/api/whatsapp/status`);
      const data = await res.json();
      setWaStatus(data.status);
      if (data.qr) setQrCode(data.qr);
    } catch (e) {
      setWaStatus('offline');
    }
  };

  const handleOpenWhatsApp = async (templateText: string, name?: string, course?: string, phoneInput?: string) => {
    const finalName = name || "[Name]";
    const finalCourse = course || "[Course]";
    const msg = encodeURIComponent(templateText.replace(/\[Name\]/g, finalName).replace(/\[Course\]/g, finalCourse));
    
    let phone = phoneInput;
    if (!phone) {
      phone = (await promptDialog({ title: 'Phone number', message: 'Enter the 10-digit phone number:', inputType: 'tel', placeholder: '9876543210', confirmLabel: 'Open WhatsApp', validate: v => (v.replace(/\D/g, '').length >= 10 ? null : 'Enter a valid 10-digit phone number.') })) ?? undefined;
    }
    if (phone) {
      const cleanPhone = toWhatsAppNumber(phone);
      window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
    }
  };

  const downloadVCF = (lead: Lead) => {
    const vcfContent = `BEGIN:VCARD\nVERSION:3.0\nN:;${lead.name} - ${lead.course_interest};;;\nFN:${lead.name} - ${lead.course_interest}\nTEL;TYPE=CELL:${lead.phone}\nEND:VCARD`;
    const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${lead.name}_${lead.course_interest}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkSend = async (templateText: string) => {
    const selected = leads.filter(l => selectedLeads.includes(l.id));
    if (selected.length === 0) return notify("Select leads first");
    
    if (waStatus === 'ready') {
       const confirmed = await confirmDialog({ title: 'Send bulk messages', message: `Ready to automatically send to ${selected.length} leads using the server? There will be a 30-second delay between each message to prevent account blocking.`, confirmLabel: 'Send' });
       if (!confirmed) return;
       
       setIsSending(true);
       let count = 1;
       let sentOk = 0;
       const failedNames: string[] = [];
       
       for (const lead of selected) {
          const finalName = lead.name || "[Name]";
          const finalCourse = lead.course_interest || "[Course]";
          const msg = templateText.replace(/\[Name\]/g, finalName).replace(/\[Course\]/g, finalCourse);
          
          setSendProgress(`Sending to ${lead.name} (${count} of ${selected.length})...`);
          
          try {
             const res = await fetch(`${WHATSAPP_API}/api/whatsapp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: toWhatsAppNumber(lead.phone), message: msg })
             });
             if (res.ok) {
                sentOk++;
                if (user) await addActivity(lead.id, user.id, 'WhatsApp Sent', msg);
             } else {
                failedNames.push(lead.name);
             }
          } catch(e) {
             console.error("Failed to send to", lead.phone);
             failedNames.push(lead.name);
          }
          
          if (count < selected.length) {
            setSendProgress(`Sent to ${lead.name}. Waiting 30s before next...`);
            await new Promise(resolve => setTimeout(resolve, 30000));
          }
          count++;
       }
       setIsSending(false);
       notify(failedNames.length === 0
         ? `Bulk sending complete! ${sentOk} message(s) sent.`
         : `Done: ${sentOk} sent, ${failedNames.length} failed (${failedNames.slice(0, 5).join(', ')}${failedNames.length > 5 ? ', …' : ''}).`);
       setSelectedLeads([]);
       setSendProgress('');
    } else {
       const confirmed = await confirmDialog({ title: 'Server offline', message: `Server offline. Ready to send to ${selected.length} leads manually? A new window will open for the first lead. Come back and click next for the rest.`, confirmLabel: 'Continue' });
       if (confirmed) {
         handleOpenWhatsApp(templateText, selected[0].name, selected[0].course_interest, selected[0].phone);
         setSelectedLeads(selectedLeads.filter(id => id !== selected[0].id));
       }
    }
  };
  
  const handleSaveTemplate = async () => {
    if (!editingTemplate?.name || !editingTemplate?.body) return notify('Name and body are required');
    if (editingTemplate.id) {
       await updateTemplate(editingTemplate.id, editingTemplate.name, editingTemplate.body, editingTemplate.category || 'General');
    } else {
       await createTemplate(editingTemplate.name, editingTemplate.body, editingTemplate.category || 'General');
    }
    setEditingTemplate(null);
    loadTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    if (await confirmDialog({ title: 'Delete template', message: 'Delete this template?', confirmLabel: 'Delete', danger: true })) {
       await deleteTemplate(id);
       loadTemplates();
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-32">
        <div className="flex items-center gap-3 mb-6">
          <MessageCircle className="w-8 h-8 text-erp-primary" />
          <h1 className="text-3xl font-display font-bold text-erp-text">WhatsApp Center</h1>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <button 
            className={`font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${activeTab === 'server' ? 'bg-erp-primary text-white' : 'bg-erp-surface text-erp-text'}`}
            onClick={() => setActiveTab('server')}
          >
            <Server className="w-4 h-4" /> Server Sync
          </button>
          <button 
            className={`font-bold px-4 py-2 rounded-xl transition-colors ${activeTab === 'templates' ? 'bg-erp-primary text-white' : 'bg-erp-surface text-erp-text'}`}
            onClick={() => setActiveTab('templates')}
          >
            Templates & Direct Message
          </button>
          <button 
            className={`font-bold px-4 py-2 rounded-xl transition-colors ${activeTab === 'bulk' ? 'bg-erp-primary text-white' : 'bg-erp-surface text-erp-text'}`}
            onClick={() => setActiveTab('bulk')}
          >
            Bulk Sequencer
          </button>
          {canManageTemplates && (
            <button 
              className={`font-bold px-4 py-2 rounded-xl transition-colors ${activeTab === 'manage' ? 'bg-erp-primary text-white' : 'bg-erp-surface text-erp-text'}`}
              onClick={() => setActiveTab('manage')}
            >
              Manage Templates
            </button>
          )}
        </div>

        {activeTab === 'server' && (
          <div className="flex flex-col items-center justify-center max-w-lg mx-auto w-full mt-8">
            <Card className="w-full text-center">
              <h2 className="text-xl font-bold font-display text-erp-text mb-2">WhatsApp Web Automation</h2>
              <p className="text-sm text-erp-text/70 mb-8">
                Connect your business WhatsApp to automatically sync inbound messages directly into the Turso CRM database.
              </p>

              {waStatus === 'offline' && (
                <div className="bg-red-500/10 text-red-700 dark:text-red-400 p-4 rounded-xl border border-red-500/20 font-bold">
                  The local backend server is offline. Please run "node server.js" in the backend folder.
                </div>
              )}
              
              {waStatus === 'needs_login' && qrCode && (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white dark:bg-black p-4 rounded-xl inline-block shadow-lg">
                    <QRCodeSVG value={qrCode} size={256} />
                  </div>
                  <p className="text-erp-text font-bold animate-pulse flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-erp-primary" />
                    Scan this QR code with WhatsApp
                  </p>
                </div>
              )}

              {waStatus === 'ready' && (
                <div className="bg-green-500/10 text-green-700 dark:text-green-400 p-6 rounded-xl border border-green-500/20">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-xl mb-1">Successfully Connected!</h3>
                  <p className="text-sm opacity-80">WhatsApp is actively syncing inbound messages to Turso CRM.</p>
                </div>
              )}

              {waStatus === 'initializing' && (
                <div className="text-erp-text/70 p-8 flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-erp-primary border-t-transparent rounded-full animate-spin"></div>
                  Initializing headless browser...
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'templates' && (
          <>
            <p className="text-erp-text/70 font-medium mb-6 max-w-2xl">
              Quickly launch WhatsApp chats using our optimized sales templates. For specific leads, use the WhatsApp button directly on their Lead Profile.
            </p>
            {templates.length === 0 ? (
              <div className="p-8 text-center text-erp-text/50 font-bold border-2 border-dashed border-erp-border rounded-xl">
                No templates available. {canManageTemplates ? 'Go to Manage Templates to create some!' : 'Please ask your manager to add templates.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map(template => (
                  <Card key={template.id} className="flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-3 border-b-2 border-erp-border pb-2">
                      <FileText className="w-5 h-5 text-erp-primary" />
                      <h3 className="font-bold text-lg text-erp-text">{template.name}</h3>
                    </div>
                    <p className="text-sm text-erp-text/80 flex-1 mb-6 font-medium leading-relaxed italic bg-erp-surface p-3 rounded-xl whitespace-pre-wrap">
                      "{template.body}"
                    </p>
                    <Button variant="info" fullWidth onClick={() => handleOpenWhatsApp(template.body)} className="flex items-center justify-center gap-2">
                      <Send className="w-4 h-4" /> Use Template
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'bulk' && (
          <div className="flex flex-col md:flex-row gap-6">
            <Card className="flex-1">
              <h2 className="text-xl font-bold font-display text-erp-text mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-erp-primary" /> Lead Selection
              </h2>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {leads.map(lead => (
                  <label key={lead.id} className="flex items-center justify-between p-3 bg-erp-surface rounded-xl border border-erp-border cursor-pointer hover:border-erp-primary transition-colors">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-erp-primary"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedLeads([...selectedLeads, lead.id]);
                          else setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                        }}
                      />
                      <div>
                        <p className="font-bold text-erp-text">{lead.name}</p>
                        <p className="text-xs text-erp-text/70">{lead.phone} • {lead.course_interest}</p>
                        {lead.last_whatsapp_msg && (
                          <p className="text-xs text-green-600 mt-1 truncate max-w-[250px] font-medium" title={lead.last_whatsapp_msg}>
                            Last: {lead.last_whatsapp_msg}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" className="p-2 h-auto" onClick={(e) => { e.preventDefault(); downloadVCF(lead); }} title="Download VCF">
                      <Download className="w-4 h-4 text-erp-secondary" />
                    </Button>
                  </label>
                ))}
              </div>
            </Card>

            <Card className="flex-1">
              <h2 className="text-xl font-bold font-display text-erp-text mb-4">Sequencer ({selectedLeads.length} selected)</h2>
              <p className="text-sm text-erp-text/70 mb-4">Choose a template to start the sequence. The system will wait 30 seconds between messages.</p>
              
              {isSending ? (
                <div className="bg-erp-surface p-6 rounded-xl text-center border-2 border-erp-primary">
                  <div className="w-8 h-8 border-4 border-erp-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="font-bold text-erp-text text-lg mb-2">Sequence in Progress</p>
                  <p className="text-sm text-erp-text/70 mb-4">{sendProgress}</p>
                  <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded-lg">DO NOT CLOSE THIS TAB</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map(template => (
                    <Button 
                      key={template.id} 
                      variant="secondary" 
                      fullWidth 
                      onClick={() => handleBulkSend(template.body)}
                      disabled={selectedLeads.length === 0}
                      className="flex justify-between items-center"
                    >
                      <span>{template.name}</span>
                      <Send className="w-4 h-4" />
                    </Button>
                  ))}
                  {templates.length === 0 && (
                    <p className="text-sm text-erp-text/50 font-bold text-center">No templates available to send.</p>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
        
        {activeTab === 'manage' && canManageTemplates && (
          <div className="flex flex-col md:flex-row gap-6">
            <Card className="flex-1">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold font-display text-erp-text">Saved Templates</h2>
                <Button onClick={() => setEditingTemplate({ name: '', body: '', category: 'General' })} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" /> New Template
                </Button>
              </div>
              <div className="space-y-4">
                {templates.map(template => (
                  <div key={template.id} className="p-4 bg-erp-surface rounded-xl border border-erp-border flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-erp-text">{template.name}</h3>
                      <p className="text-xs text-erp-text/70 truncate max-w-[250px]">{template.body}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditingTemplate(template)} className="p-2 h-auto text-erp-primary">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" onClick={() => handleDeleteTemplate(template.id)} className="p-2 h-auto text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            
            {editingTemplate && (
              <Card className="flex-1 border-2 border-erp-primary">
                <h2 className="text-xl font-bold font-display text-erp-text mb-4">
                  {editingTemplate.id ? 'Edit Template' : 'Create Template'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-erp-text/70 mb-1">Template Name</label>
                    <input 
                      type="text"
                      className="w-full bg-white dark:bg-black border-2 border-erp-border rounded-xl px-4 py-2 font-bold focus:border-erp-primary outline-none"
                      value={editingTemplate.name || ''}
                      onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                      placeholder="e.g. Initial Welcome"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-erp-text/70 mb-1">Message Body</label>
                    <p className="text-xs text-erp-text/50 mb-2">Use [Name] and [Course] for dynamic variables.</p>
                    <textarea 
                      className="w-full bg-white dark:bg-black border-2 border-erp-border rounded-xl px-4 py-2 font-medium focus:border-erp-primary outline-none min-h-[150px]"
                      value={editingTemplate.body || ''}
                      onChange={e => setEditingTemplate({...editingTemplate, body: e.target.value})}
                      placeholder="Hi [Name], thanks for your interest in [Course]..."
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <Button variant="ghost" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                    <Button onClick={handleSaveTemplate}>Save Template</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
