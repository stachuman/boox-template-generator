/**
 * PDF Job Status Component
 *
 * Displays async PDF generation job status with polling and download.
 * Shows progress, error messages, diagnostics, and provides download button when ready.
 */

import React, { useEffect, useRef, useState } from 'react';
import { PDFJob, PDFJobStatus as JobStatus } from '@/types';
import { APIClient } from '@/services/api';

interface PDFJobStatusProps {
  jobId: string;
  onComplete?: (job: PDFJob) => void;
  onError?: (job: PDFJob) => void;
  onCancel?: () => void;
  autoDownload?: boolean;
}

export const PDFJobStatusComponent: React.FC<PDFJobStatusProps> = ({
  jobId,
  onComplete,
  onError,
  onCancel,
  autoDownload = false,
}) => {
  const [job, setJob] = useState<PDFJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const prevStatusRef = useRef<JobStatus | null>(null);

  const fetchJobStatus = async () => {
    console.log('[PDFJobStatus] Fetching job status for:', jobId);
    try {
      const jobData = await APIClient.getPDFJob(jobId);
      console.log('[PDFJobStatus] Got job data:', jobData.id, 'status:', jobData.status);
      setJob(jobData);
      setLoading(false);
    } catch (err: any) {
      console.error('[PDFJobStatus] Failed to fetch job:', err);
      setError(err.response?.data?.message || 'Failed to fetch job status');
      setLoading(false);
      setPolling(false);
    }
  };

  useEffect(() => {
    if (!polling) return;

    // Fetch immediately on mount
    fetchJobStatus();

    // Then poll every 2 seconds
    const interval = setInterval(fetchJobStatus, 2000);

    return () => clearInterval(interval);
  }, [jobId, polling]);

  useEffect(() => {
    if (!job) return;

    const prevStatus = prevStatusRef.current;
    const currentStatus = job.status;
    const isTerminal = ['completed', 'failed', 'cancelled'].includes(currentStatus);

    // Always update prevStatusRef first
    const statusChanged = currentStatus !== prevStatus;
    prevStatusRef.current = currentStatus;

    // Handle status change callbacks
    if (statusChanged) {
      console.log(`[PDFJobStatus] Status changed: ${prevStatus} → ${currentStatus}`);

      if (currentStatus === 'completed') {
        onComplete?.(job);
        // autoDownload feature removed - parent component handles download
      } else if (currentStatus === 'failed') {
        onError?.(job);
      } else if (currentStatus === 'cancelled') {
        onCancel?.();
      }
    }

    // Stop polling after handling callbacks
    if (isTerminal) {
      setPolling(false);
    }
  }, [job, autoDownload, onComplete, onError, onCancel]);


  // Cancel job
  const handleCancel = async () => {
    if (!job || !['pending', 'processing'].includes(job.status)) return;

    try {
      await APIClient.cancelPDFJob(jobId);
      await fetchJobStatus();
      onCancel?.();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel job');
    }
  };

  // Helpers
  const getStatusInfo = (status: JobStatus): { color: string; icon: string; label: string } => {
    switch (status) {
      case 'pending':
        return { color: 'text-blue-600', icon: '⏳', label: 'Pending' };
      case 'processing':
        return { color: 'text-yellow-600', icon: '⚙️', label: 'Processing' };
      case 'completed':
        return { color: 'text-green-600', icon: '✅', label: 'Completed' };
      case 'failed':
        return { color: 'text-red-600', icon: '❌', label: 'Failed' };
      case 'cancelled':
        return { color: 'text-gray-600', icon: '🚫', label: 'Cancelled' };
      default:
        return { color: 'text-gray-600', icon: '❓', label: 'Unknown' };
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTime = (isoString: string | null | undefined): string => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const getDuration = (): string | null => {
    if (!job?.started_at || !job?.completed_at) return null;
    const start = new Date(job.started_at).getTime();
    const end = new Date(job.completed_at).getTime();
    const seconds = Math.round((end - start) / 1000);
    return `${seconds}s`;
  };

  const compileDiagnostics = job?.diagnostics?.compile ?? null;
  const renderDiagnostics = job?.diagnostics?.render ?? null;
  const compileWarnings = compileDiagnostics?.warnings ?? [];
  const renderWarnings = renderDiagnostics?.warnings ?? [];
  const compileStats = (compileDiagnostics?.stats as Record<string, unknown> | null) ?? null;
  const compileTotalPages =
    compileStats && typeof compileStats['total_pages'] === 'number'
      ? (compileStats['total_pages'] as number)
      : null;
  const compileTotalWidgets =
    compileStats && typeof compileStats['total_widgets'] === 'number'
      ? (compileStats['total_widgets'] as number)
      : null;

  const renderWarningList = (warnings: string[]) => (
    <ul className="list-disc pl-5 space-y-1">
      {warnings.map((warning, index) => (
        <li key={index} className="text-xs text-yellow-800">{warning}</li>
      ))}
    </ul>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading job status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <span className="text-red-600 text-xl mr-2">⚠️</span>
          <div>
            <div className="font-semibold text-red-800">Error</div>
            <div className="text-red-700 text-sm">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const statusInfo = getStatusInfo(job.status);
  const duration = getDuration();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-2xl mr-2">{statusInfo.icon}</span>
          <div>
            <div className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</div>
            <div className="text-xs text-gray-500">Job ID: {job.id.substring(0, 8)}...</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {['pending', 'processing'].includes(job.status) && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar for pending/processing */}
      {['pending', 'processing'].includes(job.status) && (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              job.status === 'processing' ? 'bg-yellow-500 animate-pulse' : 'bg-blue-500'
            }`}
            style={{
              width: job.status === 'processing' ? '75%' : '25%',
            }}
          />
        </div>
      )}

      {/* Job Details */}
      {job.status === 'completed' && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {job.page_count && (
            <div>
              <span className="text-gray-600">Pages:</span>{' '}
              <span className="font-medium">{job.page_count}</span>
            </div>
          )}
          {job.size_bytes && (
            <div>
              <span className="text-gray-600">Size:</span>{' '}
              <span className="font-medium">{formatSize(job.size_bytes)}</span>
            </div>
          )}
          {duration && (
            <div>
              <span className="text-gray-600">Duration:</span>{' '}
              <span className="font-medium">{duration}</span>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {job.status === 'failed' && job.error_message && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <div className="text-sm text-red-800 font-medium">Error Details:</div>
          <div className="text-sm text-red-700 mt-1">{job.error_message}</div>
        </div>
      )}

      {(compileDiagnostics || renderDiagnostics) && (
        <div className="space-y-3 text-sm border-t border-gray-200 pt-3">
          {compileDiagnostics && (
            <div>
              <div className="font-semibold text-gray-700">Compilation</div>
              <div className="text-xs text-gray-500 flex flex-col sm:flex-row sm:gap-4">
                {compileDiagnostics.started_at && (
                  <span>Started: {formatTime(compileDiagnostics.started_at)}</span>
                )}
                {compileDiagnostics.completed_at && (
                  <span>Finished: {formatTime(compileDiagnostics.completed_at)}</span>
                )}
              </div>
              {(compileTotalPages !== null || compileTotalWidgets !== null) && (
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                  {compileTotalPages !== null && <div>Total pages: {compileTotalPages}</div>}
                  {compileTotalWidgets !== null && <div>Total widgets: {compileTotalWidgets}</div>}
                </div>
              )}
              {compileDiagnostics.error && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {compileDiagnostics.error}
                </div>
              )}
              {compileWarnings.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="text-xs font-medium text-yellow-800 mb-1">Warnings</div>
                  {renderWarningList(compileWarnings)}
                </div>
              )}
            </div>
          )}

          {renderDiagnostics && (
            <div>
              <div className="font-semibold text-gray-700">Rendering</div>
              <div className="text-xs text-gray-500 flex flex-col sm:flex-row sm:gap-4">
                {renderDiagnostics.started_at && (
                  <span>Started: {formatTime(renderDiagnostics.started_at)}</span>
                )}
                {renderDiagnostics.completed_at && (
                  <span>Finished: {formatTime(renderDiagnostics.completed_at)}</span>
                )}
              </div>
              <div className="text-xs text-gray-600 flex flex-col sm:flex-row sm:gap-4 mt-1">
                {typeof renderDiagnostics.page_count === 'number' && (
                  <span>Pages: {renderDiagnostics.page_count}</span>
                )}
                {typeof renderDiagnostics.size_bytes === 'number' && (
                  <span>Size: {formatSize(renderDiagnostics.size_bytes)}</span>
                )}
              </div>
              {renderDiagnostics.error && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {renderDiagnostics.error}
                </div>
              )}
              {renderWarnings.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="text-xs font-medium text-yellow-800 mb-1">Warnings</div>
                  {renderWarningList(renderWarnings)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
        <div>Created: {formatTime(job.created_at)}</div>
        {job.started_at && <div>Started: {formatTime(job.started_at)}</div>}
        {job.completed_at && <div>Completed: {formatTime(job.completed_at)}</div>}
      </div>
    </div>
  );
};

export default PDFJobStatusComponent;
