import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import useTimeout from "use-timeout";

export interface ProfileStatusButtonProps {
  children?: React.ReactNode;
  onClick?: Function;
  loadingIndicatorDelay?: number;
  className?: string;
}

/**
 * Renders a button representing the authenticated state of the user. The state
 * can be one of 5:
 *
 *   * Loading authentication state - spinner displayed
 *   * Logged in, with a visible profile picture
 *   * Logged in, but with a generic profile image
 *   * Error
 *   * Not authenticated. In this case any children of the component will be
 *     displayed as a fallback. Use this to show a login button.
 *
 * @param {ProfileStatusButtonProps} { children, onClick }
 * @returns
 */
function ProfileStatusButton({
  children,
  onClick,
  loadingIndicatorDelay,
  className,
}: ProfileStatusButtonProps) {
  // Use this state to delay the appearance of the loading indicator.
  // The indicator is useful for exceptional states where auth0 is slow to
  // respond, but we don't need the UI spinning needlessly when it usually only
  // takes a fraction of a second
  loadingIndicatorDelay = loadingIndicatorDelay || 500;
  const [delayOver, setDelayOver] = useState(false);
  useTimeout(() => {
    setDelayOver(true);
  }, loadingIndicatorDelay);

  const onClickHandler = onClick ? () => onClick() : undefined;
  const { user, isLoading, error, isAuthenticated } = useAuth0();
  if (error) {
    return (
      <div
        onClick={onClickHandler}
        className={`
          w-8 h-8 overflow-hidden flex items-center text-sm rounded-full 
          text-white focus:outline-none focus:shadow-solid hover:shadow-solid
        `}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="orange"
          className="w-8 h-8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    );
  }
  if (isLoading) {
    if (!delayOver) {
      return null;
    } else {
      return (
        <div
          onClick={onClickHandler}
          className={`
          w-8 h-8 overflow-hidden flex items-center text-sm rounded-full 
          text-white focus:outline-none focus:shadow-solid hover:shadow-solid 
          relative profile-loader border-2 border-blue-500
        `}
        ></div>
      );
    }
  }
  if (!isAuthenticated) return <div>{children}</div>;
  return (
    <button
      className={`
        max-w-xs flex items-center text-sm rounded-full text-white 
        focus:outline-none focus:shadow-solid hover:shadow-solid ${
          !onClick ? "pointer-events-none" : ""
        } ${className}
      `}
      style={{ borderColor: "#1e429f" }}
      id="user-menu"
      aria-label="User menu"
      aria-haspopup="true"
      onClick={onClickHandler}
    >
      {user.picture ? (
        <img className="h-8 w-8 rounded-full" src={user.picture} alt="" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          className="w-8 h-8"
          fill="#ddd"
        >
          <path
            fillRule="evenodd"
            d={`
              M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 
              0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 
              0 004.546-2.084A5 5 0 0010 11z
            `}
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}

export { ProfileStatusButton };
