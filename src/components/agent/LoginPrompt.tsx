import React from "react";
import { CommonProps } from "./types";

interface LoginPromptProps extends Pick<CommonProps, "t"> {
  onLogin: () => void;
  error?: string;
}

const LoginPrompt: React.FC<LoginPromptProps> = ({ t, onLogin, error }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center h-full">
      <h3 className="text-base font-medium mb-3 text-primary">
        {t("loginRequired") || "Please login first"}
      </h3>

      <p className="text-xs text-text-secondary mb-5 max-w-[240px] leading-relaxed">
        {t("loginMessage") ||
          "Login to use the AI assistant for a better reading experience, helping you understand and explore your content anytime."}
      </p>

      {error && <p className="text-sm text-error mb-4">{error}</p>}

      <button
        onClick={onLogin}
        className="group flex items-center gap-1.5 bg-accent text-bg-primary py-2 px-4 rounded-full 
                 text-sm font-medium shadow-md hover:shadow-lg transition-all 
                 hover:bg-accent/90 active:scale-95"
      >
        <span>{t("loginButton") || "Login Now"}</span>
        <svg
          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M5 12h14"></path>
          <path d="M12 5l7 7-7 7"></path>
        </svg>
      </button>

      <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-text-secondary/40">
        {t("loginSafe") || "Secure login, no privacy concerns"}
      </div>
    </div>
  );
};

export default LoginPrompt;
