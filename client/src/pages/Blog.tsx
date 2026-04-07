import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  Code, Calendar, Clock, User, Tag, ChevronRight, 
  ArrowRight, TrendingUp, Zap, Users, Globe
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { ECodeLoading } from '@/components/ECodeLoading';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  featured?: boolean;
  image?: string;
}

export default function Blog() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Fetch blog posts from API
  const { data: allPosts = [], isLoading } = useQuery({
    queryKey: ['/api/blog/posts'],
  });

  const { data: featuredPosts = [] } = useQuery({
    queryKey: ['/api/blog/featured'],
  });

  // Filter posts by category
  const filteredPosts = selectedCategory === 'All' 
    ? allPosts 
    : allPosts.filter((post: any) => post.category.toLowerCase() === selectedCategory.toLowerCase());

  // Get the first featured post
  const featuredPost = featuredPosts[0];

  // Get non-featured posts
  const posts = filteredPosts.filter((post: any) => !post.featured).slice(0, 6);

  const categories = ['All', 'Product', 'Engineering', 'Announcements', 'Tutorial', 'Community'];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Product': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'Engineering': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      'Company': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      'Education': 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      'Tutorial': 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
      'Community': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: data.message,
        });
        setEmail('');
      } else {
        toast({
          title: "Error",
          description: data.message || 'Failed to subscribe',
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to subscribe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-4 sm:space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              E-Code Blog
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4 sm:px-0">
              Product updates, engineering insights, and stories from our community
            </p>
          </div>
        </div>
      </section>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <ECodeLoading size="lg" />
        </div>
      ) : (
        <>
          {/* Featured Post */}
          {featuredPost && (
            <section className="py-12 px-4">
              <div className="container mx-auto max-w-6xl">
                <Card 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => window.location.href = `/blog/${featuredPost.slug}`}
                >
                  <div className="grid md:grid-cols-2 gap-0">
                    <div className="relative h-64 md:h-auto bg-gradient-to-br from-primary/20 to-purple-600/20">
                      {featuredPost.coverImage ? (
                        <img 
                          src={featuredPost.coverImage} 
                          alt={featuredPost.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Zap className="h-24 w-24 text-primary/30" />
                        </div>
                      )}
                    </div>
                    <div className="p-8 flex flex-col justify-center">
                      <Badge className={`w-fit mb-4 ${getCategoryColor(featuredPost.category)}`}>
                        {featuredPost.category}
                      </Badge>
                      <h2 className="text-3xl font-bold mb-4">{featuredPost.title}</h2>
                      <p className="text-lg text-muted-foreground mb-6">{featuredPost.excerpt}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{featuredPost.author}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(featuredPost.publishedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{featuredPost.readTime} min read</span>
                        </div>
                      </div>
                      <Button className="mt-6 w-fit">
                        Read more
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </section>
          )}

          {/* Category Filter */}
          <section className="py-8 px-4">
            <div className="container mx-auto max-w-6xl">
              <div className="flex gap-2 flex-wrap">
                {categories.map(category => (
                  <Button
                    key={category}
                    variant="outline"
                    size="sm"
                    className={category === selectedCategory ? 'bg-primary text-primary-foreground' : ''}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </section>

      {/* Blog Posts Grid */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <Card key={post.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = `/blog/${post.slug}`}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className={getCategoryColor(post.category)}>
                      {post.category}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{post.readTime} min read</span>
                  </div>
                  <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground line-clamp-3 mb-4">{post.excerpt}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{post.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          <div className="text-center mt-12">
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => window.location.reload()}
            >
              Load more posts
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
        </>
      )}

      {/* Newsletter Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">
                Stay up to date
              </h2>
              <p className="text-muted-foreground mb-6">
                Get the latest product updates, engineering insights, and community stories delivered to your inbox.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Subscribing...' : 'Subscribe'}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground mt-4">
                We'll never share your email. Unsubscribe anytime.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}