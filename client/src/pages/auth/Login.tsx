import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth.api';
import { Input } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { ErrorAlert } from '../../components/shared/Alerts';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (formData: LoginFormData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.login(formData);
      login(response.data.token, response.data.user);

      // Role-based redirect
      switch (response.data.user.role) {
        case 'ADMIN':
          navigate('/admin/dashboard', { replace: true });
          break;
        case 'FIELD_AGENT':
          navigate('/agent/dashboard', { replace: true });
          break;
        case 'BUYER':
          navigate('/marketplace', { replace: true });
          break;
        default:
          navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status?: number; data?: { message?: string; code?: string } };
      };
      if (axiosError.response?.status === 403) {
        setError('Your account has been suspended. Please contact support.');
      } else if (axiosError.response?.data?.message) {
        setError(axiosError.response.data.message);
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 text-white mb-4 shadow-glow">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Welcome back</h1>
          <p className="text-surface-500 mt-1">Sign in to AgroVoice</p>
        </div>

        {/* Form Card */}
        <div className="card p-8">
          {error && <ErrorAlert className="mb-4" onDismiss={() => setError(null)}>{error}</ErrorAlert>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Register as a buyer
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-surface-400 mt-6">
          AgroVoice — Connecting farmers and buyers across Ghana
        </p>
      </div>
    </div>
  );
};

export default Login;
