import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/shared/Button';

const Unauthorized: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4">
    <div className="text-center max-w-md">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-6">
        <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-surface-900 mb-2">Access Denied</h1>
      <p className="text-surface-500 mb-8">
        You don't have permission to access this page. Please contact your administrator if you believe this is an error.
      </p>
      <div className="flex gap-3 justify-center">
        <Link to="/">
          <Button variant="primary">Go to Home</Button>
        </Link>
        <Link to="/login">
          <Button variant="secondary">Sign In</Button>
        </Link>
      </div>
    </div>
  </div>
);

export default Unauthorized;
