import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import BlogPost from './pages/BlogPost'
import About from './pages/About'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/post/:slug" element={<BlogPost />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Layout>
  )
}

export default App