import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Messenger from './Messenger'
import { MessengerProvider } from '../contexts/MessengerContext'

export default function Layout() {
  return (
    <MessengerProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        <Messenger />
      </div>
    </MessengerProvider>
  )
}
