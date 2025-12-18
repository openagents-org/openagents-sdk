import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

/**
 * AdminRouteGuard - Protects admin routes and redirects non-admin users
 */
const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      // Redirect to profile page if not admin
      console.log("🛡️ Non-admin user attempted to access admin route, redirecting...");
      navigate("/profile", { replace: true });
      toast.error("You do not have admin privileges");
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="p-6 h-full flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking admin privileges...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
};

export default AdminRouteGuard;

