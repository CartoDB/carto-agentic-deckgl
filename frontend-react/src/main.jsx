import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/main.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import App from './App.jsx'
import { MapToolsProvider } from './contexts/MapToolsContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MapToolsProvider>
      <App />
    </MapToolsProvider>
  </StrictMode>,
)
