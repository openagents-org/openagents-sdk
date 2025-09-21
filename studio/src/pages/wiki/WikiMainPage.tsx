import React from 'react';
import { Routes, Route } from 'react-router-dom';
import WikiView from '@/components/wiki/WikiView';
import { useSharedConnection } from '@/router/RouteGuard';

const WikiMainPage: React.FC = () => {
  const { openAgentsHook, isConnected } = useSharedConnection();
  
  const handleBackClick = () => {
    // Navigate back to chat or previous view
    window.history.back();
  };

  return (
    <div className="h-full">
      <Routes>
        <Route 
          path="/*" 
          element={
            <WikiView 
              onBackClick={handleBackClick}
              currentTheme="light" // TODO: Get from theme context
              connection={isConnected ? openAgentsHook.service : null}
            />
          } 
        />
      </Routes>
    </div>
  );
};

export default WikiMainPage;