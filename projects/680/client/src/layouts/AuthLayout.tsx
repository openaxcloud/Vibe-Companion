import React, { ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";

type AuthLayoutProps = {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  logoSrc?: string;
  logoAlt?: string;
  footerText?: string;
  switchLinkLabel?: string;
  switchLinkTo?: string;
  children?: ReactNode;
};

const defaultLogoAlt = "Brand Logo";

const AuthLayout: React.FC<AuthLayoutProps> = ({
  title = "Welcome",
  subtitle = "Sign in to continue",
  showLogo = true,
  logoSrc,
  logoAlt = defaultLogoAlt,
  footerText = "Don’t have an account?",
  switchLinkLabel = "Sign up",
  switchLinkTo = "/register",
  children,
}) => {
  const renderLogo = () => {
    if (!showLogo) return null;

    if (logoSrc) {
      return (
        <div className="mb-6 flex justify-center">
          <img
            src={logoSrc}
            alt={logoAlt}
            className="h-10 w-auto select-none"
          />
        </div>
      );
    }

    return (
      <div className="mb-6 flex items-center justify-center text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        <span className="rounded-md bg-primary-600 px-2 py-1 text-white">
          Auth
        </span>
        <span className="ml-2 text-gray-800 dark:text-gray-100">
          Portal
        </span>
      </div>
    );
  };

  const renderContent = () => {
    if (children) return children;
    return <Outlet />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            {renderLogo()}
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-8">
            {renderContent()}
          </div>

          {(footerText || (switchLinkLabel && switchLinkTo)) && (
            <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              {footerText && <span>{footerText} </span>}
              {switchLinkLabel && switchLinkTo && (
                <Link
                  to={switchLinkTo}
                  className="font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  {switchLinkLabel}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;