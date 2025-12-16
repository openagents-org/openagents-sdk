import React from "react"
import { SidebarPrimary } from "./components/sidebar-primary"
import { SidebarSecondary } from "./components/sidebar-secondary"
import { useLayout } from "./components/context"
import { cn } from "@/lib/utils"

// Simplified Sidebar Props - only includes basic UI state, no business data
interface SidebarProps {
  // Basic UI state - if needed
  className?: string
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { isSidebarOpen } = useLayout()

  return (
    <aside
      className={cn(
        "relative overflow-hidden transition-all duration-300 flex items-stretch flex-shrink-0 h-full",
        isSidebarOpen
          ? "w-[var(--sidebar-width)]"
          : "w-[var(--sidebar-collapsed-width)]",
        className
      )}
    >
      <SidebarPrimary />
      {isSidebarOpen && <SidebarSecondary />}
    </aside>
  )
}

export default Sidebar
