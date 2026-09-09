import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/erp/Card';
import { Button } from '../../../components/ui/erp/Button';
import {
  BarChart3, TrendingUp, MousePointerClick, Calendar, Key, AlertCircle, Layout, Save,
  CheckSquare, Plus, CheckCircle, Video, Search, Edit, Trash2, Briefcase, Sparkles,
  FileText, Upload, RefreshCw, X, Copy, ExternalLink, Globe, Eye, EyeOff, Tag
} from 'lucide-react';
import { AttendanceButton } from '../../../components/ui/AttendanceButton';
import { useNavigate } from 'react-router-dom';
import {
  getMarketingMetrics, getMarketingCampaigns, createMarketingCampaign,
  updateMarketingCampaign, deleteMarketingCampaign, updateMarketingMetric,
  MarketingCampaign, MarketingMetric
} from '../../../lib/api/marketing';
import {
  getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost, BlogPost,
  getScrapedJobs, createJob, deleteJob, triggerJobScraper, JobItem,
  getAISuggestions, getSEOKeywords, addSEOKeyword, deleteSEOKeyword,
  getSEOSettings, updateSEOSettings
} from '../../../lib/api/dm';

type Tab = 'dashboard' | 'blog' | 'jobs' | 'ai' | 'seo';

export default function DMDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);

  // Data States
  const [metrics, setMetrics] = useState<MarketingMetric[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [seoSettings, setSeoSettingsState] = useState<any>({
    metaTitle: '',
    metaDescription: '',
    canonicalUrl: '',
    ogImage: ''
  });

  // Modal & Form States
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({ name: '', platform: 'Meta', budget: 1000, spent: 0, leads: 0, status: 'Active' });

  const [showSpendModal, setShowSpendModal] = useState(false);
  const [spendForm, setSpendForm] = useState({ platform: 'Meta', spend: 5000, traffic: 1200, leads: 15 });

  const [showBlogModal, setShowBlogModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [blogForm, setBlogForm] = useState({ title: '', category: 'General', content: '', image: '', isVisible: true });

  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState({ title: '', company: '', location: '', qualifications: '', source_url: '', expire_date: '' });

  const [aiTopic, setAiTopic] = useState('Generative AI & Data Science');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const initAllData = async () => {
      try {
        setLoading(true);
        const [m, c, posts, jobList, kw, seo, aiList] = await Promise.all([
          getMarketingMetrics(),
          getMarketingCampaigns(),
          getBlogPosts(),
          getScrapedJobs(),
          getSEOKeywords(),
          getSEOSettings(),
          getAISuggestions(aiTopic)
        ]);
        setMetrics(m);
        setCampaigns(c);
        setBlogPosts(posts);
        setJobs(jobList);
        setKeywords(kw);
        setSeoSettingsState(seo);
        setSuggestions(aiList);
      } catch (e) {
        console.error('Error prefetching marketing data', e);
      } finally {
        setLoading(false);
      }
    };
    initAllData();
  }, []);

  const fetchData = async () => {
    try {
      if (activeTab === 'dashboard') {
        const [m, c] = await Promise.all([getMarketingMetrics(), getMarketingCampaigns()]);
        setMetrics(m);
        setCampaigns(c);
      } else if (activeTab === 'blog') {
        setBlogPosts(await getBlogPosts());
      } else if (activeTab === 'jobs') {
        setJobs(await getScrapedJobs());
      } else if (activeTab === 'ai') {
        setSuggestions(await getAISuggestions(aiTopic));
      } else if (activeTab === 'seo') {
        const [kw, seo] = await Promise.all([getSEOKeywords(), getSEOSettings()]);
        setKeywords(kw);
        setSeoSettingsState(seo);
      }
    } catch (e) {
      console.error('Error refreshing tab data', e);
    }
  };

  const getMetric = (platform: string) => metrics.find(m => m.platform === platform);

  // ── Campaign Handlers ─────────────────────────────────────────────────────
  const handleOpenNewCampaign = () => {
    setEditingCampaign(null);
    setCampaignForm({ name: '', platform: 'Meta', budget: 2000, spent: 0, leads: 0, status: 'Active' });
    setShowCampaignModal(true);
  };

  const handleOpenEditCampaign = (camp: MarketingCampaign, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCampaign(camp);
    setCampaignForm({
      name: camp.name,
      platform: camp.platform || 'Meta',
      budget: camp.budget || 0,
      spent: camp.spent || 0,
      leads: camp.leads || 0,
      status: camp.status || 'Active'
    });
    setShowCampaignModal(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignForm.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingCampaign) {
        await updateMarketingCampaign(editingCampaign.id, campaignForm);
      } else {
        await createMarketingCampaign(campaignForm);
      }
      setShowCampaignModal(false);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCampaign = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete campaign "${name}"?`)) {
      await deleteMarketingCampaign(id);
      fetchData();
    }
  };

  const handleSaveSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateMarketingMetric(spendForm.platform, Number(spendForm.spend), Number(spendForm.traffic), Number(spendForm.leads));
      setShowSpendModal(false);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  // ── Blog Handlers ──────────────────────────────────────────────────────────
  const handleOpenNewBlog = () => {
    setEditingBlog(null);
    setBlogForm({ title: '', category: 'Web Development', content: '', image: '', isVisible: true });
    setShowBlogModal(true);
  };

  const handleOpenEditBlog = (post: BlogPost) => {
    setEditingBlog(post);
    setBlogForm({
      title: post.title,
      category: post.category || 'General',
      content: post.content,
      image: post.image || '',
      isVisible: post.isVisible
    });
    setShowBlogModal(true);
  };

  const handleSaveBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blogForm.title.trim() || !blogForm.content.trim()) return;
    setSubmitting(true);
    try {
      if (editingBlog) {
        await updateBlogPost(editingBlog.id, blogForm);
      } else {
        await createBlogPost(blogForm);
      }
      setShowBlogModal(false);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBlog = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete post "${title}"?`)) {
      await deleteBlogPost(id);
      fetchData();
    }
  };

  const handleToggleBlogVisibility = async (post: BlogPost) => {
    await updateBlogPost(post.id, { isVisible: !post.isVisible });
    fetchData();
  };

  // ── Job Scraper Handlers ──────────────────────────────────────────────────
  const handleTriggerScraper = async (source: string) => {
    setLoading(true);
    await triggerJobScraper(source);
    await fetchData();
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobForm.title.trim() || !jobForm.company.trim()) return;
    setSubmitting(true);
    try {
      await createJob(jobForm);
      setShowJobModal(false);
      setJobForm({ title: '', company: '', location: '', qualifications: '', source_url: '', expire_date: '' });
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to remove job listing "${title}"?`)) {
      await deleteJob(id);
      fetchData();
    }
  };

  // ── AI Handlers ────────────────────────────────────────────────────────────
  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    const newSuggestions = await getAISuggestions(aiTopic);
    setSuggestions(newSuggestions);
    setIsGeneratingAI(false);
  };

  const handleCopySuggestion = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveAISuggestionAsBlog = async (item: any) => {
    await createBlogPost({
      title: item.title,
      category: 'AI Generated',
      content: item.description,
      isVisible: true
    });
    alert(`Saved "${item.title}" as a Blog Post Draft!`);
    if (activeTab === 'blog') fetchData();
  };

  // ── SEO Handlers ───────────────────────────────────────────────────────────
  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywordInput.trim()) return;
    const updated = await addSEOKeyword(newKeywordInput);
    setKeywords(updated);
    setNewKeywordInput('');
  };

  const handleDeleteKeyword = async (kw: string) => {
    const updated = await deleteSEOKeyword(kw);
    setKeywords(updated);
  };

  const handleSaveSeoSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateSEOSettings(seoSettings);
      alert('SEO Meta Settings saved successfully!');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Tabs Navigation ────────────────────────────────────────────────────────
  const renderTabs = () => (
    <div className="flex gap-2 mb-6 overflow-x-auto py-2.5 px-1 border-b border-erp-border no-scrollbar items-center min-h-[54px]">
      {[
        { id: 'dashboard', label: 'Dashboard', icon: <Layout className="w-4 h-4" /> },
        { id: 'blog', label: `Blog Manager (${blogPosts.length})`, icon: <FileText className="w-4 h-4" /> },
        { id: 'jobs', label: `Job Scraper (${jobs.length})`, icon: <Briefcase className="w-4 h-4" /> },
        { id: 'ai', label: 'AI Content', icon: <Sparkles className="w-4 h-4 text-amber-500" /> },
        { id: 'seo', label: 'SEO Settings', icon: <Search className="w-4 h-4" /> },
      ].map(t => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id as Tab)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap shrink-0 shadow-sm ${
            activeTab === t.id
              ? 'bg-erp-primary text-white shadow-md ring-2 ring-erp-primary/30'
              : 'text-erp-text/70 hover:text-erp-text hover:bg-erp-surface border border-erp-border/60'
          }`}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );

  // ── Render Views ───────────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold text-erp-text">Ad Performance Overview</h2>
        <Button onClick={() => setShowSpendModal(true)} variant="outline" className="text-xs flex items-center gap-1.5">
          <Edit className="w-3.5 h-3.5" /> Record Ad Spend
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex flex-col border-l-4 border-blue-500 p-5 bg-white dark:bg-black border-2 border-erp-border rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Meta Ads Spend</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-display font-black text-erp-text">₹{getMetric('Meta')?.spend?.toLocaleString() || 0}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              {getMetric('Meta')?.leads_generated || 0} leads
            </span>
          </div>
        </Card>

        <Card className="flex flex-col border-l-4 border-red-500 p-5 bg-white dark:bg-black border-2 border-erp-border rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Google Ads Spend</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-display font-black text-erp-text">₹{getMetric('Google')?.spend?.toLocaleString() || 0}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              {getMetric('Google')?.leads_generated || 0} leads
            </span>
          </div>
        </Card>

        <Card className="flex flex-col border-l-4 border-emerald-500 p-5 bg-white dark:bg-black border-2 border-erp-border rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Website Traffic</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-display font-black text-erp-text">{getMetric('Website')?.traffic?.toLocaleString() || 0}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              Organic Visits
            </span>
          </div>
        </Card>
      </div>

      {/* Campaigns Section */}
      <div className="flex justify-between items-center pt-4 border-t border-erp-border">
        <div>
          <h2 className="text-xl font-display font-bold text-erp-text">Active Marketing Campaigns</h2>
          <p className="text-xs text-erp-text/50 font-medium">Track lead generation campaigns across Meta & Google Ads</p>
        </div>
        <Button onClick={handleOpenNewCampaign} className="flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" /> New Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {campaigns.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-erp-border rounded-2xl text-erp-text/50 font-bold text-sm">
            No marketing campaigns active yet. Click "+ New Campaign" to launch one.
          </div>
        ) : (
          campaigns.map((camp: MarketingCampaign) => (
            <Card key={camp.id} className="flex items-center justify-between p-4 bg-white dark:bg-black border-2 border-erp-border rounded-2xl hover:border-erp-primary transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-3.5 rounded-xl ${camp.platform === 'Meta' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'}`}>
                  {camp.platform === 'Meta' ? <BarChart3 className="w-6 h-6" /> : <MousePointerClick className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-erp-text">{camp.name}</h3>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${camp.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:text-emerald-400 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {camp.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-erp-text/50 mt-1">
                    Daily Budget: ₹{camp.budget?.toLocaleString()} • Spent: ₹{camp.spent?.toLocaleString()} • Leads Generated: {camp.leads || 0}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleOpenEditCampaign(camp, e)}
                  className="p-2 text-erp-text/40 hover:text-erp-primary hover:bg-erp-surface rounded-lg transition-colors"
                  title="Edit Campaign"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteCampaign(camp.id, camp.name, e)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  title="Delete Campaign"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  const renderBlog = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-display font-bold text-erp-text">Blog Posts & Articles</h2>
          <p className="text-xs text-erp-text/50 font-medium">Manage published blog posts, drafts, and categories</p>
        </div>
        <Button onClick={handleOpenNewBlog} className="flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" /> New Post
        </Button>
      </div>

      <div className="grid gap-4">
        {blogPosts.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-erp-border rounded-2xl text-erp-text/50 font-bold text-sm">
            No blog posts published yet. Click "+ New Post" to write one.
          </div>
        ) : (
          blogPosts.map(post => (
            <Card key={post.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-black border-2 border-erp-border rounded-2xl hover:border-erp-primary transition-all gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">
                    {post.category || 'General'}
                  </span>
                  <span className="text-xs text-erp-text/40 font-semibold">{post.date}</span>
                  {!post.isVisible && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">
                      Hidden / Draft
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base text-erp-text">{post.title}</h3>
                <p className="text-xs text-erp-text/60 line-clamp-2 mt-1 font-medium">{post.content}</p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => handleToggleBlogVisibility(post)}
                  className={`p-2 rounded-lg border transition-colors ${post.isVisible ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                  title={post.isVisible ? 'Visible (Click to Hide)' : 'Hidden (Click to Publish)'}
                >
                  {post.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <Button variant="ghost" onClick={() => handleOpenEditBlog(post)} className="px-3 py-1.5 text-xs flex items-center gap-1">
                  <Edit className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button variant="danger" onClick={() => handleDeleteBlog(post.id, post.title)} className="px-3 py-1.5 text-xs flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  const renderJobs = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-erp-text">Scraped Jobs & Opportunities</h2>
          <p className="text-xs text-erp-text/50 font-medium">Job listings fetched from placement partners & LinkedIn scraper</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleTriggerScraper('linkedin')} className="flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Trigger LinkedIn Scraper
          </Button>
          <Button onClick={() => setShowJobModal(true)} className="flex items-center gap-1.5 text-xs">
            <Plus className="w-4 h-4" /> Add Job
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {jobs.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-erp-border rounded-2xl text-erp-text/50 font-bold text-sm">
            No scraped jobs recorded. Click "Trigger LinkedIn Scraper" or "+ Add Job".
          </div>
        ) : (
          jobs.map(job => (
            <Card key={job.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-black border-2 border-erp-border rounded-2xl hover:border-erp-primary transition-all gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 border border-sky-500/20">
                    {job.company}
                  </span>
                  {job.location && (
                    <span className="text-xs text-erp-text/40 font-semibold">• {job.location}</span>
                  )}
                </div>
                <h3 className="font-bold text-base text-erp-text">{job.title}</h3>
                {job.qualifications && (
                  <p className="text-xs text-erp-text/60 mt-1 font-medium">Skills: {job.qualifications}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {job.source_url && (
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-erp-text/50 hover:text-erp-primary border border-erp-border rounded-lg transition-colors"
                    title="View Source Link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <Button variant="danger" onClick={() => handleDeleteJob(job.id, job.title)} className="px-3 py-1.5 text-xs flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  const renderAI = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-black p-4 border-2 border-erp-border rounded-2xl">
        <div className="flex-1">
          <label className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider block mb-1">Target Niche / Topic</label>
          <input
            type="text"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="e.g., Data Science, Full Stack Java, AI..."
            className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none focus:border-erp-primary"
          />
        </div>
        <Button onClick={handleGenerateAI} disabled={isGeneratingAI} className="flex items-center gap-2 self-end sm:self-auto text-xs py-2.5">
          <Sparkles className="w-4 h-4" /> {isGeneratingAI ? 'Generating...' : 'Generate Content Ideas'}
        </Button>
      </div>

      <div className="grid gap-4">
        {suggestions.map((s, i) => (
          <Card key={i} className="p-5 bg-white dark:bg-black border-2 border-erp-border rounded-2xl border-l-4 border-l-indigo-500 hover:border-indigo-500 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                {s.category || 'AI Suggestion'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopySuggestion(`${s.title}\n\n${s.description}`, i)}
                  className="flex items-center gap-1 text-xs font-bold text-erp-text/60 hover:text-erp-primary px-2.5 py-1 rounded-lg border border-erp-border hover:bg-erp-surface"
                >
                  <Copy className="w-3.5 h-3.5" /> {copiedIndex === i ? 'Copied!' : 'Copy Idea'}
                </button>
                <button
                  onClick={() => handleSaveAISuggestionAsBlog(s)}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200"
                >
                  <Plus className="w-3.5 h-3.5" /> Save as Blog Draft
                </button>
              </div>
            </div>
            <h3 className="font-bold text-base text-erp-text">{s.title}</h3>
            <p className="text-xs text-erp-text/70 leading-relaxed font-medium">{s.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderSEO = () => (
    <div className="space-y-6">
      {/* Target Keywords */}
      <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-display font-bold text-erp-text">SEO Target Keywords</h2>
        <form onSubmit={handleAddKeyword} className="flex gap-2">
          <input
            type="text"
            value={newKeywordInput}
            onChange={(e) => setNewKeywordInput(e.target.value)}
            placeholder="Add new target keyword..."
            className="flex-1 bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none focus:border-erp-primary"
          />
          <Button type="submit" className="flex items-center gap-1.5 text-xs">
            <Plus className="w-4 h-4" /> Add Keyword
          </Button>
        </form>

        <div className="flex flex-wrap gap-2 pt-2">
          {keywords.map((kw, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-erp-surface rounded-xl text-xs font-extrabold text-erp-text border border-erp-border group">
              <Tag className="w-3 h-3 text-erp-primary" />
              <span>{kw}</span>
              <button onClick={() => handleDeleteKeyword(kw)} className="text-erp-text/40 hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Meta Tags Configuration */}
      <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-display font-bold text-erp-text">Website Meta Tags Configuration</h2>
        <form onSubmit={handleSaveSeoSettings} className="space-y-4">
          <div>
            <label className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider block mb-1">Meta Title</label>
            <input
              type="text"
              value={seoSettings.metaTitle || ''}
              onChange={(e) => setSeoSettingsState({ ...seoSettings, metaTitle: e.target.value })}
              className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none focus:border-erp-primary"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider block mb-1">Meta Description</label>
            <textarea
              rows={3}
              value={seoSettings.metaDescription || ''}
              onChange={(e) => setSeoSettingsState({ ...seoSettings, metaDescription: e.target.value })}
              className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-medium text-erp-text outline-none focus:border-erp-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider block mb-1">Canonical URL</label>
              <input
                type="text"
                value={seoSettings.canonicalUrl || ''}
                onChange={(e) => setSeoSettingsState({ ...seoSettings, canonicalUrl: e.target.value })}
                className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none focus:border-erp-primary"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider block mb-1">OG Banner Image URL</label>
              <input
                type="text"
                value={seoSettings.ogImage || ''}
                onChange={(e) => setSeoSettingsState({ ...seoSettings, ogImage: e.target.value })}
                className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none focus:border-erp-primary"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={submitting} className="flex items-center gap-1.5 text-xs">
              <Save className="w-4 h-4" /> {submitting ? 'Saving...' : 'Save Meta Settings'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-erp-border pb-5">
          <div>
            <AttendanceButton />
            <h1 className="text-2xl md:text-3xl font-display font-extrabold text-erp-text mt-3">Marketing Hub</h1>
            <p className="text-xs md:text-sm font-medium text-erp-text/60 mt-0.5">Manage Ads, Content, Job Listings, and SEO Optimization</p>
          </div>
        </div>

        {renderTabs()}

        {loading ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-erp-primary animate-spin" />
            <p className="text-sm font-bold text-erp-text/60">Loading Marketing Portal...</p>
          </div>
        ) : (
          <div>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'blog' && renderBlog()}
            {activeTab === 'jobs' && renderJobs()}
            {activeTab === 'ai' && renderAI()}
            {activeTab === 'seo' && renderSEO()}
          </div>
        )}
      </div>

      {/* ── MODAL: Campaign Modal ───────────────────────────────────────────── */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-erp-background border-2 border-erp-border rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-erp-border bg-erp-surface">
              <h3 className="font-display font-bold text-base text-erp-text">
                {editingCampaign ? 'Edit Marketing Campaign' : 'New Marketing Campaign'}
              </h3>
              <button onClick={() => setShowCampaignModal(false)} className="p-1 text-erp-text/40 hover:text-erp-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCampaign} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  placeholder="e.g., Full Stack Java Fall Batch"
                  className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none focus:border-erp-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Platform</label>
                  <select
                    value={campaignForm.platform}
                    onChange={(e) => setCampaignForm({ ...campaignForm, platform: e.target.value })}
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  >
                    <option value="Meta">Meta Ads</option>
                    <option value="Google">Google Ads</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Status</label>
                  <select
                    value={campaignForm.status}
                    onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value })}
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Daily Budget (₹)</label>
                  <input
                    type="number"
                    value={campaignForm.budget}
                    onChange={(e) => setCampaignForm({ ...campaignForm, budget: Number(e.target.value) })}
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Total Spent (₹)</label>
                  <input
                    type="number"
                    value={campaignForm.spent}
                    onChange={(e) => setCampaignForm({ ...campaignForm, spent: Number(e.target.value) })}
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Leads</label>
                  <input
                    type="number"
                    value={campaignForm.leads}
                    onChange={(e) => setCampaignForm({ ...campaignForm, leads: Number(e.target.value) })}
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCampaignModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingCampaign ? 'Save Changes' : 'Create Campaign')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Record Ad Spend Modal ───────────────────────────────────── */}
      {showSpendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-erp-background border-2 border-erp-border rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-erp-border bg-erp-surface">
              <h3 className="font-display font-bold text-base text-erp-text">Record Ad Spend Metrics</h3>
              <button onClick={() => setShowSpendModal(false)} className="p-1 text-erp-text/40 hover:text-erp-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSpend} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Platform</label>
                <select
                  value={spendForm.platform}
                  onChange={(e) => setSpendForm({ ...spendForm, platform: e.target.value })}
                  className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                >
                  <option value="Meta">Meta Ads</option>
                  <option value="Google">Google Ads</option>
                  <option value="Website">Website Traffic</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Total Spend (₹)</label>
                  <input
                    type="number"
                    value={spendForm.spend}
                    onChange={(e) => setSpendForm({ ...spendForm, spend: Number(e.target.value) })}
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Traffic / Clicks</label>
                  <input
                    type="number"
                    value={spendForm.traffic}
                    onChange={(e) => setSpendForm({ ...spendForm, traffic: Number(e.target.value) })}
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Leads</label>
                  <input
                    type="number"
                    value={spendForm.leads}
                    onChange={(e) => setSpendForm({ ...spendForm, leads: Number(e.target.value) })}
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowSpendModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Update Metric'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Blog Post Modal ─────────────────────────────────────────── */}
      {showBlogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-erp-background border-2 border-erp-border rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-erp-border bg-erp-surface">
              <h3 className="font-display font-bold text-base text-erp-text">
                {editingBlog ? 'Edit Blog Post' : 'New Blog Post'}
              </h3>
              <button onClick={() => setShowBlogModal(false)} className="p-1 text-erp-text/40 hover:text-erp-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveBlog} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={blogForm.title}
                  onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                  placeholder="e.g., Master Data Science in 2026"
                  className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none focus:border-erp-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Category</label>
                <select
                  value={blogForm.category}
                  onChange={(e) => setBlogForm({ ...blogForm, category: e.target.value })}
                  className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                >
                  <option value="Web Development">Web Development</option>
                  <option value="Artificial Intelligence">Artificial Intelligence</option>
                  <option value="Data Science">Data Science</option>
                  <option value="DevOps & Cloud">DevOps & Cloud</option>
                  <option value="Career & Placement">Career & Placement</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Content Summary</label>
                <textarea
                  rows={4}
                  required
                  value={blogForm.content}
                  onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                  placeholder="Write post summary or full content markdown..."
                  className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-medium text-erp-text outline-none focus:border-erp-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-erp-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blogForm.isVisible}
                    onChange={(e) => setBlogForm({ ...blogForm, isVisible: e.target.checked })}
                    className="w-4 h-4 rounded text-erp-primary"
                  />
                  Publish Post Immediately
                </label>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowBlogModal(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : (editingBlog ? 'Save Changes' : 'Create Post')}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Job Posting Modal ────────────────────────────────────────── */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-erp-background border-2 border-erp-border rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-erp-border bg-erp-surface">
              <h3 className="font-display font-bold text-base text-erp-text">Add Job Opportunity</h3>
              <button onClick={() => setShowJobModal(false)} className="p-1 text-erp-text/40 hover:text-erp-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveJob} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  placeholder="e.g., Python Developer"
                  className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none focus:border-erp-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Company</label>
                <input
                  type="text"
                  required
                  value={jobForm.company}
                  onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })}
                  placeholder="e.g., CynexAI Partner"
                  className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Location</label>
                  <input
                    type="text"
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    placeholder="Hyderabad / Remote"
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-erp-text/70 uppercase block mb-1">Qualifications</label>
                  <input
                    type="text"
                    value={jobForm.qualifications}
                    onChange={(e) => setJobForm({ ...jobForm, qualifications: e.target.value })}
                    placeholder="Python, SQL, React"
                    className="w-full bg-erp-surface border-2 border-erp-border rounded-xl px-3 py-2 text-xs font-bold text-erp-text outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowJobModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Add Job Listing'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
