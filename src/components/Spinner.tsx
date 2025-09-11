import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="w-4 h-4 rounded-full animate-pulse bg-white" style={{animationDelay: '0s'}}></div>
      <div className="w-4 h-4 rounded-full animate-pulse bg-white" style={{animationDelay: '0.2s'}}></div>
      <div className="w-4 h-4 rounded-full animate-pulse bg-white" style={{animationDelay: '0.4s'}}></div>
    </div>
  );
};

export default Spinner;
