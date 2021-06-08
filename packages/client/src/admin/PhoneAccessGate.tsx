import React, { useContext, useEffect } from "react";
import { AdminMobileHeaderContext } from "./AdminMobileHeaderContext";
import { useMediaQuery } from "beautiful-react-hooks";

// @ts-ignore
const PhoneAccessGate: React.FunctionComponent<{
  heading?: string;
  message?: string;
}> = ({ heading, message, children }) => {
  const { setState: setHeaderState } = useContext(AdminMobileHeaderContext);
  const isPhone = useMediaQuery("(max-width: 767px)");
  useEffect(() => {
    setHeaderState({
      heading,
    });
    return () => setHeaderState({});
  }, [setHeaderState, heading]);
  if (isPhone) {
    return (
      <div className="text-center w-full mt-10">
        {message || "This feature is not available on mobile phones"}
      </div>
    );
  } else if (children) {
    return children;
  } else {
    return <div></div>;
  }
};

export default PhoneAccessGate;
