import { Github, Twitter, Linkedin, Mail, MapPin, Code, Coffee } from 'lucide-react'

export default function About() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
              JD
            </div>
            
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Hi, I'm John Doe
              </h1>
              <p className="text-xl text-gray-600 mb-6">
                Full-stack developer passionate about creating amazing web experiences
                and sharing knowledge through writing.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <a
                  href="mailto:john@example.com"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Mail size={18} />
                  <span>Get in touch</span>
                </a>
                
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Github size={18} />
                  <span>GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Me */}
      <section className="bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">About Me</h2>
        <div className="prose prose-lg max-w-none text-gray-700">
          <p>
            I'm a passionate full-stack developer with over 5 years of experience building
            web applications. I love working with modern technologies like React, TypeScript,
            Node.js, and exploring new tools that make development more efficient and enjoyable.
          </p>
          
          <p>
            When I'm not coding, you can find me writing about my experiences, contributing
            to open-source projects, or learning about the latest trends in web development.
            I believe in the power of sharing knowledge and helping others grow in their
            development journey.
          </p>
          
          <p>
            This blog is my way of documenting what I learn, sharing insights from my projects,
            and connecting with the amazing developer community. I hope you find something
            useful here!
          </p>
        </div>
      </section>

      {/* Skills & Interests */}
      <div className="grid md:grid-cols-2 gap-8">
        <section className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center space-x-2 mb-6">
            <Code className="text-blue-600" size={24} />
            <h2 className="text-2xl font-bold text-gray-900">Skills</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Frontend</h3>
              <div className="flex flex-wrap gap-2">
                {['React', 'TypeScript', 'Vue.js', 'Tailwind CSS', 'Next.js'].map(skill => (
                  <span key={skill} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Backend</h3>
              <div className="flex flex-wrap gap-2">
                {['Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'Redis'].map(skill => (
                  <span key={skill} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Tools & Others</h3>
              <div className="flex flex-wrap gap-2">
                {['Docker', 'AWS', 'Git', 'Linux', 'GraphQL'].map(skill => (
                  <span key={skill} className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center space-x-2 mb-6">
            <Coffee className="text-blue-600" size={24} />
            <h2 className="text-2xl font-bold text-gray-900">Interests</h2>
          </div>
          
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start space-x-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
              <span>Building scalable web applications</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
              <span>Open source software development</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
              <span>DevOps and cloud architecture</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
              <span>Machine learning and AI</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
              <span>Photography and travel</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
              <span>Reading tech blogs and books</span>
            </li>
          </ul>
        </section>
      </div>

      {/* Contact & Location */}
      <section className="bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Let's Connect</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <MapPin className="text-gray-600" size={20} />
              <span className="text-gray-700">San Francisco, CA</span>
            </div>
            
            <p className="text-gray-700 mb-4">
              I'm always interested in new opportunities, interesting projects,
              and connecting with fellow developers. Feel free to reach out!
            </p>
            
            <div className="flex space-x-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900"
              >
                <Github size={24} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900"
              >
                <Twitter size={24} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900"
              >
                <Linkedin size={24} />
              </a>
              <a
                href="mailto:john@example.com"
                className="text-gray-600 hover:text-gray-900"
              >
                <Mail size={24} />
              </a>
            </div>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Facts</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li><strong>Experience:</strong> 5+ years</li>
              <li><strong>Location:</strong> San Francisco, CA</li>
              <li><strong>Specialties:</strong> React, Node.js, TypeScript</li>
              <li><strong>Current Focus:</strong> Full-stack development</li>
              <li><strong>Hobbies:</strong> Photography, hiking, reading</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}