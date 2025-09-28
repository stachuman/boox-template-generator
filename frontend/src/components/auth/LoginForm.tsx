import { useForm } from 'react-hook-form';
import { useAuth } from '@/auth/useAuth';
import type { LoginFormData } from '@/auth/types';

const LoginForm = () => {
  const { login, error, clearError, isLoading } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    defaultValues: {
      username: '',
      password: '',
    },
  });


  const onSubmit = async (values: LoginFormData) => {
    try {
      await login(values.username, values.password);
    } catch (_error) {
      // Error message handled via auth store state
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1">
        <label htmlFor="username" className="block text-sm font-medium text-eink-black">
          Username
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          className="w-full rounded-md border border-eink-pale-gray px-3 py-2 text-sm focus:border-eink-black focus:outline-none focus:ring-0"
          {...register('username', { required: 'Username is required' })}
        />
        {errors.username ? (
          <p className="text-xs text-red-600">{errors.username.message}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-eink-black">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-eink-pale-gray px-3 py-2 text-sm focus:border-eink-black focus:outline-none focus:ring-0"
          {...register('password', { required: 'Password is required' })}
        />
        {errors.password ? (
          <p className="text-xs text-red-600">{errors.password.message}</p>
        ) : null}
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <button
        type="submit"
        disabled={isSubmitting || isLoading}
        className="flex w-full items-center justify-center rounded-md bg-eink-black px-4 py-2 text-sm font-semibold text-eink-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting || isLoading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
};

export default LoginForm;
