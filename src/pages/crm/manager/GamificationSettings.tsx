import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/erp/Card';
import { Button } from '../../../components/ui/erp/Button';
import { Settings, Award, Flame, Zap, Database, ArrowRight } from 'lucide-react';
import { client } from '../../../lib/turso';

import { getGamificationSettings, updateGamificationSetting, awardCoinsManually, GameSetting } from '../../../lib/api/gamification';
import { notify } from '../../../lib/feedback';

export default function GamificationSettings() {
  const [settings, setSettings] = useState<GameSetting[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual Reward State
  const [targetStudentId, setTargetStudentId] = useState('');
  const [rewardAmount, setRewardAmount] = useState(50);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const fetchedSettings = await getGamificationSettings();
      
      // If empty or missing keys, seed defaults for UI fallback (normally DB would have this)
      const defaults = [
        { task_type: 'daily_login', is_enabled: true, reward_amount: 10 },
        { task_type: 'amop_test_pass', is_enabled: true, reward_amount: 50 },
        { task_type: 'coding_challenge', is_enabled: true, reward_amount: 30 },
        { task_type: 'attendance_30m', is_enabled: true, reward_amount: 20 },
        { task_type: 'ai_interview_cost', is_enabled: true, reward_amount: 50 },
      ];

      if (fetchedSettings.length === 0) {
        setSettings(defaults);
      } else {
        // Merge fetched with defaults to ensure ai_interview_cost shows up
        const merged = [...fetchedSettings];
        defaults.forEach(def => {
          if (!merged.find(m => m.task_type === def.task_type)) {
            merged.push(def);
          }
        });
        setSettings(merged);
      }
    } catch (e) {
      console.error("Failed to fetch gamification settings", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetting = async (taskType: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const setting = settings.find(s => s.task_type === taskType);
      if (!setting) return;
      
      await updateGamificationSetting(taskType, newStatus, setting.reward_amount);
      setSettings(prev => prev.map(s => s.task_type === taskType ? { ...s, is_enabled: newStatus } : s));
    } catch (e) {
      console.error("Failed to toggle setting", e);
    }
  };

  const updateReward = async (taskType: string, amount: number) => {
    try {
      const setting = settings.find(s => s.task_type === taskType);
      if (!setting) return;
      
      await updateGamificationSetting(taskType, setting.is_enabled, amount);
      setSettings(prev => prev.map(s => s.task_type === taskType ? { ...s, reward_amount: amount } : s));
    } catch (e) {
      console.error("Failed to update reward", e);
    }
  };

  const handleManualReward = async () => {
    if (!targetStudentId || rewardAmount <= 0) return;
    try {
      await awardCoinsManually(targetStudentId, rewardAmount);
      notify(`Successfully awarded ${rewardAmount} coins to student!`);
      setTargetStudentId('');
    } catch (e) {
      console.error("Failed to manual reward", e);
      notify("Failed to award coins. Please check the student ID.");
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-20 md:pb-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-500" /> Gamification Controls
            </h1>
            <p className="text-erp-text/70 font-medium mt-1">Manage streaks, coin rewards, and student engagement rules.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-erp-surface">
              <h2 className="text-xl font-bold font-display text-erp-text mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" /> Reward Triggers
              </h2>
              
              {loading ? (
                <div className="text-center py-8 text-erp-text/50">Loading settings...</div>
              ) : (
                <div className="space-y-4">
                  {settings.map(setting => (
                    <div key={setting.task_type} className="flex items-center justify-between bg-erp-background p-4 rounded-xl border border-erp-border">
                      <div>
                        <h3 className="font-bold text-erp-text capitalize">{setting.task_type.replace(/_/g, ' ')}</h3>
                        <p className="text-xs text-erp-text/60">
                          {setting.task_type.includes('cost') ? `Cost: ${setting.reward_amount} Coins` : `Reward: ${setting.reward_amount} Coins`}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          value={setting.reward_amount}
                          onChange={(e) => updateReward(setting.task_type, Number(e.target.value))}
                          aria-label={`${setting.task_type.replace(/_/g, ' ')} coin amount`}
                          className="w-20 bg-erp-surface border border-erp-border rounded-lg px-2 py-1 text-sm text-erp-text text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-erp-primary"
                        />
                        <button
                          role="switch"
                          aria-checked={!!setting.is_enabled}
                          aria-label={`Enable ${setting.task_type.replace(/_/g, ' ')}`}
                          onClick={() => toggleSetting(setting.task_type, setting.is_enabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${setting.is_enabled ? 'bg-green-500' : 'bg-slate-700'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform ${setting.is_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 border-none">
              <h2 className="text-xl font-bold font-display text-white mb-6 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" /> Manual Reward
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="manual-reward-student" className="block text-sm font-bold text-white/70 mb-2">Student ID / Code</label>
                  <input
                    id="manual-reward-student"
                    type="text"
                    value={targetStudentId}
                    onChange={(e) => setTargetStudentId(e.target.value)}
                    placeholder="e.g. CNX-2026-0001"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="manual-reward-coins" className="block text-sm font-bold text-white/70 mb-2">Coins to Award</label>
                  <input
                    id="manual-reward-coins"
                    type="number"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none"
                  />
                </div>
                <Button variant="primary" fullWidth className="bg-yellow-500 hover:bg-yellow-400 text-black mt-4" onClick={handleManualReward}>
                  Grant Coins <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>

            <Card className="bg-erp-surface">
              <h2 className="text-lg font-bold font-display text-erp-text mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" /> Streak Logic
              </h2>
              <p className="text-sm text-erp-text/70 leading-relaxed mb-4">
                Streaks are strictly enforced. A student's streak will only increment if they maintain a logged attendance of <strong>at least 30 minutes</strong> in a live online class per day.
              </p>
              <div className="bg-erp-background p-3 rounded-lg border border-erp-border flex items-center gap-3">
                <Database className="w-4 h-4 text-erp-primary" />
                <span className="text-xs font-bold text-erp-text/80">Linked to `attendance_logs` table</span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
