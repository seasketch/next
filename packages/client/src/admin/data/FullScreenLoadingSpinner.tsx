import { createPortal } from "react-dom";
import Spinner from "../../components/Spinner";

export default function FullScreenLoadingSpinner() {
  return createPortal(
    <div
      style={{ height: "100vh", backdropFilter: "blur(2px)" }}
      className="w-full flex min-h-full h-96 justify-center text-center align-middle items-center content-center justify-items-center place-items-center place-content-center z-50 absolute top-0 left-0 bg-black bg-opacity-50"
    >
      <Spinner large color="white" />
    </div>,
    document.body
  );
}
