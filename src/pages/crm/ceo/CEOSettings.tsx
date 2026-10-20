import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/erp/Card';
import { Button } from '../../../components/ui/erp/Button';
import { Database, Save, Key, Building } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSettingsGroup, setSetting } from '../../../lib/api/settings';
import { notify } from '../../../lib/feedback';

export default function CEOSettings() {
  const navigate = useNavigate();
  
  // Turso (Local Storage fallback)
  const [dbUrl, setDbUrl] = useState('');
  const [dbToken, setDbToken] = useState('');

  // Global Settings (DB)
  const [companyName, setCompanyName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [twilioKey, setTwilioKey] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load local storage keys
    setDbUrl(localStorage.getItem('TURSO_DB_URL') || '');
    setDbToken(localStorage.getItem('TURSO_AUTH_TOKEN') || '');

    // Load DB settings
    getSettingsGroup('global').then(settings => {
      if (settings.company_name) setCompanyName(settings.company_name);
      if (settings.support_email) setSupportEmail(settings.support_email);
      if (settings.openai_api_key) setOpenaiKey(settings.openai_api_key);
      if (settings.twilio_api_key) setTwilioKey(settings.twilio_api_key);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    
    // Save Turso locally
    if (dbUrl) localStorage.setItem('TURSO_DB_URL', dbUrl);
    if (dbToken) localStorage.setItem('TURSO_AUTH_TOKEN', dbToken);

    // Save global settings to DB
    await setSetting('global', 'company_name', companyName);
    await setSetting('global', 'support_email', supportEmail);
    await setSetting('global', 'openai_api_key', openaiKey);
    await setSetting('global', 'twilio_api_key', twilioKey);

    setSaving(false);
    notify('Settings saved successfully.');
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-32">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text">Global Settings</h1>
            <p className="text-erp-text/70 font-medium mt-1">Manage external API keys, integrations, and company details</p>
          </div>
          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => navigate('/ceo/dashboard')}>
              Back to Hub
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Changes'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
          
          <Card className="p-6">
            <h2 className="text-xl font-bold font-display text-erp-text mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-erp-primary" /> Company Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="CynexAI ERP"
                  className="bg-erp-surface rounded-xl border-2 border-erp-border focus-within:border-erp-primary outline-none text-erp-text font-medium w-full text-sm px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@cynexai.com"
                  className="bg-erp-surface rounded-xl border-2 border-erp-border focus-within:border-erp-primary outline-none text-erp-text font-medium w-full text-sm px-3 py-2"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold font-display text-erp-text mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-erp-primary" /> API Integrations
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">OpenAI API Key</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="bg-erp-surface rounded-xl border-2 border-erp-border focus-within:border-erp-primary outline-none text-erp-text font-mono w-full text-sm px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Twilio API Key</label>
                <input
                  type="password"
                  value={twilioKey}
                  onChange={(e) => setTwilioKey(e.target.value)}
                  placeholder="tw_..."
                  className="bg-erp-surface rounded-xl border-2 border-erp-border focus-within:border-erp-primary outline-none text-erp-text font-mono w-full text-sm px-3 py-2"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold font-display text-erp-text mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-erp-primary" /> Database Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Turso DB URL (Local Override)</label>
                <input
                  type="text"
                  value={dbUrl}
                  onChange={(e) => setDbUrl(e.target.value)}
                  placeholder="libsql://your-db-url.turso.io"
                  className="bg-erp-surface rounded-xl border-2 border-erp-border focus-within:border-erp-primary outline-none text-erp-text font-medium w-full text-sm px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Turso Auth Token</label>
                <input
                  type="password"
                  value={dbToken}
                  onChange={(e) => setDbToken(e.target.value)}
                  placeholder="eyJhbGci..."
                  className="bg-erp-surface rounded-xl border-2 border-erp-border focus-within:border-erp-primary outline-none text-erp-text font-mono w-full text-sm px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-4 bg-blue-50 dark:bg-blue-500/10 border-l-4 border-blue-500 p-4 rounded-r-xl">
              <h4 className="font-bold text-blue-800 dark:text-white text-sm mb-1">Security Notice</h4>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-200 leading-relaxed">
                These credentials give full access to the production database. Only CEO and authorized DevOps personnel should have access to this page. Do not share your Auth Token.
              </p>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
