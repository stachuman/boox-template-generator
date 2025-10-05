import { Link } from 'react-router-dom';
import { Github, BookOpen, ExternalLink, Heart, Globe } from 'lucide-react';
import AuthLayout from './AuthLayout';
import LoginForm from './LoginForm';
import { VersionService } from '@/services/version';

const LoginPage = () => {
  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your templates and continue where you left off."
      footer={
        <div className="space-y-4">
          <div className="space-y-2">
            <div>
              Forgot your password?{' '}
              <Link to="/reset-password" className="text-eink-black underline">
                Reset it here
              </Link>
              .
            </div>
            <div>
              Need an account?{' '}
              <Link to="/register" className="text-eink-black underline">
                Create one now
              </Link>
              .
            </div>
            <div>
              Just browsing?{' '}
              <Link to="/gallery" className="text-eink-black underline">
                Explore public gallery
              </Link>
              .
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
              <a
                href="https://github.com/stachuman/boox-template-generator"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-eink-dark-gray hover:text-eink-black transition-colors"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://github.com/stachuman/boox-template-generator/blob/main/TUTORIAL.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-eink-dark-gray hover:text-eink-black transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                <span>Tutorial</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://paypal.me/StachuMan"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors"
              >
                <Heart className="h-4 w-4" />
                <span>Donate</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="text-center text-xs text-eink-dark-gray mt-2">
              {VersionService.getAppName()} {VersionService.getVersionString()}
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
};

export default LoginPage;
