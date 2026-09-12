import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { SplashScreen } from "@/components/common";

/** Route guard: must be logged in. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <SplashScreen />;
  if (status === "guest") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
