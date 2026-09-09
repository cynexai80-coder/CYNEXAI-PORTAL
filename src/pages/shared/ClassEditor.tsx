import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { FileVideo, Save, Youtube, FileText, Sparkles, Plus, PenTool, Video, CheckCircle, ArrowLeft, Link as LinkIcon, Loader2, Wand2, AlertCircle } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getClassDetails, getClassQuestions, updateClassMetadata, updateClassAiMaterials, createClassQuestion, deleteClassQuestion, getModuleDetails } from '../../lib/api/cms';
import { generateAIMaterials, generateAIQuestions } from '../../lib/aiGenerator';


export default function ClassEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  let basePath = '/ceo';
  if (location.pathname.startsWith('/manager')) basePath = '/manager';
  else if (location.pathname.startsWith('/teacher')) basePath = '/teacher';
  else if (location.pathname.startsWith('/sales')) basePath = '/sales';
  else if (location.pathname.startsWith('/dm')) basePath = '/dm';
  const { courseId, moduleId, classId } = useParams();

  const [classData, setClassData] = useState<any>(null);
  const [moduleData, setModuleData] = useState<any>(null);
  const [classTitle, setClassTitle] = useState('');
  const [classDescription, setClassDescription] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [meetLink, setMeetLink] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingQA, setGeneratingQA] = useState(false);
  const [aiStatus, setAiStatus] = useState({ ppt: false, script: false });
  const [docUrl, setDocUrl] = useState('');
  const [aiKeypoints, setAiKeypoints] = useState('');


  // Class Questions state
  const [questions, setQuestions] = useState<any[]>([]);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState<'mcq' | 'coding'>('mcq');
  const [newQOptions, setNewQOptions] = useState<string[]>(['', '', '', '']);
  const [newQCorrectIdx, setNewQCorrectIdx] = useState<number>(0);
  const [newQBoilerplate, setNewQBoilerplate] = useState('def solution():\n    # Write your code here\n    pass');
  const [newQTestCases, setNewQTestCases] = useState('[\n  {"input": "()", "expected": "True"}\n]');

  const [alertConfig, setAlertConfig] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertConfig({ message, type });
  };

  useEffect(() => {
    fetchClassData();
    fetchQuestions();
  }, [classId]);

  const fetchClassData = async () => {
    if (!classId) return;
    try {
      const data = await getClassDetails(classId as string);
      if (data) {
        setClassData(data);
        setClassTitle(data.title as string);
        setClassDescription(data.description as string || '');
        setYoutubeLink(data.youtube_video_id as string || '');
        setMeetLink(data.meet_link as string || '');
        setDocUrl(data.doc_url as string || '');
        setAiKeypoints(data.ai_keypoints as string || '');

        
        setAiStatus({
          ppt: !!data.ai_ppt_markdown,
          script: !!data.ai_script
        });
      }
      if (moduleId) {
        const mod = await getModuleDetails(moduleId as string);
        if (mod && mod.module) setModuleData(mod.module);
      }
    } catch (e) {
      console.error("Failed to fetch class data", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    if (!classId) return;
    try {
      const data = await getClassQuestions(classId as string);
      setQuestions(data);
    } catch (e) {
      console.error("Failed to fetch questions", e);
    }
  };

  const handleSave = async () => {
    if (!classId) return;
    if (!classDescription.trim()) {
      showAlert('Class Description is mandatory. Please provide a description before saving.', 'error');
      return;
    }
    try {
      await updateClassMetadata(classId as string, classTitle, classDescription, youtubeLink, meetLink, docUrl);
      if (aiKeypoints !== classData?.ai_keypoints) {
        await updateClassAiMaterials(classId as string, classData?.ai_ppt_markdown || '', aiKeypoints, classData?.ai_script || '', classData?.ai_study_guide || '');
        setClassData({ ...classData, ai_keypoints: aiKeypoints });
      }
      showAlert('Class saved successfully!', 'success');
      setTimeout(() => navigate(`${basePath}/courses/${courseId}/modules/${moduleId}`), 1000);
    } catch (e) {
      console.error('Error saving class', e);
      showAlert('Failed to save class.', 'error');
    }
  };


  const handleGenerateAI = async () => {
    if (!classDescription.trim()) {
      showAlert('Please add and save a class description first.', 'info');
      return;
    }
    setGenerating(true);
    try {
      const { ppt, keypoints, script, studyGuide } = await generateAIMaterials(classTitle, classDescription);
      await updateClassAiMaterials(classId as string, ppt, keypoints, script, studyGuide);
      setAiStatus({ ppt: true, script: true });
      setAiKeypoints(keypoints);
      setClassData({ ...classData, ai_ppt_markdown: ppt, ai_script: script, ai_keypoints: keypoints, ai_study_guide: studyGuide });
      showAlert('AI Materials generated and saved successfully!', 'success');
    } catch (error: any) {
      console.error(error);
      showAlert(error.message === 'QUOTA_EXCEEDED' ? 'AI quota exceeded. Try again later.' : (error.message || 'Failed to generate AI materials. Please try again.'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAIQuestions = async () => {
    if (!classId || !classTitle || !classDescription) { showAlert('Please enter a class title and description first.', 'info'); return; }
    if (!aiStatus.ppt || !aiKeypoints) { showAlert('Please generate AI Materials (Slides & Keypoints) first so the Q&A can be based on the exact topics taught.', 'info'); return; }
    setGeneratingQA(true);
    try {
      const hasCoding = moduleData ? moduleData.is_it_module === 1 : true;
      const qs = await generateAIQuestions(classTitle, classDescription, aiKeypoints, hasCoding);
      for (const q of qs) {
        const qId = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
        await createClassQuestion(
          qId, classId as string, q.type, q.question_text,
          q.type === 'mcq' ? JSON.stringify(q.options) : null,
          q.type === 'mcq' ? (q.correct_answer_idx ?? 0) : null,
          q.type === 'coding' ? JSON.stringify({ code: q.boilerplate }) : null,
          q.type === 'coding' ? (q.test_cases || null) : null
        );
      }
      await fetchQuestions();
      showAlert(`✅ ${qs.length} AI questions generated and saved!`, 'success');
    } catch (err: any) {
      if (err.message === 'QUOTA_EXCEEDED') showAlert('AI quota exceeded. Try again later.', 'error');
      else showAlert('Failed to generate AI questions.', 'error');
      console.error(err);
    } finally {
      setGeneratingQA(false);
    }
  };


  const handleAddQuestion = async () => {
    if (!classId || !newQText) return;
    const questionId = 'q_' + Date.now();
    try {
      await createClassQuestion(
        questionId,
        classId as string,
        newQType,
        newQText,
        newQType === 'mcq' ? JSON.stringify(newQOptions) : null,
        newQType === 'mcq' ? newQCorrectIdx : null,
        newQType === 'coding' ? JSON.stringify({ code: newQBoilerplate }) : null,
        newQType === 'coding' ? newQTestCases : null
      );
      setNewQText('');
      setNewQOptions(['', '', '', '']);
      setNewQCorrectIdx(0);
      await fetchQuestions();
      showAlert("Add-on question created!", 'success');
    } catch (e) {
      console.error(e);
      showAlert("Failed to add question.", 'error');
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (confirm("Delete this question?")) {
      try {
        await deleteClassQuestion(qId);
        await fetchQuestions();
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (loading) return <div className="p-8 text-erp-text">Loading class data...</div>;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-16 sm:pb-24 p-4 md:p-8 bg-erp-background">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-erp-text/50 font-bold mb-2 cursor-pointer hover:text-indigo-400" onClick={() => navigate(`${basePath}/courses/${courseId}/modules/${moduleId}`)}>
            <ArrowLeft className="w-4 h-4" /> Back to Module
          </div>
          <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
            <FileVideo className="w-8 h-8 text-indigo-500" /> Edit Class 
          </h1>
        </div>
        <Button onClick={handleSave} variant="primary" className="flex items-center gap-2"><Save className="w-4 h-4"/> Save Class</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Editor */}
        <div className="lg:col-span-2 space-y-6">
          
          <Card className="bg-erp-surface border-erp-border p-6">
            <h2 className="text-xl font-bold font-display text-erp-text mb-4">Class Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Class Title</label>
                <input type="text" value={classTitle} onChange={e => setClassTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1">Class Description / Topics (Mandatory)</label>
                <textarea rows={3} value={classDescription} onChange={e => setClassDescription(e.target.value)} placeholder="Describe what will be taught. AI uses this to generate slides." className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-green-500" /> Jitsi / Google Meet Link (Live Broadcast)
                </label>
                <input type="url" placeholder="https://meet.google.com/abc-defg-hij" value={meetLink} onChange={(e) => setMeetLink(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1 flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500" /> YouTube Link of Completed Class (Recording URL)
                </label>
                <input type="url" value={youtubeLink} onChange={(e) => setYoutubeLink(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-erp-text/70 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" /> Class Notes / Document URL (PDF, Google Doc, etc.)
                </label>
                <input type="url" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://docs.google.com/..." className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" />
              </div>

            </div>
          </Card>

          {/* Add-ons: Quizzes & Coding Challenges */}
          <Card className="bg-erp-surface border-erp-border p-6">
            <h2 className="text-xl font-bold font-display text-erp-text mb-6">Class Add-ons: Quizzes & Code Exercises</h2>
            
            {/* List existing questions */}
            <div className="space-y-3 mb-6">
              {questions.length === 0 ? (
                <p className="text-sm text-erp-text/50">No quizzes or coding challenges configured for this class yet.</p>
              ) : (
                questions.map((q, idx) => (
                  <div key={q.id} className="flex justify-between items-start bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mr-2 ${q.type === 'mcq' ? 'bg-blue-900/40 text-blue-400 border border-blue-800/40' : 'bg-green-900/40 text-green-400 border border-green-800/40'}`}>
                        {q.type}
                      </span>
                      <p className="text-sm font-bold text-white mt-2">Q{idx + 1}: {q.question_text}</p>
                    </div>
                    <Button variant="danger" className="h-7 px-2 text-xs" onClick={() => handleDeleteQuestion(q.id)}>Delete</Button>
                  </div>
                ))
              )}
            </div>

            {/* Create form */}
            <div className="border-t border-slate-800 pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-erp-text text-sm uppercase tracking-wide">Configure New Add-on</h3>
                <Button
                  onClick={handleGenerateAIQuestions}
                  disabled={generatingQA || !classTitle}
                  className="bg-purple-600 hover:bg-purple-500 flex items-center gap-2 text-xs h-8 border-none"
                >
                  {generatingQA
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating Q&A...</>
                    : <><Wand2 className="w-3.5 h-3.5" /> Generate Q&A with AI</>}
                </Button>
              </div>

              
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" checked={newQType === 'mcq'} onChange={() => setNewQType('mcq')} className="accent-indigo-500" />
                  Multiple Choice (MCQ Quiz)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" checked={newQType === 'coding'} onChange={() => setNewQType('coding')} className="accent-indigo-500" />
                  Coding Editor Question
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-erp-text/60 mb-1">Question / Prompt Text</label>
                <textarea rows={2} value={newQText} onChange={e => setNewQText(e.target.value)} placeholder="e.g. Write a python function to reverse a string" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>

              {newQType === 'mcq' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-erp-text/60">Options & Answer Key</label>
                  {newQOptions.map((opt, oIdx) => (
                    <div key={oIdx} className="flex gap-2 items-center">
                      <input type="radio" name="correct_answer" checked={newQCorrectIdx === oIdx} onChange={() => setNewQCorrectIdx(oIdx)} className="accent-indigo-500" />
                      <input type="text" value={opt} onChange={e => {
                        const newOpts = [...newQOptions];
                        newOpts[oIdx] = e.target.value;
                        setNewQOptions(newOpts);
                      }} placeholder={`Option ${oIdx + 1}`} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-erp-text/60 mb-1">Boilerplate Template Code</label>
                    <textarea rows={6} value={newQBoilerplate} onChange={e => setNewQBoilerplate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-green-400 font-mono text-xs focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-erp-text/60 mb-1">Validation Test Cases (JSON format)</label>
                    <textarea rows={6} value={newQTestCases} onChange={e => setNewQTestCases(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-yellow-400 font-mono text-xs focus:outline-none resize-none" />
                  </div>
                </div>
              )}

              <Button onClick={handleAddQuestion} disabled={!newQText} className="bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2 text-xs h-9">
                <Plus className="w-4 h-4" /> Add Add-on to Class
              </Button>
            </div>
          </Card>
        </div>

        {/* AI Materials Generator */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-indigo-900 to-purple-900 border-none text-white sticky top-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-indigo-300" />
              <h2 className="text-xl font-bold font-display">AI Material Prep</h2>
            </div>
            <p className="text-indigo-200 text-sm mb-6">Generate teaching materials based on the Class Title before assigning to a Teacher.</p>
            
            <div className="space-y-4">
              <Button 
                onClick={handleGenerateAI} 
                disabled={generating}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold flex justify-center gap-2 border-none"
              >
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate All Materials</>}
              </Button>

              <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold flex items-center gap-2"><Video className="w-4 h-4 text-blue-300" /> Presentation (PPT)</h3>
                  {aiStatus.ppt ? <CheckCircle className="w-4 h-4 text-green-400" /> : <div className="w-4 h-4 rounded-full border-2 border-white/30" />}
                </div>
                <p className="text-xs text-indigo-200 mb-3">{aiStatus.ppt ? 'Slides generated for teacher Live Dashboard.' : 'Pending generation.'}</p>
              </div>

              <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold flex items-center gap-2"><PenTool className="w-4 h-4 text-purple-300" /> Teacher Script & Keypoints</h3>
                  {aiStatus.script ? <CheckCircle className="w-4 h-4 text-green-400" /> : <div className="w-4 h-4 rounded-full border-2 border-white/30" />}
                </div>
                <p className="text-xs text-indigo-200 mb-3">{aiStatus.script ? 'Full teleprompter script + regional examples (Hyderabad).' : 'Pending generation.'}</p>
                {aiKeypoints && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <label className="block text-xs font-bold text-white mb-2">Edit Keypoints (Used for Q&A Generation)</label>
                    <textarea 
                      rows={6}
                      value={aiKeypoints}
                      onChange={e => setAiKeypoints(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-xs focus:outline-none focus:border-indigo-400 resize-none custom-scrollbar"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <Button onClick={handleSave} className="w-full bg-green-500 hover:bg-green-400 text-white font-bold flex justify-center gap-2 border-none">
                <Save className="w-4 h-4" /> Save & Approve Class
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Custom Alert Modal */}
      {alertConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl shrink-0 ${
                alertConfig.type === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400' :
                alertConfig.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
              }`}>
                {alertConfig.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <div className="flex-1 mt-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                  {alertConfig.type === 'success' ? 'Success' : alertConfig.type === 'error' ? 'Error' : 'Notice'}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm font-medium">
                  {alertConfig.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setAlertConfig(null)} className="px-6 py-2">
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
