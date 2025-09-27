import { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface UserAgreementProps {
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}

const UserAgreement = ({ onAccept, onDecline, isLoading = false }: UserAgreementProps) => {
  const [hasRead, setHasRead] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          <h2 className="text-xl font-semibold text-eink-black">Terms of Use</h2>
        </div>

        <div className="space-y-4 text-sm text-eink-dark-gray">
          <p>
            <strong>This system is for personal use only.</strong> Commercial use is prohibited.
          </p>

          <div className="bg-orange-50 p-3 rounded-md border border-orange-200">
            <p className="text-orange-800">
              <strong>Important:</strong> This is open-source software provided "AS IS" with no guarantees.
              We're not responsible for any data loss or issues. Don't store sensitive information.
            </p>
          </div>

          <p>
            By continuing, you acknowledge that you understand these terms and use this system at your own risk.
          </p>
        </div>

        <div className="mt-6">
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={hasRead}
              onChange={(e) => setHasRead(e.target.checked)}
              className="rounded border-gray-300 text-eink-black focus:ring-eink-black"
            />
            <span className="text-sm text-eink-dark-gray">
              I have read and understand these terms
            </span>
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onDecline}
              disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-4 w-4" />
              Decline
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!hasRead || isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-eink-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4" />
              {isLoading ? 'Accepting...' : 'Accept & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAgreement;