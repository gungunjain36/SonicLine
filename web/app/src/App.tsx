import './App.css'
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom'
import Chat from './components/Chat.tsx'
import Home from './components/Home.tsx'
import TwilioCalls from './components/TwilioCalls.tsx'

function App() {
  

  return (
    <div>
      <Router>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/agent/chat' element={<Chat />} />
          <Route path='/twilio/calls' element={<TwilioCalls />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App
