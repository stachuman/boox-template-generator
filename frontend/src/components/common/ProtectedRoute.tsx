import { ReactNode, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import UserAgreement from '@/components/auth/UserAgreement';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user, acceptTerms } = useAuth();
  const location = useLocation();
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-eink-off-white">
        <div className="text-sm text-eink-dark-gray">Loading your workspace…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check if user needs to accept terms
  if (user && !user.terms_accepted_at) {
    const handleAcceptTerms = async () => {
      setIsAcceptingTerms(true);
      try {
        await acceptTerms();
      } catch (error) {
        console.error('Failed to accept terms:', error);
      } finally {
        setIsAcceptingTerms(false);
      }
    };

    const handleDeclineTerms = () => {
      // If user declines terms, log them out
      window.location.href = '/login';
    };

    return (
      <UserAgreement
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
        isLoading={isAcceptingTerms}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
