function Footer() {
  return (
    <footer className="bg-white/5 backdrop-blur-xl border-t border-white/10 mt-12 py-8 text-center text-slate-400">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <p>&copy; {new Date().getFullYear()} My Personal Blog. All rights reserved.</p>
        <p className="mt-2 text-sm">Built with React, Tailwind CSS, and a dash of passion.</p>
      </div>
    </footer>
  );
}

export default Footer;
