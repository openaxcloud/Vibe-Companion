import React from 'react';
import { Github, Twitter, Linkedin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-card-light dark:bg-card-dark glass-effect border-t border-border-light dark:border-border-dark py-8 px-6 md:px-8 mt-12">
      <div className="container mx-auto text-center text-text-muted-light dark:text-text-muted-dark">
        <p className="mb-4">&copy; {new Date().getFullYear()} E-Market. All rights reserved.</p>
        <div className="flex justify-center space-x-6 mb-4">
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200"
            aria-label="GitHub"
          >
            <Github size={24} />
          </a>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200"
            aria-label="Twitter"
          >
            <Twitter size={24} />
          </a>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200"
            aria-label="LinkedIn"
          >
            <Linkedin size={24} />
          </a>
        </div>
        <p>Built with ❤️ by Your Team</p>
      </div>
    </footer>
  );
};

export default Footer;
