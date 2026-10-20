import React, { useState } from 'react';
import { Card } from '../../../components/ui/erp/Card';
import { Button } from '../../../components/ui/erp/Button';
import { Mic, Headphones, Cpu, Settings, Play, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AIVoiceSettings() {
  const navigate = useNavigate();
  const [sttProvider, setSttProvider] = useState('whisper-local');
  const [ttsProvider, setTtsProvider] = useState('kokoro');
  const [llmProvider, setLlmProvider] = useState('ollama');

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-32">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
              <Mic className="w-8 h-8 text-erp-primary" /> Self-Hosted AI Voice Stack
            </h1>
            <p className="text-erp-text/70 font-medium mt-1">Configure STT, TTS, and conversational models for AI Interviews</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/ceo/dashboard')}>
            Back to Hub
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* STT Configuration */}
          <Card>
            <div className="flex items-center gap-3 mb-6 border-b border-erp-border pb-4">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <Mic className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold font-display text-erp-text">Speech to Text</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Engine</label>
                <select 
                  className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-erp-text font-bold"
                  value={sttProvider}
                  onChange={(e) => setSttProvider(e.target.value)}
                >
                  <option value="whisper-local">Whisper (Local/Self-Hosted)</option>
                  <option value="whisper-api">OpenAI Whisper API</option>
                  <option value="deepgram">Deepgram Nova-2</option>
                </select>
              </div>

              {sttProvider === 'whisper-local' && (
                <div>
                  <label className="block text-sm font-bold text-erp-text/70 mb-1">Local Endpoint URL</label>
                  <input className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-erp-text" defaultValue="http://localhost:8000/v1/audio/transcriptions" />
                </div>
              )}
            </div>
          </Card>

          {/* LLM Configuration */}
          <Card>
            <div className="flex items-center gap-3 mb-6 border-b border-erp-border pb-4">
              <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                <Cpu className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold font-display text-erp-text">Conversational LLM</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Provider</label>
                <select 
                  className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-erp-text font-bold"
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value)}
                >
                  <option value="ollama">Ollama (Local/Llama 3)</option>
                  <option value="openrouter">OpenRouter API</option>
                  <option value="openai">OpenAI API</option>
                </select>
              </div>

              {llmProvider === 'ollama' && (
                <div>
                  <label className="block text-sm font-bold text-erp-text/70 mb-1">Ollama URL</label>
                  <input className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-erp-text" defaultValue="http://localhost:11434/api/chat" />
                </div>
              )}
            </div>
          </Card>

          {/* TTS Configuration */}
          <Card>
            <div className="flex items-center gap-3 mb-6 border-b border-erp-border pb-4">
              <div className="bg-green-100 p-2 rounded-lg text-green-700">
                <Headphones className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold font-display text-erp-text">Text to Speech</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Engine</label>
                <select 
                  className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-erp-text font-bold"
                  value={ttsProvider}
                  onChange={(e) => setTtsProvider(e.target.value)}
                >
                  <option value="kokoro">Kokoro TTS (Local)</option>
                  <option value="piper">Piper TTS (Local)</option>
                  <option value="coqui">Coqui TTS (Local)</option>
                  <option value="elevenlabs">ElevenLabs API</option>
                </select>
              </div>

              {(ttsProvider === 'kokoro' || ttsProvider === 'piper' || ttsProvider === 'coqui') && (
                <div>
                  <label className="block text-sm font-bold text-erp-text/70 mb-1">Local TTS URL</label>
                  <input className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-erp-text" defaultValue="http://localhost:5002/api/tts" />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Default Voice</label>
                <select className="w-full bg-erp-background border-2 border-erp-border rounded-xl p-3 text-erp-text font-bold">
                  <option>en_us_female_1</option>
                  <option>en_us_male_1</option>
                  <option>en_uk_female_1</option>
                </select>
              </div>
            </div>
          </Card>
        </div>

        <Card className="flex items-center justify-between bg-erp-surface">
          <div>
            <h3 className="font-bold text-lg text-erp-text">Test Pipeline</h3>
            <p className="text-sm text-erp-text/50">Run a quick test to ensure STT → LLM → TTS flow is working.</p>
          </div>
          <div className="flex gap-4">
            <Button variant="secondary" className="flex items-center gap-2">
              <Play className="w-4 h-4" /> Run Test
            </Button>
            <Button className="flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Configuration
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
