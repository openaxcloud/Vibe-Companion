import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, TrendingUp, Search, Plus, Star } from 'lucide-react';

export default function Forum() {
  const categories = [
    { name: 'General Discussion', posts: 12543, color: 'bg-blue-500' },
    { name: 'Help & Support', posts: 8932, color: 'bg-green-500' },
    { name: 'Show & Tell', posts: 5621, color: 'bg-purple-500' },
    { name: 'Feature Requests', posts: 3456, color: 'bg-orange-500' },
    { name: 'Bug Reports', posts: 2134, color: 'bg-red-500' },
    { name: 'Tutorials', posts: 4567, color: 'bg-indigo-500' },
  ];

  const recentPosts = [
    {
      title: 'How to deploy a Next.js app on E-Code?',
      author: 'alex_dev',
      category: 'Help & Support',
      replies: 23,
      views: 456,
      time: '2 hours ago',
      solved: true,
    },
    {
      title: 'Check out my new portfolio site!',
      author: 'sarah_codes',
      category: 'Show & Tell',
      replies: 15,
      views: 234,
      time: '4 hours ago',
      solved: false,
    },
    {
      title: 'Python vs JavaScript for beginners?',
      author: 'newbie123',
      category: 'General Discussion',
      replies: 67,
      views: 1234,
      time: '6 hours ago',
      solved: false,
    },
    {
      title: 'Bug: Terminal not loading in mobile app',
      author: 'mobile_user',
      category: 'Bug Reports',
      replies: 5,
      views: 89,
      time: '8 hours ago',
      solved: true,
    },
  ];

  const topContributors = [
    { name: 'codemaster', posts: 523, reputation: 15234 },
    { name: 'helpful_dev', posts: 412, reputation: 12456 },
    { name: 'tutorial_king', posts: 389, reputation: 11234 },
    { name: 'debug_wizard', posts: 345, reputation: 10123 },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-responsive bg-muted">
          <div className="container-responsive">
            <div className="text-center max-w-3xl mx-auto">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h1 className="text-4xl font-bold mb-4">Community Forum</h1>
              <p className="text-lg text-muted-foreground mb-8">
                Connect with developers, get help, and share your projects
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search the forum..."
                    className="w-full pl-10 pr-4 py-2 border rounded-md"
                  />
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Post
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-8 border-b">
          <div className="container-responsive">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-primary">45.2K</div>
                <div className="text-muted-foreground">Total Posts</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">128K</div>
                <div className="text-muted-foreground">Members</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">892</div>
                <div className="text-muted-foreground">Online Now</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">23.5K</div>
                <div className="text-muted-foreground">Solutions</div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-responsive">
          <div className="container-responsive">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Categories */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {categories.map((category) => (
                        <div key={category.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                            <span className="font-medium">{category.name}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{category.posts.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Contributors */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Top Contributors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {topContributors.map((contributor, index) => (
                        <div key={contributor.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{contributor.name}</p>
                              <p className="text-xs text-muted-foreground">{contributor.posts} posts</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            <span className="text-sm">{contributor.reputation.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Posts */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Recent Posts</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Latest</Button>
                    <Button variant="outline" size="sm">Popular</Button>
                    <Button variant="outline" size="sm">Unanswered</Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {recentPosts.map((post, index) => (
                    <Card key={index}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary">{post.category}</Badge>
                              {post.solved && (
                                <Badge className="bg-green-100 text-green-800">Solved</Badge>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold mb-2 hover:text-primary cursor-pointer">
                              {post.title}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>by {post.author}</span>
                              <span>•</span>
                              <span>{post.time}</span>
                              <span>•</span>
                              <span>{post.replies} replies</span>
                              <span>•</span>
                              <span>{post.views} views</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1 ml-4">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{post.replies}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-8 flex justify-center">
                  <Button 
                    variant="outline"
                    onClick={() => window.location.href = '/forum'}
                  >
                    Load More Posts
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-responsive bg-primary text-primary-foreground">
          <div className="container-responsive text-center">
            <h2 className="text-3xl font-bold mb-4">Join the Discussion</h2>
            <p className="text-lg mb-8 opacity-90">
              Share your knowledge and learn from the community
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => window.location.href = '/auth'}
            >
              Join Forum
            </Button>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}