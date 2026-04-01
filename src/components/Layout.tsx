import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChefHat, LayoutDashboard, Package, DollarSign, UtensilsCrossed, Wine, Calculator, LogOut, Menu, Users, Settings as SettingsIcon, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const { userData, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
    { name: 'Estoque', path: '/inventory', icon: Package, roles: ['admin', 'manager'] },
    { name: 'Financeiro', path: '/finance', icon: DollarSign, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Garçons', path: '/waiters', icon: Users, roles: ['admin', 'manager'] },
    { name: 'Atendimento', path: '/waiter', icon: Menu, roles: ['waiter'] },
    { name: 'Cozinha', path: '/kitchen', icon: UtensilsCrossed, roles: ['admin', 'manager', 'kitchen'] },
    { name: 'Bar', path: '/bar', icon: Wine, roles: ['admin', 'manager', 'bar'] },
    { name: 'Caixa', path: '/cashier', icon: Calculator, roles: ['admin', 'manager', 'cashier'] },
    { name: 'Configurações', path: '/settings', icon: SettingsIcon, roles: ['admin', 'manager'] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(userData?.role || ''));

  return (
    <div className="flex h-screen bg-zinc-50 flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:hidden">
        <div className="flex items-center gap-2">
          <ChefHat className="text-orange-600" />
          <span className="text-lg font-bold">RestoSys</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg"
        >
          <Menu size={24} />
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <aside 
            className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between border-b px-6">
              <div className="flex items-center gap-2">
                <ChefHat className="text-orange-600" />
                <span className="text-lg font-bold">RestoSys</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-400">
                <X size={24} />
              </button>
            </div>
            
            <nav className="flex-1 space-y-1 p-4">
              {filteredNav.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    location.pathname.startsWith(item.path) 
                      ? "bg-orange-50 text-orange-600" 
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  <item.icon size={20} />
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="border-t p-4">
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut size={20} />
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar for Desktop */}
      <aside className="hidden w-64 flex-col border-r bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <ChefHat className="text-orange-600" />
          <span className="text-lg font-bold">RestoSys</span>
        </div>
        
        <nav className="flex-1 space-y-1 p-4">
          {filteredNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                location.pathname.startsWith(item.path) 
                  ? "bg-orange-50 text-orange-600" 
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <item.icon size={20} />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="border-t p-4">
          <div className="mb-4 flex items-center gap-3 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-600">
              {userData?.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{userData?.name}</span>
              <span className="text-xs text-zinc-500 capitalize">{userData?.role}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom Nav for Mobile (Waiters) */}
      {userData?.role === 'waiter' && (
        <nav className="fixed bottom-0 left-0 right-0 flex h-16 items-center justify-around border-t bg-white md:hidden">
          <Link to="/waiter" className={cn("flex flex-col items-center p-2", location.pathname === '/waiter' ? "text-orange-600" : "text-zinc-500")}>
            <Menu size={24} />
            <span className="text-[10px] font-medium">Mesas</span>
          </Link>
          <button onClick={logout} className="flex flex-col items-center p-2 text-red-500">
            <LogOut size={24} />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        </nav>
      )}
    </div>
  );
}
