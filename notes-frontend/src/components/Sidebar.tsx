import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaHistory, FaStethoscope, FaPlug, FaSignOutAlt, FaUser } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdministrator } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="w-64 bg-[#0C1523] min-h-screen flex flex-col">
      {/* Logo/Header */}
      <div className="p-6 border-b border-[#1a2332]">
        <div className="flex items-center space-x-3">
          <FaStethoscope className="text-3xl text-[#5FA9DF]" />
          <h1 className="text-2xl font-bold text-white">Notes</h1>
        </div>
        <p className="text-sm text-[#6B7280] mt-2">Panel Médico</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <Link
              to="/"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive('/')
                  ? 'bg-[#5FA9DF] text-white'
                  : 'text-[#9CA3AF] hover:bg-[#1a2332] hover:text-white'
              }`}
            >
              <FaHome className="text-xl" />
              <span className="font-medium">Inicio</span>
            </Link>
          </li>
          <li>
            <Link
              to="/historial"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive('/historial')
                  ? 'bg-[#5FA9DF] text-white'
                  : 'text-[#9CA3AF] hover:bg-[#1a2332] hover:text-white'
              }`}
            >
              <FaHistory className="text-xl" />
              <span className="font-medium">Historial</span>
            </Link>
          </li>
          {isAdministrator && (
            <li>
              <Link
                to="/ehr-config"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive('/ehr-config')
                    ? 'bg-[#5FA9DF] text-white'
                    : 'text-[#9CA3AF] hover:bg-[#1a2332] hover:text-white'
                }`}
              >
                <FaPlug className="text-xl" />
                <span className="font-medium">Integración EHR</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-[#1a2332]">
        {user && (
          <div className="mb-4">
            <div className="flex items-center space-x-3 px-3 py-2 bg-[#1a2332] rounded-lg">
              <div className="w-8 h-8 bg-[#5FA9DF] rounded-full flex items-center justify-center">
                <FaUser className="text-white text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.full_name}
                </p>
                <p className="text-xs text-[#6B7280] truncate">
                  {user.role === 'doctor' ? 'Doctor' : 'Administrador'}
                </p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-[#9CA3AF] hover:bg-[#1a2332] hover:text-white transition-all duration-200"
        >
          <FaSignOutAlt className="text-xl" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
        <p className="text-xs text-[#6B7280] text-center mt-4">
          © 2025 Wellbyn Notes
        </p>
      </div>
    </div>
  );
};

