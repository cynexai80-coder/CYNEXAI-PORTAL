
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Calendar, Clock, Linkedin } from 'lucide-react';
import { getPostById, getPosts, getAdjacentPosts, Post } from '../lib/turso';

// Custom X (Twitter) Icon
const XIcon = ({ className, size = 24 }: { className?: string, size?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
    >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const BlogPostDetail = () => {
    const { id } = useParams<{ id: string }>();
    const [post, setPost] = useState<Post | null>(null);
    const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
    const [adjacentPosts, setAdjacentPosts] = useState<{ prev: Post | null, next: Post | null }>({ prev: null, next: null });
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetchPost = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // Fetch current post
                const fetchedPost = await getPostById(id);
                if (fetchedPost) {
                    setPost(fetchedPost);

                    // Fetch adjacents
                    const adjacents = await getAdjacentPosts(id);
                    setAdjacentPosts(adjacents);
                }

                // Fetch related posts
                const { posts } = await getPosts({ limit: 5 });
                setRelatedPosts(posts.filter(p => p.id !== id).slice(0, 4));

            } catch (error) {
                console.error("Error fetching post:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [id]);

    // Each article gets its own title; a missing article must not be indexed (the route still answers 200).
    useEffect(() => {
        if (loading) return;
        if (post?.title) {
            document.title = `${post.title} | CynexAI Blog`;
        } else {
            document.title = 'Article not found | CynexAI';
            let robots = document.head.querySelector('meta[name="robots"]');
            if (!robots) {
                robots = document.createElement('meta');
                robots.setAttribute('name', 'robots');
                document.head.appendChild(robots);
            }
            robots.setAttribute('content', 'noindex, nofollow');
        }
    }, [loading, post]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-transparent">
                <div className="w-12 h-12 border-4 border-gray-100 border-t-[#41c8df] rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-transparent text-secondary p-4 text-center">
                <h2 className="text-3xl font-black mb-4">Article Not Found</h2>
                <p className="text-gray-400 mb-8 max-w-md">The article you are looking for might have been removed or is temporarily unavailable.</p>
                <Link to="/blog" className="px-8 py-3 bg-[#41c8df] text-black font-bold uppercase tracking-widest rounded-xl hover:bg-secondary transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(65,200,223,0.3)] hover:shadow-[0_0_30px_rgba(65,200,223,0.5)]">
                    <ArrowLeft size={18} /> Back to Blog
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-gray-100 font-sans selection:bg-[#41c8df]/30 pb-20 bg-transparent">
            {/* Reading Progress Bar */}
            <motion.div
                className="fixed top-0 left-0 right-0 h-1 bg-[#41c8df] origin-left z-[60]"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, ease: "circOut" }}
            />

            {/* Immersive Hero Section */}
            <div className="relative w-full h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
                {/* Background Image/Video */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#0a0a0a] z-10" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] z-10 opacity-70" />

                    {post.video ? (
                        <video
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover"
                            poster={post.image}
                        >
                            <source src={post.video} type="video/mp4" />
                        </video>
                    ) : (
                        <img
                            src={post.image || 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2560&auto=format&fit=crop'}
                            alt={post.title}
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>

                {/* Hero Content */}
                <div className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        {/* Category Tag */}
                        {post.category && (
                            <motion.span
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="inline-block px-4 py-1.5 mb-6 rounded-full bg-secondary/10 backdrop-blur-md border border-secondary/20 text-[#41c8df] text-xs font-black uppercase tracking-[0.2em] shadow-lg"
                            >
                                {post.category}
                            </motion.span>
                        )}

                        {/* Title */}
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-8 text-secondary drop-shadow-2xl">
                            {post.title}
                        </h1>

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-gray-300 uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-[#41c8df] flex items-center justify-center text-black font-black text-xs">
                                    CA
                                </span>
                                <span>CynexAI Team</span>
                            </div>
                            <div className="w-1 h-1 bg-[#41c8df] rounded-full" />
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-[#41c8df]" />
                                {post.date ? new Date(post.date).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                }) : 'Unknown Date'}
                            </div>
                            <div className="hidden sm:block w-1 h-1 bg-[#41c8df] rounded-full" />
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[#41c8df]" />
                                {Math.ceil(post.content.length / 1000)} min read
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-30">
                {/* Back Link Floating */}
                <div className="absolute -top-32 left-4 lg:-left-20 hidden lg:block">
                    <Link
                        to="/blog"
                        className="p-4 rounded-full bg-secondary/5 backdrop-blur-md border border-secondary/10 text-secondary hover:bg-[#41c8df] hover:text-black hover:scale-110 transition-all duration-300 flex items-center justify-center group"
                        title="Back to Articles"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </Link>
                </div>

                {/* Main Content Card */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="bg-background/60 border border-secondary/10 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 lg:p-16 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                >
                    {/* Share Bar Sticky */}
                    <div className="flex justify-end gap-3 mb-10 border-b border-secondary/5 pb-8">
                        <a
                            href="https://x.com/CynexAi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-full bg-secondary/5 border border-secondary/10 text-gray-400 hover:text-[#1DA1F2] hover:border-[#1DA1F2] transition-all"
                            title="Visit our X"
                        >
                            <XIcon size={18} />
                        </a>
                        <a
                            href="https://www.linkedin.com/company/cynexai/posts/?feedView=all"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-full bg-secondary/5 border border-secondary/10 text-gray-400 hover:text-[#0A66C2] hover:border-[#0A66C2] transition-all"
                            title="Visit our LinkedIn"
                        >
                            <Linkedin size={18} />
                        </a>
                    </div>

                    {/* Article Body */}
                    <div className="prose prose-lg prose-invert max-w-none 
                        prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-secondary
                        prose-p:text-gray-300 prose-p:leading-[1.8] prose-p:mb-8 prose-p:text-lg
                        prose-strong:text-secondary prose-strong:font-black
                        prose-a:text-[#41c8df] prose-a:font-bold prose-a:no-underline hover:prose-a:underline
                        prose-blockquote:border-l-4 prose-blockquote:border-[#41c8df] prose-blockquote:bg-secondary/5 prose-blockquote:py-4 prose-blockquote:px-8 prose-blockquote:rounded-r-2xl prose-blockquote:not-italic prose-blockquote:text-xl prose-blockquote:font-medium
                        prose-li:marker:text-[#41c8df]
                        prose-img:rounded-3xl prose-img:shadow-[0_0_30px_rgba(0,0,0,0.5)] prose-img:my-12 prose-img:w-full border-secondary/10"
                    >
                        {post.content.split(/\n\s*\n/).map((paragraph, idx) => (
                            <p key={idx} className="mb-6">{paragraph}</p>
                        ))}
                    </div>

                    {/* Footer Section of Article - Replaced with Prev/Next Navigation */}
                    <div className="mt-16 pt-10 border-t border-secondary/10">
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                            {/* Previous Post (Older) */}
                            {adjacentPosts.prev ? (
                                <Link
                                    to={`/blog/${adjacentPosts.prev.id}`}
                                    className="flex-1 group flex flex-col p-6 rounded-2xl bg-secondary/5 border border-secondary/10 hover:border-[#41c8df] hover:bg-secondary/10 transition-all text-left shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_15px_40px_rgba(65,200,223,0.15)]"
                                >
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2 group-hover:text-[#41c8df] transition-colors">
                                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Previous Article
                                    </span>
                                    <h4 className="text-lg font-bold text-secondary group-hover:text-[#41c8df] transition-colors line-clamp-2">
                                        {adjacentPosts.prev.title}
                                    </h4>
                                </Link>
                            ) : (
                                <div className="flex-1" /> /* Spacer */
                            )}

                            {/* Next Post (Newer) */}
                            {adjacentPosts.next ? (
                                <Link
                                    to={`/blog/${adjacentPosts.next.id}`}
                                    className="flex-1 group flex flex-col items-end p-6 rounded-2xl bg-secondary/5 border border-secondary/10 hover:border-[#41c8df] hover:bg-secondary/10 transition-all text-right shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_15px_40px_rgba(65,200,223,0.15)]"
                                >
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2 group-hover:text-[#41c8df] transition-colors">
                                        Next Article <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </span>
                                    <h4 className="text-lg font-bold text-secondary group-hover:text-[#41c8df] transition-colors line-clamp-2">
                                        {adjacentPosts.next.title}
                                    </h4>
                                </Link>
                            ) : (
                                <div className="flex-1" /> /* Spacer */
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Related Posts Section ("You might also like") */}
                {relatedPosts.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-20"
                    >
                        <h2 className="text-3xl font-black mb-10 text-secondary">You might also like</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {relatedPosts.map((relatedPost) => (
                                <Link
                                    to={`/blog/${relatedPost.id}`}
                                    key={relatedPost.id}
                                    className="group block bg-background/40 backdrop-blur-xl border border-secondary/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-4 rounded-2xl hover:border-[#41c8df]/50 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(65,200,223,0.2)] transition-all duration-300"
                                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                >
                                    <div className="aspect-[4/3] rounded-xl overflow-hidden mb-4 relative bg-secondary/5 border border-secondary/10">
                                        <img
                                            src={relatedPost.image || 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1280&auto=format&fit=crop'}
                                            alt={relatedPost.title}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors" />
                                    </div>
                                    <h3 className="text-lg font-bold text-secondary leading-tight mb-2 group-hover:text-[#41c8df] transition-colors line-clamp-2">
                                        {relatedPost.title}
                                    </h3>
                                    <p className="text-sm text-gray-400 font-medium">
                                        {relatedPost.date ? new Date(relatedPost.date).toLocaleDateString(undefined, {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        }) : ''}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </motion.div>
                )}

            </article>
        </div >
    );
};

export default BlogPostDetail;
