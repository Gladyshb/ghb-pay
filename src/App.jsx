import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppShell from '@/components/ghb/AppShell';
// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// App pages
import Home from '@/pages/Home';
import Kyc from '@/pages/Kyc';
import Deposit from '@/pages/Deposit';
import Transfer from '@/pages/Transfer';
import Transactions from '@/pages/Transactions';
import History from '@/pages/History';
import Chat from '@/pages/Chat';
import Admin from '@/pages/Admin';
import About from '@/pages/About';
import Referral from '@/pages/Referral';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected app routes */}
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/kyc" element={<Kyc />} />
                <Route path="/deposit" element={<Deposit />} />
                <Route path="/transfer" element={<Transfer />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/history" element={<History />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/about" element={<About />} />
                <Route path="/referral" element={<Referral />} />
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </AuthProvider>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App