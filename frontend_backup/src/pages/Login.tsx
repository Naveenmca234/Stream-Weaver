import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Network } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [error, setError] = React.useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('');
      const response = await authApi.login(data as any);
      login(response.data.user, response.data.accessToken, response.data.refreshToken);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-950 p-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-400 to-indigo-500 flex items-center justify-center shadow-2xl shadow-accent-500/20">
              <Network className="w-10 h-10 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-white mb-1">StreamWeaver</h1>
              <p className="text-sm text-gray-400">Visual ETL. Massive Scale. Zero-Code Complexity.</p>
            </div>
          </div>
        </div>

        <div className="glass p-8 rounded-xl shadow-2xl border border-base-700/50">
          <h2 className="text-xl font-semibold text-white mb-6">Welcome back</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="name@company.com"
              {...register('email')}
              error={errors.email?.message}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
            />

            {error && (
              <div className="p-3 rounded bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              isLoading={isSubmitting}
            >
              Sign in
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Demo Account: Use <code className="text-accent-400 bg-accent-500/10 px-1 py-0.5 rounded">admin@example.com</code> / <code className="text-accent-400 bg-accent-500/10 px-1 py-0.5 rounded">password123</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
