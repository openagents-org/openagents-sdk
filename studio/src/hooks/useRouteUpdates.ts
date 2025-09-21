import { useState, useEffect } from 'react';

// Simple event emitter for route updates
class RouteUpdateEmitter {
  private listeners = new Set<() => void>();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.listeners.forEach(listener => listener());
  }
}

const routeUpdateEmitter = new RouteUpdateEmitter();

// Hook to listen for route configuration changes
export const useRouteUpdates = () => {
  const [updateCounter, setUpdateCounter] = useState(0);

  useEffect(() => {
    const unsubscribe = routeUpdateEmitter.subscribe(() => {
      setUpdateCounter(prev => prev + 1);
    });

    return unsubscribe;
  }, []);

  return updateCounter;
};

// Function to trigger route updates (called when visibility changes)
export const triggerRouteUpdate = () => {
  routeUpdateEmitter.emit();
};