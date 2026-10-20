import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { Sparkles, RotateCcw, Save, CheckCircle2, Brain, Palette, BookOpen, ChevronRight, Info } from 'lucide-react';
import { getCurrentUser } from '../../lib/auth';
import { motion, AnimatePresence } from 'framer-motion';

export const SLIDE_PROMPT_KEY = 'cynexai_slide_system_prompt';

export const DEFAULT_SLIDE_PROMPT = `You are an expert instructor creating a live class presentation.

Class title: "{{title}}"
{{description}}

CRITICAL: Output EXACTLY 3 sections separated by "---SPLIT---" (use this separator NOWHERE else).

SECTION 1 - PRESENTATION SLIDES (Markdown):
- Generate EXACTLY 12 slides about the topic: "{{title}}"
- DO NOT include any images, photos, or ![] markdown whatsoever
- Each slide MUST be separated by exactly "---" on its own line
- Slide 1: Title slide with just # Title and a one-line tagline as a paragraph
- Slides 2-11: Use # for slide title, then 4-5 bullet points using "-"
- Slide 12: Summary/Key Takeaways slide
- Content MUST be directly about the class topic. Do not mix unrelated subjects.
- Keep bullet points SHORT — max 12 words each
- No sub-headings (##) needed

---SPLIT---

SECTION 2 - TEACHER KEYPOINTS:
For each slide, provide exactly 3 teaching notes (teaching point, analogy, gotcha):
[Slide 1]
- Point: ...
- Analogy: ...
- Gotcha: ...
[Slide 2]
- Point: ...
(continue for all 12 slides)

---SPLIT---

SECTION 3 - TELEPROMPTER SCRIPT:
Write one short welcome paragraph (3-4 sentences) for the teacher to read at the start.`;

const PRESETS = [
  {
    label: 'Default (Balanced)',
    icon: '⚖️',
    description: 'Clean, structured slides. Good for most topics.',
    prompt: DEFAULT_SLIDE_PROMPT,
  },
  {
    label: 'Storytelling Style',
    icon: '📖',
    description: 'Narrative-driven slides with real-world examples.',
    prompt: DEFAULT_SLIDE_PROMPT.replace(
      'You are an expert instructor creating a live class presentation.',
      'You are a world-class storyteller and instructor. Every slide should tell a mini-story that the student can relate to. Use real-world analogies, memorable hooks, and narrative flow.'
    ).replace('Keep bullet points SHORT — max 12 words each', 'Each bullet should be a mini-story hook — one sentence, vivid and memorable'),
  },
  {
    label: 'Technical Deep Dive',
    icon: '🔬',
    description: 'Detailed, precise slides for tech/data topics.',
    prompt: DEFAULT_SLIDE_PROMPT.replace(
      'You are an expert instructor creating a live class presentation.',
      'You are a senior technical expert. Slides should be precise, use correct terminology, include concrete code/formula examples where relevant, and be dense with actionable information.'
    ).replace('Keep bullet points SHORT — max 12 words each', 'Bullet points may be technical and precise — prioritize accuracy over brevity'),
  },
  {
    label: 'Beginner Friendly',
    icon: '🌱',
    description: 'Simple language, no jargon, very accessible.',
    prompt: DEFAULT_SLIDE_PROMPT.replace(
      'You are an expert instructor creating a live class presentation.',
      'You are teaching absolute beginners with zero prior knowledge. Use the simplest possible language, avoid all jargon, explain every concept with an everyday analogy, and be encouraging and friendly.'
    ).replace('Keep bullet points SHORT — max 12 words each', 'Bullet points must be in plain simple English — as if explaining to a 10-year-old'),
  },
  {
    label: 'Interview Prep',
    icon: '💼',
    description: 'Focus on Q&A, practical tips, and gotchas.',
    prompt: DEFAULT_SLIDE_PROMPT.replace(
      'You are an expert instructor creating a live class presentation.',
      'You are an interview coach. Every slide should prepare students for real interviews. Include common interview questions, red flags to avoid, and insider tips from hiring managers.'
    ).replace('Keep bullet points SHORT — max 12 words each', 'Each bullet should be a practical interview tip or common question'),
  },
];

