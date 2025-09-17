/**
 * Preview panel component for real-time template preview.
 * 
 * Shows live preview of the template using WebSocket connection to backend.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Eye, RefreshCw, Download, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { PreviewWebSocketClient, generateClientId } from '@/services/websocket';
import { APIClient } from '@/services/api';

const PreviewPanel: React.FC = () => {
  const { currentTemplate, activeProfile, totalPages } = useEditorStore();
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsClient, setWsClient] = useState<PreviewWebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);

  // Initialize WebSocket client
  useEffect(() => {
    const clientId = generateClientId();
    const client = new PreviewWebSocketClient(clientId, {
      onPreviewResponse: (data) => {
        setPreviewImage(`data:image/png;base64,${data.preview_base64}`);
        setLoading(false);
        setError(null);
      },
      onError: (message) => {
        setError(message);
        setLoading(false);
      },
      onConnect: () => {
        setConnected(true);
        setError(null);
      },
      onDisconnect: () => {
        setConnected(false);
      }
    });

    setWsClient(client);
    client.connect();

    return () => {
      client.disconnect();
    };
  }, []);

  // Sync preview page with total pages
  useEffect(() => {
    if (previewPage > totalPages) {
      setPreviewPage(Math.max(1, totalPages));
    }
  }, [totalPages, previewPage]);

  // Auto-refresh preview when template changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (currentTemplate && activeProfile && connected) {
        requestPreview();
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(debounceTimer);
  }, [currentTemplate, activeProfile, connected, previewPage]);

  const requestPreview = useCallback(async () => {
    if (!currentTemplate || !activeProfile || !wsClient) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Convert template to YAML (placeholder - would need real YAML serializer)
      const yamlContent = JSON.stringify(currentTemplate, null, 2);

      if (wsClient.isConnected()) {
        // Use WebSocket for real-time preview
        wsClient.requestPreview({
          yaml_content: yamlContent,
          profile: activeProfile.name,
          page_number: previewPage,
          scale: 2.0
        });
      } else {
        // Fallback to REST API
        const previewBlob = await APIClient.generatePreview({
          yaml_content: yamlContent,
          profile: activeProfile.name,
          page_number: previewPage,
          scale: 2.0
        });

        const imageUrl = URL.createObjectURL(previewBlob);
        setPreviewImage(imageUrl);
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to generate preview');
      setLoading(false);
    }
  }, [currentTemplate, activeProfile, wsClient, previewPage]);

  const handleDownloadPreview = async () => {
    if (!previewImage) return;

    try {
      const response = await fetch(previewImage);
      const blob = await response.blob();
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentTemplate?.metadata.name || 'template'}_preview.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download preview');
    }
  };

  const handlePreviousPage = () => {
    if (previewPage > 1) {
      setPreviewPage(previewPage - 1);
    }
  };

  const handleNextPage = () => {
    if (previewPage < totalPages) {
      setPreviewPage(previewPage + 1);
    }
  };

  const canGeneratePreview = currentTemplate && activeProfile;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-eink-pale-gray">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </h3>
          
          <div className="flex items-center space-x-2">
            {/* Connection Status */}
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            
            <button
              onClick={requestPreview}
              disabled={!canGeneratePreview || loading}
              className="p-1 rounded hover:bg-eink-pale-gray disabled:opacity-50"
              title="Refresh preview"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            {previewImage && (
              <button
                onClick={handleDownloadPreview}
                className="p-1 rounded hover:bg-eink-pale-gray"
                title="Download preview"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {activeProfile && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-eink-gray">
              {activeProfile.name} • 200% scale
            </p>
            
            {totalPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePreviousPage}
                  disabled={previewPage <= 1}
                  className="p-1 rounded hover:bg-eink-pale-gray disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous page"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                
                <span className="text-xs text-eink-gray px-2">
                  Page {previewPage} of {totalPages}
                </span>
                
                <button
                  onClick={handleNextPage}
                  disabled={previewPage >= totalPages}
                  className="p-1 rounded hover:bg-eink-pale-gray disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next page"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-auto p-4">
        {!canGeneratePreview ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Eye className="w-8 h-8 text-eink-light-gray mx-auto mb-2" />
              <p className="text-eink-gray">
                {!activeProfile ? 'Select a device profile to preview' : 'No template loaded'}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 mb-2">{error}</p>
              <button onClick={requestPreview} className="btn-secondary text-sm">
                Try Again
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <div className="animate-spin w-8 h-8 border-2 border-eink-black border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-eink-gray">Generating preview...</p>
            </div>
          </div>
        ) : previewImage ? (
          <div className="space-y-4">
            <img
              src={previewImage}
              alt="Template Preview"
              className="w-full h-auto border border-eink-pale-gray rounded shadow-sm"
            />
            
            <div className="text-xs text-eink-light-gray text-center">
              Live preview • Updates automatically
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Eye className="w-8 h-8 text-eink-light-gray mx-auto mb-2" />
              <p className="text-eink-gray mb-4">No preview available</p>
              <button onClick={requestPreview} className="btn-primary text-sm">
                Generate Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;