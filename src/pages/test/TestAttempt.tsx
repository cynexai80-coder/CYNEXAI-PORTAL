import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { batch1Questions, batch23Questions, AssessmentData } from '../../data/sqlAssessment';
import { submitSQLTest } from '../../lib/api/assessment';
import Editor from '@monaco-editor/react';
import { initSQLSandbox } from '../../lib/alasqlSandbox';
import { notify, confirmDialog } from '../../lib/feedback';

export default function TestAttempt() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('');
  const [batch, setBatch] = useState('');
  const [data, setData] = useState<AssessmentData | null>(null);
  const [db, setDb] = useState<any>(null);
  const [queryResults, setQueryResults] = useState<Record<string, { columns: string[], data: any[], error: string }>>({});
  
  const [activeSection, setActiveSection] = useState<'A' | 'B' | 'C'>('A');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
  
  useEffect(() => {
    const name = sessionStorage.getItem('test_student_name');
    const b = sessionStorage.getItem('test_batch');
    
    if (!name || !b) {
      navigate('/test');
      return;
    }
    
    setStudentName(name);
    setBatch(b);
    setData(b === '1' ? batch1Questions : batch23Questions);
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setDb(initSQLSandbox());

    return () => clearInterval(timer);
  }, [navigate]);

  const handleRunQuery = (qId: string) => {
    if (!db) return;
    const query = answers[qId];
    if (!query || !query.trim()) {
      setQueryResults(prev => ({ ...prev, [qId]: { columns: [], data: [], error: 'Please enter a SQL query first.' } }));
      return;
    }
    
    try {
      const res = db.exec(query);
      if (Array.isArray(res) && res.length > 0) {
        setQueryResults(prev => ({ 
          ...prev, 
          [qId]: { columns: Object.keys(res[0]), data: res, error: '' } 
        }));
      } else if (Array.isArray(res) && res.length === 0) {
        setQueryResults(prev => ({ 
          ...prev, 
          [qId]: { columns: [], data: [], error: 'Query executed successfully. 0 rows returned.' } 
        }));
      } else {
        // For updates, inserts, etc.
        setQueryResults(prev => ({ 
          ...prev, 
          [qId]: { columns: [], data: [], error: `Query executed successfully. Result: ${res}` } 
        }));
      }
    } catch (e: any) {
      setQueryResults(prev => ({ 
        ...prev, 
        [qId]: { columns: [], data: [], error: e.message || 'Syntax error or invalid query.' } 
      }));
    }
  };

  const handleAnswer = (qId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const calculateScore = () => {
    if (!data) return 0;
    let score = 0;
    data.mcqs.forEach(q => {
      if (answers[q.id] === q.answer) score++;
    });
    return score;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    
    const score = calculateScore();
    const res = await submitSQLTest(studentName, batch, score, answers);
    
    if (res.success) {
      sessionStorage.clear();
      notify("Test submitted successfully. Your responses have been recorded.");
      navigate('/');
    } else {
      notify("Error submitting test. Please contact invigilator.");
      setSubmitting(false);
    }
  };

  if (!data) return <div className="p-10 text-center">Loading Assessment...</div>;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-blue-900 text-white px-6 py-4 flex justify-between items-center shadow-md z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight">SQL Assessment Portal</h1>
          <p className="text-sm opacity-80 mt-1">Candidate: {studentName} | Batch: {batch}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="bg-blue-800 px-4 py-2 rounded border border-blue-700">
            <span className="text-sm uppercase tracking-wider opacity-70 block mb-1">Time Remaining</span>
            <span className="font-mono text-2xl font-bold">{formatTime(timeLeft)}</span>
          </div>
          <button 
            onClick={async () => {
              if (await confirmDialog({ title: 'Submit test', message: 'Are you sure you want to submit your test? This cannot be undone.', confirmLabel: 'Submit' })) {
                handleSubmit();
              }
            }}
            disabled={submitting}
            className="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-6 rounded shadow"
          >
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-64 bg-white border-r border-gray-300 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-gray-700 uppercase text-sm tracking-wider">Sections</h2>
          </div>
          <button 
            onClick={() => setActiveSection('A')}
            className={`p-4 text-left border-b border-gray-100 transition-colors ${activeSection === 'A' ? 'bg-blue-50 border-l-4 border-l-blue-600 font-semibold text-blue-800' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            Section A: MCQs ({data.mcqs.length})
          </button>
          <button 
            onClick={() => setActiveSection('B')}
            className={`p-4 text-left border-b border-gray-100 transition-colors ${activeSection === 'B' ? 'bg-blue-50 border-l-4 border-l-blue-600 font-semibold text-blue-800' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            Section B: Theory ({data.shortAnswers.length})
          </button>
          <button 
            onClick={() => setActiveSection('C')}
            className={`p-4 text-left border-b border-gray-100 transition-colors ${activeSection === 'C' ? 'bg-blue-50 border-l-4 border-l-blue-600 font-semibold text-blue-800' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            Section C: SQL Queries ({data.sqlQueries.length})
          </button>
          
          <div className="mt-auto p-4 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Ensure all sections are answered before submitting.
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-8 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            
            {activeSection === 'A' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800">Section A: Multiple Choice Questions</h2>
                  <p className="text-gray-600 mt-2">Select the most appropriate answer for each question.</p>
                </div>
                
                {data.mcqs.map((q, idx) => (
                  <div key={q.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <p className="font-semibold text-gray-800 mb-4"><span className="text-blue-600 mr-2">Q{idx + 1}.</span>{q.question}</p>
                    <div className="space-y-3 pl-6">
                      {q.options.map((opt, oIdx) => (
                        <label key={oIdx} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name={q.id} 
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={(e) => handleAnswer(q.id, e.target.value)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-gray-700 group-hover:text-blue-800">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'B' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800">Section B: Short Answers</h2>
                  <p className="text-gray-600 mt-2">Provide brief theoretical answers to the following questions.</p>
                </div>

                {data.shortAnswers.map((q, idx) => (
                  <div key={q.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <p className="font-semibold text-gray-800 mb-4"><span className="text-blue-600 mr-2">Q{data.mcqs.length + idx + 1}.</span>{q.question}</p>
                    <textarea 
                      className="w-full h-32 p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-y"
                      placeholder="Type your answer here..."
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                    ></textarea>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'C' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800">Section C: SQL Queries</h2>
                  <p className="text-gray-600 mt-2">Write SQL queries for the following requirements based on the schema below.</p>
                  
                  <div className="mt-6 space-y-6 bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
                    <h3 className="font-bold text-gray-700 uppercase text-sm tracking-wider border-b border-gray-300 pb-2 mb-4">Database Schema</h3>
                    <div>
                      <p className="font-semibold mb-2 text-sm text-gray-600">Table: POLICY_HOLDER</p>
                      <img src="/test_assets/policy_holder.png" alt="POLICY_HOLDER schema" className="max-w-full rounded border border-gray-300 shadow-sm" />
                    </div>
                    <div className="pt-4 border-t border-gray-200">
                      <p className="font-semibold mb-2 text-sm text-gray-600">Table: INSURANCE_CLAIMS</p>
                      <img src="/test_assets/insurance_claims.png" alt="INSURANCE_CLAIMS schema" className="max-w-full rounded border border-gray-300 shadow-sm" />
                    </div>
                  </div>
                </div>

                {data.sqlQueries.map((q, idx) => (
                  <div key={q.id} className="bg-white p-0 overflow-hidden rounded-lg shadow-sm border border-gray-200 flex flex-col">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-start gap-4">
                       <p className="font-semibold text-gray-800"><span className="text-blue-600 mr-2">Q{data.mcqs.length + data.shortAnswers.length + idx + 1}.</span>{q.question}</p>
                       {q.topic && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded whitespace-nowrap">{q.topic}</span>}
                    </div>
                    <div className="h-48 border-b border-gray-200 relative">
                      <Editor
                        height="100%"
                        defaultLanguage="sql"
                        theme="vs-dark"
                        value={answers[q.id] || ''}
                        onChange={(val) => handleAnswer(q.id, val || '')}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          wordWrap: 'on'
                        }}
                      />
                    </div>
                    <div className="p-3 bg-gray-100 flex justify-end border-b border-gray-200">
                      <button 
                        onClick={() => handleRunQuery(q.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-1.5 px-4 rounded shadow-sm flex items-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z" /></svg>
                        Run Query
                      </button>
                    </div>
                    {queryResults[q.id] && (
                      <div className="p-4 bg-white max-h-64 overflow-auto">
                        {queryResults[q.id].error ? (
                          <div className="text-red-700 font-mono text-sm p-3 bg-red-50 rounded border border-red-200">
                            {queryResults[q.id].error}
                          </div>
                        ) : queryResults[q.id].data.length === 0 ? (
                          <div className="text-gray-500 font-mono text-sm p-3 bg-gray-50 rounded border border-gray-200">
                            No data returned.
                          </div>
                        ) : (
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                {queryResults[q.id].columns.map(col => (
                                  <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {queryResults[q.id].data.map((row, rIdx) => (
                                <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  {queryResults[q.id].columns.map(col => (
                                    <td key={col} className="px-3 py-2 whitespace-nowrap text-gray-900 font-mono text-xs">{row[col] !== null ? String(row[col]) : 'NULL'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
