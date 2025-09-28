import { Link } from 'react-router-dom';
import { Github, BookOpen, ExternalLink, Heart } from 'lucide-react';
import AuthLayout from './AuthLayout';
import RegisterForm from './RegisterForm';

const RegisterPage = () => {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up to sync projects and share templates with the community."
      footer={
        <div className="space-y-4">
          <div>
            Already have an account?{' '}
            <Link to="/login" className="text-eink-black underline">
              Sign in instead
            </Link>
            .
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
          </div>
        </div>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
};

export default RegisterPage;
