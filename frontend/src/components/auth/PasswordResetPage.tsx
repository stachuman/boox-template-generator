import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import PasswordResetRequestForm from './PasswordResetRequestForm';
import PasswordResetConfirmForm from './PasswordResetConfirmForm';

const PasswordResetPage = () => {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() ?? '', [params]);

  const isConfirmMode = token.length > 0;

  return (
    <AuthLayout
      title={isConfirmMode ? 'Choose a new password' : 'Reset your password'}
      subtitle={
        isConfirmMode
          ? 'Enter a secure password to regain access to your workspace.'
          : 'We will email you a link to create a new password. (not yet implemented)'
      }
      footer={
        <div>
          <Link to="/login" className="text-eink-black underline">
            Back to sign in
          </Link>
        </div>
      }
    >
      {isConfirmMode ? (
        <PasswordResetConfirmForm token={token} />
      ) : (
        <PasswordResetRequestForm />
      )}
    </AuthLayout>
  );
};

export default PasswordResetPage;
