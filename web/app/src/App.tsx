import './App.css'
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom'
import Chat from './components/Chat.tsx'
function App() {
  

  return (
    <div>
      <Router>
        <Routes>
          <Route path='/agent/chat' element={<Chat />} />
        </Routes>
      </Router>
    </div>
  )
}

export default App
