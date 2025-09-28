import { useForm } from 'react-hook-form';
import { useAuth } from '@/auth/useAuth';
import type { RegisterFormData } from '@/auth/types';

const RegisterForm = () => {
  const { register: registerUser, error, clearError, isLoading } = useAuth();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormData>({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password');


  const onSubmit = async (values: RegisterFormData) => {
    if (values.password !== values.confirmPassword) {
      setError('confirmPassword', { type: 'validate', message: 'Passwords do not match' });
      return;
    }
    try {
      await registerUser(values.username, values.email, values.password);
    } catch (_error) {
      // Error message handled via auth store
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
          {...register('username', { required: 'Username is required', minLength: { value: 3, message: 'Use at least 3 characters' } })}
        />
        {errors.username ? <p className="text-xs text-red-600">{errors.username.message}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-eink-black">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-md border border-eink-pale-gray px-3 py-2 text-sm focus:border-eink-black focus:outline-none focus:ring-0"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /\S+@\S+\.\S+/, // basic email format
              message: 'Enter a valid email address',
            },
          })}
        />
        {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-eink-black">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border border-eink-pale-gray px-3 py-2 text-sm focus:border-eink-black focus:outline-none focus:ring-0"
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 8, message: 'Use at least 8 characters' },
          })}
        />
        {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-eink-black">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border border-eink-pale-gray px-3 py-2 text-sm focus:border-eink-black focus:outline-none focus:ring-0"
          {...register('confirmPassword', {
            required: 'Confirm your password',
            validate: (value) => value === passwordValue || 'Passwords do not match',
          })}
        />
        {errors.confirmPassword ? <p className="text-xs text-red-600">{errors.confirmPassword.message}</p> : null}
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <button
        type="submit"
        disabled={isSubmitting || isLoading}
        className="flex w-full items-center justify-center rounded-md bg-eink-black px-4 py-2 text-sm font-semibold text-eink-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting || isLoading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
};

export default RegisterForm;
