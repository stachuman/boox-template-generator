import { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

const AuthLayout = ({ title, subtitle, footer, children }: AuthLayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col bg-eink-off-white">
      <header className="flex items-center justify-between px-4 py-6">
        <Link to="/" className="text-lg font-semibold text-eink-black">
          E-ink Templates Creator
        </Link>
        <div className="text-sm text-eink-dark-gray">Craft planners for your e-reader for free</div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md rounded-lg border border-eink-pale-gray bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-eink-black">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-eink-dark-gray">{subtitle}</p> : null}
          </div>
          {children}
          {footer ? <div className="mt-6 text-center text-sm text-eink-dark-gray">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
