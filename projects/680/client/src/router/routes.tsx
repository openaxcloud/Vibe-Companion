import React, { ReactElement, ReactNode, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginPage from "../pages/auth/LoginPage";
import SignupPage from "../pages/auth/SignupPage";
import WorkspaceLayout from "../pages/workspace/WorkspaceLayout";
import ChannelView from "../pages/workspace/ChannelView";
import DirectMessageView from "../pages/workspace/DirectMessageView";
import ThreadView from "../pages/workspace/ThreadView";

interface ProtectedRouteProps {
  children: ReactNode;
}

const AuthGuard: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Side effects related to auth state changes could be handled here if needed
  }, [isAuthenticated]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
};

const GuestGuard: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to={from || "/workspace"} replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = (): ReactElement => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route
          path="/login"
          element={
            <GuestGuard>
              <LoginPage />
            </GuestGuard>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestGuard>
              <SignupPage />
            </GuestGuard>
          }
        />

        {/* Workspace and app routes */}
        <Route
          path="/workspace"
          element={
            <AuthGuard>
              <WorkspaceLayout />
            </AuthGuard>
          }
        >
          {/* Default workspace content, e.g., first channel or a welcome screen could go here */}
          <Route index element={<Navigate to="channels/general" replace />} />
          <Route path="channels/:channelId" element={<ChannelView />} />
          <Route path="dm/:userId" element={<DirectMessageView />} />
          <Route path="threads/:threadId" element={<ThreadView />} />
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/workspace" replace />} />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;