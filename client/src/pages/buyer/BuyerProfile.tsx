import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../../components/shared/Card';
import { Button } from '../../components/shared/Button';

const BuyerProfile: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-surface-900 mb-6">My Profile</h1>
      
      <Card className="!p-8">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-3xl font-bold">
            {user.name?.[0]?.toUpperCase() || 'B'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-900">{user.name}</h2>
            <p className="text-surface-500">{user.phone}</p>
            <span className="inline-block mt-2 text-xs font-semibold bg-surface-100 text-surface-600 px-2 py-1 rounded">
              {user.role}
            </span>
          </div>
        </div>

        <div className="border-t border-surface-200 pt-6">
          <Button variant="danger" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default BuyerProfile;
