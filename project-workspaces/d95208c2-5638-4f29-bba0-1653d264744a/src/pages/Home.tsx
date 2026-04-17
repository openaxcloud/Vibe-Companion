import { useEffect, useState } from 'react'
import BlogPostCard from '../components/BlogPostCard'
import { getAllPosts } from '../utils/blog'
import { BlogPost } from '../types/blog'
import { Search, Filter } from 'lucide-react'

export default function Home() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [allTags, setAllTags] = useState<string[]>([])

  useEffect(() => {
    const allPosts = getAllPosts()
    setPosts(allPosts)
    setFilteredPosts(allPosts)
    
    // Extract all unique tags
    const tags = Array.from(new Set(allPosts.flatMap(post => post.tags))).sort()
    setAllTags(tags)
  }, [])

  useEffect(() => {
    let filtered = posts

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Filter by selected tag
    if (selectedTag) {
      filtered = filtered.filter(post => post.tags.includes(selectedTag))
    }

    setFilteredPosts(filtered)
  }, [posts, searchTerm, selectedTag])

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="text-center py-12 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Welcome to My Blog
        </h1>
        <p className="text-xl md:text-2xl mb-6 opacity-90">
          Sharing insights on web development, technology, and personal growth
        </p>
        <p className="text-lg opacity-80">
          {posts.length} posts and counting...
        </p>
      </section>

      {/* Search and Filter Section */}
      <section className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Tag Filter */}
          <div className="relative">
            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-gray-600">
          {filteredPosts.length === posts.length
            ? `Showing all ${posts.length} posts`
            : `Showing ${filteredPosts.length} of ${posts.length} posts`
          }
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section>
        {filteredPosts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
            {filteredPosts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              No posts found matching your search criteria.
            </p>
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedTag('')
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>
    </div>
  )
}