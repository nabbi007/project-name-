import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { redirectAfterAuth, sanitizeRedirect } from '../../utils/authRedirect';
import { authApi } from '../../api/auth.api';
import { Input } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { ErrorAlert } from '../../components/shared/Alerts';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().min(10, 'Enter a valid phone number').max(15, 'Phone number too long').optional().or(z.literal('')),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (formData: RegisterFormData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.registerBuyer({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        password: formData.password,
      });
      login(response.data.token, response.data.user);
      navigate(redirectAfterAuth('BUYER', redirectParam), { replace: true });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      if (axiosError.response?.data?.message) {
        setError(axiosError.response.data.message);
      } else {
        setError('Registration failed. Please try again.');
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
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Create your account</h1>
          <p className="text-surface-500 mt-1">Join AgroVoice as a buyer</p>
        </div>

        {/* Form Card */}
        <div className="card p-8">
          {error && <ErrorAlert className="mb-4" onDismiss={() => setError(null)}>{error}</ErrorAlert>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              error={errors.name?.message}
              {...formRegister('name')}
            />

            <Input
              label="Email"
              type="email"
              placeholder="e.g. buyer@example.com"
              error={errors.email?.message}
              {...formRegister('email')}
            />

            <Input
              label="Phone Number (optional)"
              type="tel"
              placeholder="e.g. 0240000000"
              error={errors.phone?.message}
              {...formRegister('phone')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="At least 6 characters"
              error={errors.password?.message}
              {...formRegister('password')}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your password"
              error={errors.confirmPassword?.message}
              {...formRegister('confirmPassword')}
            />

            <Button type="submit" loading={loading} className="w-full">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-6">
            Already have an account?{' '}
            <Link
              to={
                sanitizeRedirect(redirectParam)
                  ? `/login?redirect=${encodeURIComponent(sanitizeRedirect(redirectParam)!)}`
                  : '/login'
              }
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Sign in
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

export default Register;
