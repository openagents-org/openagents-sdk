import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ForumView from '@/components/forum/ForumView';
import { useSharedConnection } from '@/router/RouteGuard';

const ForumMainPage: React.FC = () => {
  const { openAgentsHook, isConnected, connectionStatus } = useSharedConnection();
  
  console.log('ForumMainPage: isConnected:', isConnected);
  console.log('ForumMainPage: connectionStatus:', connectionStatus);
  console.log('ForumMainPage: service:', openAgentsHook.service);
  
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
            <ForumView 
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

export default ForumMainPage;