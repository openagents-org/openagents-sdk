import React, { useEffect } from "react";
import ModSidebar from "./ModSidebar";
import Sidebar from "./Sidebar";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mobile drawer component that contains ModSidebar and Sidebar
 * Used for mobile responsive layout
 */
const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // 完全隐藏：只在打开时渲染
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="
          fixed top-0 left-0 h-full z-50
          flex transition-transform duration-300 ease-in-out
          bg-slate-100 dark:bg-gray-900
          w-[85%] max-w-sm
        "
      >
        {/* ModSidebar */}
        <div className="flex-shrink-0">
          <ModSidebar />
        </div>

        {/* Sidebar */}
        <div className="flex-shrink-0">
          <Sidebar />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="
            absolute top-4 right-4 p-2 rounded-lg
            bg-white dark:bg-gray-800
            hover:bg-gray-100 dark:hover:bg-gray-700
            transition-colors duration-200
            shadow-lg
            z-10
          "
          aria-label="Close drawer"
        >
          <svg
            className="w-6 h-6 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </>
  );
};

export default MobileDrawer;

