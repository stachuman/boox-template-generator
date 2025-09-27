import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/auth/useAuth';
import type { PasswordResetFormData } from '@/auth/types';

const PasswordResetRequestForm = () => {
  const { requestPasswordReset, error, clearError } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PasswordResetFormData>({
    defaultValues: {
      email: '',
    },
  });
  const [isSent, setIsSent] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (values: PasswordResetFormData) => {
    try {
      await requestPasswordReset(values.email);
      setIsSent(true);
    } catch (_error) {
      setIsSent(false);
      return;
    }
    reset({ email: values.email });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1">
        <label htmlFor="reset-email" className="block text-sm font-medium text-eink-black">
          Email address
        </label>
        <input
          id="reset-email"
          type="email"
          className="w-full rounded-md border border-eink-pale-gray px-3 py-2 text-sm focus:border-eink-black focus:outline-none focus:ring-0"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /\S+@\S+\.\S+/, // simple email validation
              message: 'Enter a valid email address',
            },
          })}
        />
        {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {isSent && !error ? (
        <div className="rounded-md bg-eink-pale-gray px-3 py-2 text-sm text-eink-dark-gray">
          If an account exists for that email, we sent a reset link.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center rounded-md bg-eink-black px-4 py-2 text-sm font-semibold text-eink-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Send password reset link'}
      </button>
    </form>
  );
};

export default PasswordResetRequestForm;
