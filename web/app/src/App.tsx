import './App.css'
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom'
import Chat from './components/Chat.tsx'
import Home from './components/Home.tsx'
function App() {
  

  return (
    <div>
      <Router>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/agent/chat' element={<Chat />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App
