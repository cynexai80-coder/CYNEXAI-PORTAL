import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { confirmDialog } from '../lib/feedback';

interface DiagResult {
  success?: boolean;
  latency?: string | number;
  tables?: string[];
  counts?: Record<string, number>;
  message?: string;
}
import {
  Plus,
  Search,
  Edit2,
  Eye,
  EyeOff,
  Trash2,
  X,
  Save,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Type,
  Layout,
  CheckCircle2,
  Upload,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import {
  getPosts,
  createPost,
  updatePost,
  deletePost,
  togglePostVisibility,
  Post,
  generateSlug,
  initTursoDB,
  isTursoConfigured,
  testConnection,
  clearLocalFallback,
  populateSampleData
} from '../lib/turso';
import { advancedAiPosts } from '../data/aiPosts';

const AdminPanel = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Omit<Post, 'id' | 'date'>>({
    title: '',
    content: '',
    image: '',
    category: 'AI Insights',
    isVisible: true
  });

  useEffect(() => {
    const init = async () => {
      await initTursoDB();
      fetchPosts();
    };
    init();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { posts: fetchedPosts } = await getPosts({ limit: 100, includeHidden: true });
      setPosts(fetchedPosts);
    } catch {
      setError('Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (post?: Post) => {
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        content: post.content,
        image: post.image,
        category: post.category,
        isVisible: post.isVisible
      });
    } else {
      setEditingPost(null);
      setFormData({
        title: '',
        content: '',
        image: '',
        category: 'AI Insights',
        isVisible: true
      });
    }
    setIsModalOpen(true);
    setError(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit before compression
        setError('Original image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max width 800px optimization
          const MAX_WIDTH = 800;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to JPEG at 70% quality
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setFormData(prev => ({ ...prev, image: compressedDataUrl }));

            // Log saving stats
            const originalSize = file.size / 1024;
            const compressedSize = Math.round((compressedDataUrl.length * 3 / 4) / 1024);
            console.log(`Deepmind: Image compressed from ${originalSize.toFixed(0)}KB to ${compressedSize}KB`);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (editingPost) {
        await updatePost({
          ...formData,
          id: editingPost.id
        });
        setSuccess('Post updated successfully');
      } else {
        const newPost: Post = {
          ...formData,
          id: generateSlug(formData.title),
          date: new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })
        };
        await createPost(newPost);
        setSuccess('Post created successfully');
      }
      setIsModalOpen(false);
      fetchPosts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Submit Error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(editingPost
        ? `Update Failed: ${message}`
        : `Creation Failed: ${message}`
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleVisibility = async (id: string, currentVisibility: boolean) => {
    try {
      await togglePostVisibility(id, !currentVisibility);
      setPosts(posts.map(p => p.id === id ? { ...p, isVisible: !currentVisibility } : p));
    } catch {
      setError('Failed to toggle visibility');
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!(await confirmDialog({ title: 'Delete post', message: 'Are you sure you want to delete this post?', confirmLabel: 'Delete', danger: true }))) return;

    try {
      await deletePost(id);
      setPosts(posts.filter(p => p.id !== id));
      setSuccess('Post deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to delete post');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cynexai_admin_auth');
    window.location.reload();
  };

  const handleRunDiagnostics = async () => {
    setDiagLoading(true);
    setError(null);
    try {
      const result = await testConnection();
      setDiagResult(result);
      if (result.success) {
        setSuccess('Cloud Connection Verified');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(`Diagnostic Alert: ${result.message}`);
      }
    } catch (err: unknown) {
      setError(`Diagnostic Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDiagLoading(false);
    }
  };

  const handleResetLocal = async () => {
    if (await confirmDialog({ title: 'Clear local backup', message: 'This will clear your local backup storage. Cloud data will remain. Continue?', confirmLabel: 'Clear' })) {
      clearLocalFallback();
      setPosts([]);
      setSuccess('Local storage cleared');
    }
  };

  const handlePopulateSample = async () => {
    if (await confirmDialog({ title: 'Add sample post', message: 'This will add a sample post to verify Cloud connection. Continue?', confirmLabel: 'Add' })) {
      setDiagLoading(true);
      try {
        const result = await populateSampleData();
        if (result?.success) {
          setSuccess('Sample post injected successfully');
          fetchPosts();
        } else {
          setError('Injection Failed');
        }
      } catch (err: unknown) {
        setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setDiagLoading(false);
      }
    }
  };

  const handleGenerateAI = async () => {
    if (await confirmDialog({ title: 'Add AI articles', message: 'This will add 5 advanced AI articles to your database. Continue?', confirmLabel: 'Add' })) {
      setDiagLoading(true);
      try {
        let count = 0;
        for (const post of advancedAiPosts) {
          const id = generateSlug(post.title);
          const exists = posts.some(p => p.id === id);
          if (!exists) {
            await createPost({
              ...post,
              id,
              date: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })
            });
            count++;
          }
        }
        setSuccess(`Successfully added ${count} new AI articles!`);
        fetchPosts();
      } catch (err: unknown) {
        setError(`Generation Failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setDiagLoading(false);
      }
    }
  };

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12 px-4 sm:px-6 lg:px-8 text-secondary">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-secondary">
              Blog Management
            </h1>
            <p className="mt-1 text-sm text-gray-300">
              Create, edit, and manage your technical articles.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 font-bold rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Logout
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center px-6 py-3 bg-[#41c8df] hover:bg-[#38b2c7] text-black font-bold rounded-xl transition-all shadow-lg hover:shadow-[#41c8df]/20 active:scale-95"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Article
            </button>
          </div>
        </div>

        {/* Notifications */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-50 border-l-4 border-green-400 p-4 mb-8 rounded-r-xl shadow-sm flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <p className="text-sm text-green-700 dark:text-white font-medium">{success}</p>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-red-50 border-l-4 border-red-400 p-4 mb-8 rounded-r-xl shadow-sm flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-700 dark:text-white font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search and Filters */}
        <div className="bg-background/40 backdrop-blur-xl rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-secondary/10 p-4 mb-8">
          <div className="relative border-secondary/10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by title or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-secondary/5 border border-transparent focus:bg-secondary/10 focus:border-[#41c8df] rounded-xl outline-none transition-all text-secondary placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Posts Table */}
        <div className="bg-background/40 backdrop-blur-xl rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-secondary/10 overflow-hidden">
          <div className="overflow-x-auto border-secondary/10">
            <table className="w-full text-left">
              <thead className="bg-secondary/5 border-b border-secondary/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Article</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-gray-200 dark:border-white/10 border-t-[#41c8df] rounded-full animate-spin" />
                        <span className="text-sm font-medium">Loading articles...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPosts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-12 h-12 text-gray-100 mb-2" />
                        <span className="text-sm font-medium">No articles found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-secondary/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-secondary/10 rounded-lg overflow-hidden flex-shrink-0">
                            {post.image ? (
                              <img src={post.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-500">
                                <ImageIcon size={20} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-secondary line-clamp-1">{post.title}</div>
                            <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-medium">ID: {post.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#41c8df]/10 border border-[#41c8df]/30 text-[#41c8df] uppercase">
                          {post.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {post.isVisible ? (
                            <span className="flex items-center text-xs font-bold text-green-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-600 mr-2" />
                              PUBLISHED
                            </span>
                          ) : (
                            <span className="flex items-center text-xs font-bold text-gray-400">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2" />
                              HIDDEN
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400 font-medium">
                        {post.date}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleToggleVisibility(post.id, post.isVisible)}
                            className="p-2 text-gray-400 hover:text-[#41c8df] hover:bg-[#41c8df]/10 border border-transparent hover:border-[#41c8df]/30 rounded-lg transition-all"
                            title={post.isVisible ? "Hide Post" : "Show Post"}
                          >
                            {post.isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                          <button
                            onClick={() => handleOpenModal(post)}
                            className="p-2 text-gray-400 hover:text-[#41c8df] hover:bg-[#41c8df]/10 border border-transparent hover:border-[#41c8df]/30 rounded-lg transition-all"
                            title="Edit Post"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 rounded-lg transition-all"
                            title="Delete Post"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-background/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background/90 backdrop-blur-2xl border border-secondary/20 w-full max-w-4xl rounded-[2.5rem] shadow-[0_0_50px_rgba(65,200,223,0.15)] relative z-10 overflow-hidden flex flex-col max-h-full"
            >
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-secondary/10 flex items-center justify-between bg-secondary/5">
                <div>
                  <h2 className="text-2xl font-display font-bold text-secondary">
                    {editingPost ? 'Edit Article' : 'New Article'}
                  </h2>
                  <p className="text-sm text-gray-400 uppercase tracking-widest font-bold mt-1">
                    {editingPost ? 'Update existing content' : 'Create high-signal insights'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 text-gray-400 hover:text-secondary hover:bg-secondary/10 rounded-2xl transition-all border border-transparent hover:border-secondary/20"
                  title="Close Modal"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: Core Data */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">
                        Article Title
                      </label>
                      <div className="relative group">
                        <Type className="absolute left-4 top-4 text-gray-500 group-focus-within:text-[#41c8df] transition-colors" size={18} />
                        <input
                          required
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="e.g., The Future of Generative AI"
                          className="w-full pl-12 pr-4 py-4 bg-secondary/5 border border-secondary/10 focus:bg-secondary/10 focus:border-[#41c8df] rounded-2xl outline-none transition-all text-secondary font-bold placeholder:text-gray-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">
                          Category
                        </label>
                        <div className="relative group">
                          <Layout className="absolute left-4 top-4 text-gray-500 group-focus-within:text-[#41c8df] transition-colors" size={18} />
                          <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 bg-secondary/5 border border-secondary/10 focus:bg-secondary/10 focus:border-[#41c8df] rounded-2xl outline-none transition-all text-secondary font-bold appearance-none cursor-pointer [&>option]:bg-background [&>option]:text-secondary"
                            title="Select Category"
                          >
                            <option value="AI Insights">AI Insights</option>
                            <option value="Tutorials">Tutorials</option>
                            <option value="Case Studies">Case Studies</option>
                            <option value="Industry Trends">Industry Trends</option>
                            <option value="Core Tech">Core Tech</option>
                            <option value="Management">Management</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">
                          Initial Status
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, isVisible: !formData.isVisible })}
                          className={`w-full py-4 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 border transition-all ${formData.isVisible
                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : 'bg-secondary/5 border-secondary/10 text-gray-400'
                            }`}
                        >
                          {formData.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                          {formData.isVisible ? 'Visible' : 'Hidden'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">
                        Featured Image
                      </label>
                      <div className="space-y-4">
                        {formData.image && (
                          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-100 group">
                            <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, image: '' })}
                              className="absolute top-2 right-2 p-2 bg-background/50 hover:bg-background text-secondary rounded-full opacity-0 group-hover:opacity-100 transition-all"
                              title="Remove Image"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}

                        <label className={`flex flex-col items-center justify-center w-full ${formData.image ? 'h-24' : 'h-48'} border-2 border-dashed border-secondary/20 hover:border-[#41c8df] rounded-2xl cursor-pointer bg-secondary/5 hover:bg-[#41c8df]/10 transition-all group`}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className={`w-8 h-8 mb-3 text-gray-500 group-hover:text-[#41c8df] ${formData.image ? 'hidden' : 'block'}`} />
                            <p className="text-sm text-gray-400 font-bold uppercase tracking-wider group-hover:text-[#41c8df]">
                              {formData.image ? 'Change Image' : 'Click to upload image'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">
                              SVG, PNG, JPG (MAX. 2MB)
                            </p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Content Body */}
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">
                      Article Content (Rich Text)
                    </label>
                    <textarea
                      required
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Write your article insights here..."
                      className="w-full h-[320px] p-6 bg-secondary/5 border border-secondary/10 focus:bg-secondary/10 focus:border-[#41c8df] rounded-[2rem] outline-none transition-all text-secondary leading-relaxed font-medium resize-none shadow-inner placeholder:text-gray-600"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-100">
                  <div className="flex items-center text-xs text-gray-400 font-bold gap-4 uppercase tracking-[0.1em]">
                    <div className="flex items-center gap-1.5 text-black">
                      <CheckCircle2 size={14} className="text-[#41c8df]" /> Character Count: {formData.content.length}
                    </div>
                    <div>Ready to publish?</div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 sm:flex-none px-8 py-4 text-gray-400 hover:text-secondary font-bold uppercase tracking-widest text-xs transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={formLoading}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center px-10 py-4 bg-[#41c8df] hover:bg-secondary text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all shadow-[0_0_20px_rgba(65,200,223,0.3)] hover:shadow-[0_0_30px_rgba(65,200,223,0.5)] active:scale-95 disabled:opacity-50"
                    >
                      {formLoading ? (
                        <div className="w-5 h-5 border-2 border-[#41c8df]/50 border-t-[#41c8df] rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-3" />
                          {editingPost ? 'Update Article' : 'Publish Article'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Advanced Diagnostics Section */}
      <div className="max-w-7xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 relative z-10">
        <div className="bg-background/40 backdrop-blur-xl border border-secondary/10 p-6 rounded-[2rem] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-secondary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#41c8df]" />
              System Infrastructure
            </h3>
            <div className={`w-2.5 h-2.5 rounded-full ${isTursoConfigured ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-[10px] font-bold text-gray-500">
              <span>Cloud Status</span>
              <span className={isTursoConfigured ? 'text-green-600' : 'text-amber-600'}>
                {isTursoConfigured ? 'Operational' : 'Fallback Active'}
              </span>
            </div>
            {diagResult && (
              <>
                <div className="flex justify-between text-[10px] font-bold text-gray-500 border-t border-secondary/10 pt-2">
                  <span>Ping Latency</span>
                  <span className="text-secondary">{diagResult.latency ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-gray-500">
                  <span>Active Tables</span>
                  <span className="text-secondary">{diagResult.tables?.length ?? 0}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-gray-500">
                  <span>Stored Articles</span>
                  <span className="text-[#41c8df] font-black">{diagResult.counts?.blog_posts ?? 0}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            <button
              onClick={handleRunDiagnostics}
              disabled={diagLoading}
              className="px-4 py-2 bg-secondary/10 border border-secondary/20 text-secondary hover:border-secondary/50 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-secondary/20 transition-all disabled:opacity-50"
            >
              {diagLoading ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleResetLocal}
              className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all"
            >
              Reset Local
            </button>
            <button
              onClick={handleGenerateAI}
              disabled={diagLoading}
              className="px-4 py-2 bg-purple-50 text-purple-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-purple-100 transition-all disabled:opacity-50"
            >
              Generate AI Content
            </button>
            <button
              onClick={handlePopulateSample}
              disabled={diagLoading}
              className="px-4 py-2 bg-[#41c8df]/10 text-[#41c8df] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#41c8df]/20 transition-all disabled:opacity-50"
            >
              Repair Data
            </button>
          </div>
        </div>

        <div className="bg-background/40 backdrop-blur-xl border border-secondary/10 p-6 rounded-[2rem] shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col justify-center text-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] leading-relaxed">
            Deepmind Protocol v1.3.0<br />
            Protected Encryption: AES-256<br />
            Secure Session Active
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
