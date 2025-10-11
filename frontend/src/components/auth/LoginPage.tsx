import { Link } from 'react-router-dom';
import { Github, BookOpen, ExternalLink, Heart, Sparkles } from 'lucide-react';
import AuthLayout from './AuthLayout';
import LoginForm from './LoginForm';
import { VersionService } from '@/services/version';

const LoginPage = () => {
  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your templates and continue where you left off."
      header={
        <Link
          to="/gallery"
          className="block w-full mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg hover:border-blue-400 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Explore Public Gallery</div>
                <div className="text-sm text-gray-600">Browse tutorials and example templates</div>
              </div>
            </div>
            <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
        </Link>
      }
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
