import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/auth/useAuth';
import type { PasswordResetConfirmData } from '@/auth/types';

interface PasswordResetConfirmFormProps {
  token: string;
}

const PasswordResetConfirmForm = ({ token }: PasswordResetConfirmFormProps) => {
  const { confirmPasswordReset, error, clearError } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setError,
  } = useForm<PasswordResetConfirmData>({
    defaultValues: {
      token,
      newPassword: '',
      confirmPassword: '',
    },
  });

  const [isSuccess, setIsSuccess] = useState(false);
  const passwordValue = watch('newPassword');

  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (values: PasswordResetConfirmData) => {
    clearError();
    if (values.newPassword !== values.confirmPassword) {
      setError('confirmPassword', { type: 'validate', message: 'Passwords do not match' });
      return;
    }
    try {
      await confirmPasswordReset(values.token, values.newPassword);
      setIsSuccess(true);
    } catch (_error) {
      setIsSuccess(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1">
        <label htmlFor="newPassword" className="block text-sm font-medium text-eink-black">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border border-eink-pale-gray px-3 py-2 text-sm focus:border-eink-black focus:outline-none focus:ring-0"
          {...register('newPassword', {
            required: 'Password is required',
            minLength: { value: 8, message: 'Use at least 8 characters' },
          })}
        />
        {errors.newPassword ? <p className="text-xs text-red-600">{errors.newPassword.message}</p> : null}
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
      {isSuccess ? (
        <div className="rounded-md bg-eink-pale-gray px-3 py-2 text-sm text-emerald-700">
          Password updated successfully. You can now sign in with your new password.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || isSuccess}
        className="flex w-full items-center justify-center rounded-md bg-eink-black px-4 py-2 text-sm font-semibold text-eink-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
};

export default PasswordResetConfirmForm;
