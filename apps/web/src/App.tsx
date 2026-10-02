import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DialogProvider, ToastViewport } from './components/ui'
import { AccountSettings } from './routes/AccountSettings'
import { AdminDashboard } from './routes/AdminDashboard'
import { BoardHome } from './routes/BoardHome'
import { Login } from './routes/Login'
import { PublicBoard } from './routes/PublicBoard'
import { Shell } from './routes/Shell'

export function App() {
  return (
    <BrowserRouter>
      <DialogProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/share/:token" element={<PublicBoard />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<BoardHome />} />
            <Route path="/b/:boardId" element={<Shell />} />
            <Route path="/account" element={<AccountSettings />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastViewport />
      </DialogProvider>
    </BrowserRouter>
  )
}
