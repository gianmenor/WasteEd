import React from 'react';

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-3',
  lg: 'h-10 w-10 border-4',
};

export default function LoadingSpinner({
  fullscreen = false,
  size = 'lg',
  message,
  className = '',
  overlayClassName = 'bg-black/20',
  spinnerClassName = '',
}) {
  const spinnerSize = sizeMap[size] || sizeMap.lg;

  const spinner = (
    <div className={`flex flex-col items-center gap-3 ${className}`} role="status" aria-live="polite" aria-busy="true">
      <div
        className={`${spinnerSize} animate-spin rounded-full border-gray-300 border-t-blue-500 ${spinnerClassName}`}
        aria-label="Loading"
      />
      {message ? (
        <div className="text-sm text-gray-600">{message}</div>
      ) : null}
    </div>
  );

  if (!fullscreen) return spinner;

  return (
    <div className={`fixed inset-0 z-50 flex justify-center items-start ${overlayClassName}`}>
      {spinner}
    </div>
  );
}
