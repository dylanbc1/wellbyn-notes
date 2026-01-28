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
    <div className="w-64 bg-[#F0F8FF] min-h-screen flex flex-col border-r border-[#E0F2FF]">
      {/* Logo/Header */}
      <div className="p-6 border-b border-[#E0F2FF] text-center">
        <div className="flex items-center justify-center space-x-3">
          <FaStethoscope className="text-3xl text-[#5FA9DF]" />
          <h1 className="text-2xl font-bold text-[#0C1523]">Notes</h1>
        </div>
        <p className="text-sm text-[#0C1523] font-bold mt-2">
          Panel médico
        </p>
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
                  : 'text-[#0C1523] hover:bg-[#E0F2FF]'
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
                  : 'text-[#0C1523] hover:bg-[#E0F2FF]'
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
                    : 'text-[#0C1523] hover:bg-[#E0F2FF]'
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
      <div className="p-4 border-t border-[#E0F2FF]">
        {user && (
          <div className="mb-4">
            <div className="flex items-center space-x-3 px-3 py-2 bg-white rounded-lg border border-[#E0F2FF] shadow-sm">
              <div className="w-8 h-8 bg-[#5FA9DF] rounded-full flex items-center justify-center">
                <FaUser className="text-white text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0C1523] truncate">
                  {user.full_name}
                </p>
                <p className="text-xs text-[#0C1523] font-medium truncate">
                  {user.role === 'doctor' ? 'Doctor' : 'Administrador'}
                </p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-[#0C1523] font-medium hover:bg-[#E0F2FF] transition-all duration-200"
        >
          <FaSignOutAlt className="text-xl" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
        <p className="text-xs text-[#0C1523] font-medium text-center mt-4">
          © 2025 Wellbyn Notes
        </p>
      </div>
    </div>
  );
};

