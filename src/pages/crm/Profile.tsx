import React, { useState } from 'react';
import { getCurrentUser, logout } from '../../lib/auth';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { User, LogOut, Settings, Save, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [openAiKey, setOpenAiKey] = useState(localStorage.getItem('CYNEX_OPENAI_KEY') || '');
  const [groqKey, setGroqKey] = useState(import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('cynex_groq_key') || '');
  const [saved, setSaved] = useState(false);

  const handleSaveKeys = () => {
    localStorage.setItem('CYNEX_OPENAI_KEY', openAiKey);
    localStorage.setItem('cynex_groq_key', groqKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!user) return null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-20 md:pb-8">
        <div className="w-full max-w-4xl mx-auto">
          <h1 className="text-3xl font-display font-bold text-erp-text mb-6">Profile & Settings</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Profile Info */}
          <Card className="flex flex-col">
            <div className="flex items-center gap-3 mb-6 border-b-2 border-erp-border pb-4">
              <div className="w-16 h-16 bg-erp-primary text-white rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-erp-text">{user.name}</h2>
                <p className="font-mono text-sm text-erp-text/50">{user.email}</p>
              </div>
            </div>

            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-xs font-bold text-erp-text/50 uppercase mb-1">Role</label>
                <div className="font-bold text-erp-text bg-erp-surface px-4 py-2 rounded-xl inline-block border-2 border-erp-border">
                  {user.role}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Button variant="ghost" fullWidth onClick={handleLogout} className="text-red-500 border-red-500 hover:bg-red-50">
                <LogOut className="w-5 h-5 mr-2" /> Sign Out
              </Button>
            </div>
          </Card>

          {/* Sales Performance Dashboard */}
          {(user.role === 'Sales/HR' || user.role === 'Manager') && (
            <Card className="flex flex-col">
              <div className="flex items-center gap-3 mb-6 border-b-2 border-erp-border pb-4">
                <h2 className="text-xl font-bold text-erp-text">My Performance</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div className="bg-erp-surface border border-erp-border rounded-xl p-4 flex flex-col justify-center items-center card-hover">
                  <span className="text-3xl font-bold font-display text-erp-primary mb-1">12</span>
                  <span className="text-xs font-bold text-erp-text/70 uppercase">Calls Made</span>
                </div>
                <div className="bg-erp-surface border border-erp-border rounded-xl p-4 flex flex-col justify-center items-center card-hover">
                  <span className="text-3xl font-bold font-display text-erp-secondary mb-1">4</span>
                  <span className="text-xs font-bold text-erp-text/70 uppercase">Interested</span>
                </div>
                <div className="bg-erp-surface border border-erp-border rounded-xl p-4 flex flex-col justify-center items-center card-hover">
                  <span className="text-3xl font-bold font-display text-emerald-500 mb-1">1</span>
                  <span className="text-xs font-bold text-erp-text/70 uppercase">Admissions</span>
                </div>
                <div className="bg-erp-surface border border-erp-border rounded-xl p-4 flex flex-col justify-center items-center card-hover">
                  <span className="text-3xl font-bold font-display text-amber-500 mb-1">8</span>
                  <span className="text-xs font-bold text-erp-text/70 uppercase">Tasks Done</span>
                </div>
              </div>
            </Card>
          )}

          {/* Dev Settings (Manager/CEO only) */}
          {(user.role === 'Manager' || user.role === 'CEO') && (
            <Card className="flex flex-col border-erp-primary md:col-span-2 max-w-2xl">
              <div className="flex items-center gap-3 mb-6 border-b-2 border-erp-border pb-4">
                <Settings className="w-8 h-8 text-erp-primary" />
                <h2 className="text-2xl font-bold text-erp-text">Dev Settings</h2>
              </div>
              
              <p className="text-sm font-medium text-erp-text/70 mb-6 bg-blue-50 text-blue-800 dark:text-white p-3 rounded-xl border border-blue-200">
                API Keys stored here are saved locally in your browser's localStorage. They are never sent to our servers.
              </p>

              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-bold text-erp-text/70 mb-2">Groq API Key (for LLaMA / Qwen / Voice Mock Interviews)</label>
                  <input 
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold text-erp-text focus:outline-none focus:border-erp-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-erp-text/70 mb-2">OpenAI API Key (for Voice/Sales Pitch)</label>
                  <input 
                    type="password"
                    value={openAiKey}
                    onChange={(e) => setOpenAiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl p-3 font-bold text-erp-text focus:outline-none focus:border-erp-primary"
                  />
                </div>
              </div>

              <div className="mt-8">
                <Button variant="primary" fullWidth onClick={handleSaveKeys} className="flex items-center justify-center gap-2">
                  {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                  {saved ? 'Saved!' : 'Save Keys'}
                </Button>
              </div>
            </Card>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