export default function TeacherSettings() {
  const user = getCurrentUser();
  const [prompt, setPrompt] = useState(DEFAULT_SLIDE_PROMPT);
  const [saved, setSaved] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [activeTab, setActiveTab] = useState<'prompt' | 'presets'>('presets');

  useEffect(() => {
    const stored = localStorage.getItem(SLIDE_PROMPT_KEY);
    if (stored) {
      setPrompt(stored);
      // Find which preset matches
      const idx = PRESETS.findIndex(p => p.prompt === stored);
      setSelectedPreset(idx >= 0 ? idx : -1);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(SLIDE_PROMPT_KEY, prompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePreset = (idx: number) => {
    setSelectedPreset(idx);
    setPrompt(PRESETS[idx].prompt);
  };

  const handleReset = () => {
    setPrompt(DEFAULT_SLIDE_PROMPT);
    setSelectedPreset(0);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-32">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
              <Brain className="w-8 h-8 text-violet-500" />
              AI Slide Settings
            </h1>
            <p className="text-erp-text/60 font-medium mt-1">
              Customize how AI generates your presentation slides
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleReset} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-100 dark:bg-zinc-900/50">
              <RotateCcw className="w-4 h-4" /> Reset to default
            </button>
            <Button onClick={handleSave} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 font-bold">
              <AnimatePresence mode="wait">
                {saved
                  ? <motion.span key="saved" initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Saved!</motion.span>
                  : <motion.span key="save" className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Settings</motion.span>
                }
              </AnimatePresence>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Info + Tabs */}
          <div className="lg:col-span-1 space-y-4">

            {/* User info */}
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center font-bold text-violet-700 dark:text-violet-400 text-lg">
                  {user?.name?.charAt(0).toUpperCase() || 'T'}
                </div>
                <div>
                  <p className="font-bold text-erp-text">{user?.name || 'Teacher'}</p>
                  <p className="text-xs text-erp-text/50 font-medium capitalize">{user?.role || 'Teacher'}</p>
                </div>
              </div>
              <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 rounded-xl p-3">
                <div className="flex gap-2">
                  <Info className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed font-medium">
                    This system prompt is used every time you click <strong>"Generate AI Slides"</strong> in the Teacher Studio. Use <code className="bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 px-1 rounded">{'{{title}}'}</code> and <code className="bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 px-1 rounded">{'{{description}}'}</code> as placeholders.
                  </p>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-erp-border/40 rounded-xl">
              {[
                { id: 'presets', label: 'Presets', icon: Palette },
                { id: 'prompt', label: 'Custom', icon: Sparkles },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === tab.id ? 'bg-white dark:bg-black shadow text-erp-text' : 'text-erp-text/50 hover:text-erp-text'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            {/* Presets list */}
            {activeTab === 'presets' && (
              <div className="space-y-2">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePreset(idx)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedPreset === idx
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                        : 'border-erp-border hover:border-violet-300 bg-white dark:bg-black'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{preset.icon}</span>
                        <div>
                          <p className="font-bold text-erp-text text-sm">{preset.label}</p>
                          <p className="text-xs text-erp-text/50 mt-0.5">{preset.description}</p>
                        </div>
                      </div>
                      {selectedPreset === idx
                        ? <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-erp-text/30 shrink-0" />
                      }
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Placeholder reference */}
            {activeTab === 'prompt' && (
              <Card className="p-4">
                <p className="text-xs font-bold text-erp-text/60 uppercase tracking-widest mb-3 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Available Placeholders</p>
                <div className="space-y-2">
                  {[
                    { code: '{{title}}', desc: 'The class/session title' },
                    { code: '{{description}}', desc: 'Class description (if set)' },
                  ].map(p => (
                    <div key={p.code} className="flex items-start gap-2">
                      <code className="bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 px-2 py-0.5 rounded text-xs font-mono font-bold shrink-0">{p.code}</code>
                      <span className="text-xs text-erp-text/60">{p.desc}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Prompt editor */}
          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col">
              <div className="p-5 border-b border-erp-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                  <h2 className="font-bold text-erp-text">AI System Prompt</h2>
                  {selectedPreset >= 0 && (
                    <span className="text-xs font-bold text-violet-700 dark:text-violet-200 bg-violet-100 dark:bg-violet-500/20 px-2 py-0.5 rounded-full">
                      {PRESETS[selectedPreset].icon} {PRESETS[selectedPreset].label}
                    </span>
                  )}
                </div>
                <span className="text-xs text-erp-text/40 font-mono">{prompt.length} chars</span>
              </div>
              <div className="flex-1 p-4">
                <textarea
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); setSelectedPreset(-1); }}
                  className="w-full h-full min-h-[500px] font-mono text-sm bg-slate-950 text-emerald-400 border border-slate-700 rounded-xl p-5 resize-none outline-none focus:border-violet-500 transition-colors leading-relaxed"
                  placeholder="Enter your system prompt..."
                  spellCheck={false}
                />
              </div>
              <div className="p-4 border-t border-erp-border bg-slate-50 dark:bg-zinc-900/50 rounded-b-xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-erp-text/40 font-medium">
                    Changes take effect the next time you generate slides in Teacher Studio
                  </p>
                  <Button onClick={handleSave} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 font-bold">
                    <Save className="w-4 h-4" />
                    {saved ? 'Saved!' : 'Save'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
