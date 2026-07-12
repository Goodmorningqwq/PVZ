import { useEffect, useState } from 'react'
import './App.css'

export default function App() {
  const [connected, setConnected] = useState(false)
  const [socketStatus, setSocketStatus] = useState('Initializing...')

  useEffect(() => {
    // Import Socket.io dynamically
    const initSocket = async () => {
      try {
        const { io } = await import('socket.io-client')

        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
        console.log(`Connecting to backend: ${backendUrl}`)

        const socket = io(backendUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5
        })

        socket.on('connect', () => {
          console.log('✓ Connected to backend')
          setConnected(true)
          setSocketStatus('Connected')
        })

        socket.on('disconnect', () => {
          console.log('✗ Disconnected from backend')
          setConnected(false)
          setSocketStatus('Disconnected')
        })

        socket.on('error', (error) => {
          console.error('Socket error:', error)
          setSocketStatus(`Error: ${error}`)
        })

        return () => {
          socket.disconnect()
        }
      } catch (error) {
        console.error('Failed to initialize socket:', error)
        setSocketStatus(`Error: ${error}`)
      }
    }

    initSocket()
  }, [])

  return (
    <div className="app">
      <div className="container">
        <h1>🌱 Plants vs Zombies - Multiplayer</h1>

        <div className="status">
          <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢' : '🔴'}
          </div>
          <p>Backend Status: <strong>{socketStatus}</strong></p>
        </div>

        <div className="info">
          <h2>Welcome!</h2>
          <p>Backend is live and ready for the frontend to be built.</p>

          <div className="links">
            <a href="https://github.com/Goodmorningqwq/PVZ" target="_blank" rel="noopener noreferrer">
              📖 View on GitHub
            </a>
            <a href="https://pvz-backend-otiq.onrender.com/api/health" target="_blank" rel="noopener noreferrer">
              🔧 Backend Health Check
            </a>
          </div>
        </div>

        <div className="next-steps">
          <h3>Next Steps (Week 1-2):</h3>
          <ol>
            <li>Build Phaser game scenes (MenuScene, GameScene)</li>
            <li>Implement Socket.io event handlers</li>
            <li>Create game board UI (8x5 grid)</li>
            <li>Add plant placement mechanics</li>
            <li>Render opponent actions in real-time</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
