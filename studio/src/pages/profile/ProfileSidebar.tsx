import React, { useState, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useIsAdmin } from "@/hooks/useIsAdmin"
import { useProfileStore } from "@/stores/profileStore"
import { isProjectModeEnabled } from "@/utils/projectUtils"
import ProjectTemplateDialog from "@/components/project/ProjectTemplateDialog"

const ProfileSidebar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, isLoading } = useIsAdmin()
  const healthData = useProfileStore((state) => state.healthData)
  const [showProjectDialog, setShowProjectDialog] = useState(false)

  // Check if project mode is enabled
  const projectModeEnabled = useMemo(
    () => isProjectModeEnabled(healthData),
    [healthData]
  )

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    {
      id: "profile",
      label: "Profile",
      path: "/profile",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ]

  const adminNavItems = [
    {
      id: "agent-management",
      label: "Agent Management",
      path: "/profile/agent-management",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        {/* New Project Button - only shown when project mode is enabled */}
        {projectModeEnabled && (
          <button
            onClick={() => setShowProjectDialog(true)}
            className="mb-5 w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium text-white transition-all bg-gradient-to-r from-purple-600 via-purple-500 to-purple-400 hover:from-purple-700 hover:via-purple-600 hover:to-purple-500 shadow-md hover:shadow-lg mt-2"
          >
            {/* Rocket Icon */}
            <svg
              className="w-5 h-5 mr-3 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Rocket body - red */}
              <path
                d="M12 2L13.5 8L17.5 11.5L13.5 15L12 22L10.5 15L6.5 11.5L10.5 8L12 2Z"
                fill="#EF4444"
              />
              {/* White body section */}
              <rect
                x="10"
                y="8.5"
                width="4"
                height="6.5"
                rx="0.5"
                fill="white"
              />
              {/* Rocket window - white circle with red center */}
              <circle cx="12" cy="11.5" r="1.5" fill="white" />
              <circle cx="12" cy="11.5" r="0.8" fill="#EF4444" />
              {/* Rocket nose cone - darker red */}
              <path d="M12 2L13 5.5L12 8L11 5.5L12 2Z" fill="#DC2626" />
              {/* Rocket fin - darker red */}
              <path
                d="M6.5 11.5L7.5 14.5L6.5 17.5L5.5 14.5L6.5 11.5Z"
                fill="#DC2626"
              />
              {/* Rocket flames - yellow and orange */}
              <path d="M10 18L12 20.5L14 18L12 22.5L10 18Z" fill="#FBBF24" />
              <path d="M9 19L12 20.5L15 19L12 22.5L9 19Z" fill="#F59E0B" />
              <path d="M8.5 20L12 21L15.5 20L12 23L8.5 20Z" fill="#F97316" />
            </svg>
            <span>New Project</span>
          </button>
        )}
        {/* Section Header */}
        <div className="flex items-center px-2 mb-2">
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
          <span className="px-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Profile
          </span>
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
        </div>

        {/* Profile Section */}
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              isActive(item.path)
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {item.icon}
            <span className="ml-3">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Project Template Selection Dialog */}
      {showProjectDialog && (
        <ProjectTemplateDialog
          onClose={() => setShowProjectDialog(false)}
          healthData={healthData}
        />
      )}

      {/* Network Management Section - Only visible for admin */}
      {!isLoading && isAdmin && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          {/* Section Header */}
          <div className="flex items-center px-2 mb-2">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
            <span className="px-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Network Management
            </span>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
          </div>

          {/* Admin Navigation Items */}
          <div className="space-y-1">
            {adminNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              Checking permissions...
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileSidebar
