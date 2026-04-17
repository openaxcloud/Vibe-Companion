import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, User, Rss, Github, Twitter, Linkedin } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link to="/" className="text-2xl font-bold text-gray-900">
              Personal Blog
            </Link>
            
            <nav className="flex space-x-8">
              <Link 
                to="/" 
                className={`flex items-center space-x-1 ${isActive('/')}`}
              >
                <Home size={18} />
                <span>Home</span>
              </Link>
              
              <Link 
                to="/about" 
                className={`flex items-center space-x-1 ${isActive('/about')}`}
              >
                <User size={18} />
                <span>About</span>
              </Link>
              
              <a 
                href="/rss.xml" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-orange-600 hover:text-orange-700"
              >
                <Rss size={18} />
                <span>RSS</span>
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-600 text-sm mb-4 md:mb-0">
              © 2024 Personal Blog. Built with React, TypeScript, and Tailwind CSS.
            </div>
            
            <div className="flex space-x-6">
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
              >
                <Github size={20} />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
              >
                <Twitter size={20} />
              </a>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
              >
                <Linkedin size={20} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}