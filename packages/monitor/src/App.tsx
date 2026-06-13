import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import LiveFeed from './pages/LiveFeed'
import SubmissionDetail from './pages/SubmissionDetail'
import MapView from './pages/MapView'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav">
          <div className="nav-brand">StrikeScope</div>
          <div className="nav-links">
            <NavLink to="/" end>Live Feed</NavLink>
            <NavLink to="/map">Map View</NavLink>
          </div>
        </nav>
        <main className="main">
          <Routes>
            <Route path="/" element={<LiveFeed />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/submissions/:id" element={<SubmissionDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
