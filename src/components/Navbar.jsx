import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  Home,
  List,
  Building2,
  Heart,
  BarChart3,
  LogOut,
  User,
  Menu,
  X,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { useAuth } from '../context/AuthContext.jsx';

const PUBLIC_NAV_LINKS = [
  {
    to: '/',
    label: 'Buy',
    icon: Home,
  },
  {
    to: '/rentals',
    label: 'Rent',
    icon: List,
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: Building2,
  },
  {
    to: '/insights',
    label: 'Insights',
    icon: BarChart3,
  },
];

const SAVED_LINK = {
  to: '/saved',
  label: 'Saved',
  icon: Heart,
};

export default function Navbar() {
  const {
    user,
    isAuthenticated,
    logout,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  /*
   * Close the mobile navigation whenever the route changes.
   * This also handles navigation triggered outside the navbar.
   */
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await logout();
    } finally {
      closeMenu();
      navigate('/login', {
        replace: true,
      });
      setLoggingOut(false);
    }
  }, [
    loggingOut,
    logout,
    navigate,
    closeMenu,
  ]);

  /*
   * The login page intentionally has no global navbar.
   */
  if (location.pathname === '/login') {
    return null;
  }

  const navLinks = isAuthenticated
    ? [...PUBLIC_NAV_LINKS, SAVED_LINK]
    : PUBLIC_NAV_LINKS;

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-50 border-b border-white/10 bg-navy-900 shadow-lg"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">

          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-navy-900"
            onClick={closeMenu}
            aria-label="Ivy Homes home"
          >
            <span className="text-xl font-bold tracking-tight text-emerald-400">
              ivy
            </span>

            <span className="text-sm font-normal text-white/70">
              homes
            </span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map(
              ({
                to,
                label,
                icon: Icon,
              }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-emerald-400',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:bg-white/5 hover:text-white',
                    ].join(' ')
                  }
                >
                  <Icon
                    size={15}
                    aria-hidden="true"
                  />

                  {label}
                </NavLink>
              )
            )}
          </div>

          {/* Desktop authentication */}
          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <>
                <span className="flex max-w-[220px] items-center gap-1 truncate text-xs text-white/50">
                  <User
                    size={13}
                    aria-hidden="true"
                    className="shrink-0"
                  />

                  <span className="truncate">
                    {user?.email || 'Signed in'}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex items-center gap-1 rounded text-sm text-white/60 transition-colors hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut
                    size={14}
                    aria-hidden="true"
                  />

                  {loggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-navy-900"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="rounded p-1.5 text-white/60 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={
              open
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
          >
            {open ? (
              <X
                size={20}
                aria-hidden="true"
              />
            ) : (
              <Menu
                size={20}
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {open && (
        <div
          id="mobile-navigation"
          className="space-y-1 border-t border-white/10 bg-navy-950 px-4 py-3 md:hidden"
        >
          {navLinks.map(
            ({
              to,
              label,
              icon: Icon,
            }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={closeMenu}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded px-3 py-2 text-sm font-medium',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-400',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white',
                  ].join(' ')
                }
              >
                <Icon
                  size={16}
                  aria-hidden="true"
                />

                {label}
              </NavLink>
            )
          )}

          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-400 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut
                size={16}
                aria-hidden="true"
              />

              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          ) : (
            <Link
              to="/login"
              onClick={closeMenu}
              className="block rounded px-3 py-2 text-sm font-medium text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              Sign in
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}