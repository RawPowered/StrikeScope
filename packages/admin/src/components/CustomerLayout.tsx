import { Outlet, Link } from 'react-router-dom'

export default function CustomerLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-white px-6 py-3 flex justify-between items-center">
        <Link to="/customer/dashboard" className="font-bold text-base hover:opacity-90 transition-opacity">
          StrikeScope — Customer Portal
        </Link>
      </header>
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
