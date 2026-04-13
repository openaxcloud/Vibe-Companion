import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import InvestmentsPage from './pages/InvestmentsPage'
import InsightsPage from './pages/InsightsPage'
import ContactPage from './pages/ContactPage'
import { useLocation } from 'react-router-dom'

function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-slate-950 overflow-x-hidden">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="pt-16"
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/investments" element={<InvestmentsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/contact" element={<ContactPage />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
      <Footer />
    </div>
  )
}

export default App