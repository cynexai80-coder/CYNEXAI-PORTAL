import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Play } from 'lucide-react';
import { initTursoDB, getPosts, getCategories } from '../lib/turso';
import { subscribeNewsletter } from '../lib/api/crm';
import { notify } from '../lib/feedback';
interface BlogPost {
    id: string;
    title: string;
    content: string;
    image?: string;
    video?: string;
    isVisible: boolean;
    category?: string;
    date?: string;
}

const POSTS_PER_PAGE = 3;

const BlogSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-secondary/5 backdrop-blur-md rounded-2xl p-6 animate-pulse border border-secondary/10">
                <div className="aspect-video bg-secondary/10 rounded-xl mb-6"></div>
                <div className="h-6 bg-secondary/10 rounded-md mb-4 w-3/4"></div>
                <div className="h-4 bg-secondary/10 rounded-md w-1/2"></div>
            </div>
        ))}
    </div>
);

const BlogPage = () => {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [newsletterEmail, setNewsletterEmail] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscribeLoading, setSubscribeLoading] = useState(false);


    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newsletterEmail || !newsletterEmail.includes('@')) {
            notify('Please enter a valid professional email.');
            return;
        }

        setSubscribeLoading(true);
        const result = await subscribeNewsletter(newsletterEmail);
        setSubscribeLoading(false);
        if (!result.success) {
            notify(result.error || 'Could not subscribe. Please try again.');
            return;
        }
        setIsSubscribed(true);
        setNewsletterEmail('');
    };

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                await initTursoDB();
                setCategories(await getCategories());
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true);
            try {
                await initTursoDB();

                // If loading page 1, reset everything
                if (currentPage === 1) {
                    const { posts: fetchedPosts, total } = await getPosts({
                        page: 1,
                        limit: POSTS_PER_PAGE,
                        search: searchQuery,
                        category: selectedCategory
                    });
                    setTotalPages(Math.ceil(total / POSTS_PER_PAGE));
                    setPosts(fetchedPosts);
                } else {
                    // If loading "more", we want to load EVERYTHING else
                    // We can use an offset equal to current posts length, and a large limit
                    const offset = posts.length;
                    const { posts: fetchedPosts } = await getPosts({
                        offset,
                        limit: 1000, // Large number to fetch all remaining
                        search: searchQuery,
                        category: selectedCategory
                    });
                    setPosts(prev => [...prev, ...fetchedPosts]);

                    // Since we loaded everything, we are effectively at the last page
                    setTotalPages(currentPage);
                }

            } catch (error) {
                console.error('Error fetching posts:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, searchQuery, selectedCategory]);

    return (
        <div className="dark">
            <div className="min-h-screen text-gray-100 font-sans selection:bg-[#41c8df]/20 transition-colors duration-500 relative">
                {/* Header Section */}
                <div className="pt-32 pb-16 px-4 text-center transition-colors">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight text-secondary">
                            CynexAi <span className="text-[#41c8df]">Blog</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto font-medium leading-relaxed">
                            Stay updated with the latest trends and insights in AI and technology.
                        </p>
                    </motion.div>
                </div>

                {/* Search and Filters */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-12">
                    <div className="flex flex-col md:flex-row gap-4 justify-center items-center bg-background/40 backdrop-blur-xl p-6 rounded-2xl shadow-[0_0_30px_rgba(65,200,223,0.1)] border border-secondary/10 transition-colors">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search articles..."
                                aria-label="Search articles"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-12 pr-4 py-3 bg-secondary/5 border border-secondary/10 rounded-xl text-secondary placeholder-gray-400 focus:outline-none focus:border-[#41c8df] focus:ring-1 focus:ring-[#41c8df] transition-all"
                            />
                        </div>

                        <select
                            title="Sort by Category"
                            aria-label="Filter by category"
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-6 py-3 bg-secondary/5 border border-secondary/10 rounded-xl text-secondary focus:outline-none focus:border-[#41c8df] transition-colors cursor-pointer appearance-none min-w-[200px]"
                        >
                            <option value="">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat} className="dark:bg-background">
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Blog Grid */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                    {loading && currentPage === 1 ? (
                        <BlogSkeleton />
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 gap-y-12">
                                {posts.map((post, index) => {


                                    return (
                                        <div key={post.id} className="contents">
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="group block h-full bg-background/40 backdrop-blur-xl rounded-2xl p-4 border border-secondary/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-[#41c8df]/50 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(65,200,223,0.2)] transition-all duration-300"
                                            >
                                                <Link to={`/blog/${post.id}`} className="block h-full">
                                                    {/* Image Container */}
                                                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gray-900 mb-6">
                                                        {(() => {
                                                            const getFallbackImage = (category?: string) => {
                                                                const cat = (category || '').toLowerCase();
                                                                if (cat.includes('ai') || cat.includes('tech')) return 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800'; // Modern AI
                                                                if (cat.includes('robot')) return 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800'; // Robotics
                                                                if (cat.includes('quantum')) return 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800'; // Quantum
                                                                if (cat.includes('space')) return 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800'; // Space
                                                                if (cat.includes('smart') || cat.includes('city')) return 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800'; // Smart City
                                                                if (cat.includes('health') || cat.includes('bio')) return 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800'; // Health/Bio
                                                                return 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800'; // Default Tech
                                                            };

                                                            const displayImage = post.image || getFallbackImage(post.category);

                                                            return post.image || post.category ? (
                                                                <img
                                                                    src={displayImage}
                                                                    alt={post.title}
                                                                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = getFallbackImage(post.category);
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                                                    <span className="text-gray-600 font-bold">CynexAI</span>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Play Button Overlay if Video */}
                                                        {post.video && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-background/20 group-hover:bg-background/10 transition-colors">
                                                                <div className="w-12 h-12 bg-secondary/20 backdrop-blur-md rounded-full flex items-center justify-center border border-secondary/30">
                                                                    <Play className="w-5 h-5 text-secondary fill-current ml-0.5" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Typography */}
                                                    <div className="flex flex-col gap-3">
                                                        <h3 className="text-xl font-bold text-secondary leading-tight group-hover:text-[#41c8df] transition-colors line-clamp-2">
                                                            {post.title}
                                                        </h3>
                                                        <div className="text-sm text-gray-400 font-medium">
                                                            {post.date ? new Date(post.date).toLocaleDateString('en-US', {
                                                                month: 'long',
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            }) : ''}
                                                        </div>
                                                    </div>
                                                </Link>
                                            </motion.div>


                                        </div>
                                    );
                                })}
                            </div>

                            {posts.length === 0 && !loading && (
                                <div className="py-20 flex justify-center">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="w-full max-w-4xl bg-background rounded-[3rem] p-12 md:p-16 text-center relative overflow-hidden shadow-[0_40px_100px_-20px_rgba(65,200,223,0.1)] border border-secondary/5"
                                    >
                                        {/* Radial Gradient Background */}
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(65,200,223,0.08),_transparent_70%)]" />

                                        {/* SVG Dot Pattern */}
                                        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,_transparent_1px)] [background-size:30px_30px]" />

                                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#41c8df]/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                                        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#41c8df]/5 rounded-full blur-[100px] -ml-32 -mb-32"></div>

                                        <div className="relative z-10">
                                            <div className="flex justify-center mb-8">
                                                <div className="w-20 h-20 bg-secondary/5 backdrop-blur-md rounded-full flex items-center justify-center border border-secondary/10">
                                                    <Search className="w-10 h-10 text-[#41c8df] opacity-50" />
                                                </div>
                                            </div>
                                            <h2 className="text-3xl md:text-5xl font-black text-secondary mb-6 tracking-tighter">
                                                {searchQuery || selectedCategory
                                                    ? <>No articles found <br /><span className="text-[#41c8df]">matching "{searchQuery || selectedCategory}"</span></>
                                                    : <>No articles <br /><span className="text-[#41c8df]">published yet</span></>
                                                }
                                            </h2>
                                            <p className="text-gray-400 text-lg mb-12 max-w-xl mx-auto">
                                                {searchQuery || selectedCategory
                                                    ? "We couldn't find what you're looking for, but you can stay updated with our latest deep dives by joining our newsletter."
                                                    : "We're preparing some amazing high-signal AI insights for you. Join our newsletter to be the first to know when we publish."
                                                }
                                            </p>

                                            <div className="max-w-md mx-auto">
                                                {!isSubscribed ? (
                                                    <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 p-2 bg-secondary/5 backdrop-blur-md rounded-[1.5rem] border border-secondary/10 transition-all">
                                                        <input
                                                            type="email"
                                                            required
                                                            value={newsletterEmail}
                                                            onChange={(e) => setNewsletterEmail(e.target.value)}
                                                            placeholder="Your email"
                                                            className="flex-1 bg-transparent px-6 py-4 text-secondary placeholder-gray-500 focus:outline-none text-sm"
                                                        />
                                                        <button
                                                            type="submit"
                                                            disabled={subscribeLoading}
                                                            className="px-8 py-4 bg-[#41c8df] hover:bg-secondary text-black font-bold uppercase tracking-wider text-xs rounded-xl transition-all disabled:opacity-50"
                                                        >
                                                            {subscribeLoading ? '...' : 'Notify Me'}
                                                        </button>
                                                    </form>
                                                ) : (
                                                    <div className="text-[#41c8df] font-bold">✓ Subscribed! We'll notify you of new content.</div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => { setSearchQuery(''); setSelectedCategory(''); }}
                                                className="mt-12 text-gray-500 hover:text-secondary transition-colors text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 mx-auto"
                                            >
                                                Clear all filters
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}

                            {loading && posts.length > 0 && (
                                <div className="mt-16 text-center">
                                    <div className="inline-block w-10 h-10 border-4 border-gray-100 border-t-[#41c8df] rounded-full animate-spin"></div>
                                </div>
                            )}

                            {currentPage < totalPages && !loading && (
                                <div className="flex justify-center mt-20">
                                    <button
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="px-8 py-3 bg-[#41c8df] hover:bg-secondary text-black font-bold rounded-full transition-colors flex items-center justify-center gap-2 mx-auto shadow-lg shadow-[#41c8df]/20"
                                    >
                                        Load More
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Bottom Theme Toggle - REMOVED */}
            </div>
        </div>
    );
};

export default BlogPage;
