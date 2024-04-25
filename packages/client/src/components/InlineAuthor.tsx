import { useCallback, useState, MouseEvent } from "react";
import { AuthorProfileFragment } from "../generated/graphql";
import InlineAuthorDetails from "../projects/Forums/InlineAuthorDetails";
import { createPortal } from "react-dom";
import AuthorProfilePopupContents from "../projects/Forums/AuthorProfilePopupContents";
import { usePopper } from "react-popper";

export default function InlineAuthor({
  profile,
}: {
  profile: AuthorProfileFragment;
}) {
  const [referenceElement, setReferenceElement] = useState<any | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const onProfileClick = useCallback(
    (e: MouseEvent<HTMLElement>, profile: AuthorProfileFragment) => {
      setShowPopup(true);
      setReferenceElement(e.target);
    },
    []
  );
  const [popperElement, setPopperElement] = useState<any | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "right-start",
  });
  return (
    <>
      {showPopup &&
        createPortal(
          <div
            ref={setPopperElement}
            className="bg-white max-w-sm shadow-xl border border-black border-opacity-20 rounded z-50  p-2 text-sm"
            {...attributes.popper}
            style={{ ...styles.popper, zIndex: 99999999 }}
          >
            <AuthorProfilePopupContents profile={profile} />
          </div>,
          document.body
        )}
      {showPopup &&
        createPortal(
          <div
            onClick={() => setShowPopup(false)}
            className="w-screen h-screen absolute top-0 left-0 bg-black opacity-5 z-50"
          >
            &nbsp;
          </div>,
          document.body
        )}
      <InlineAuthorDetails
        onProfileClick={(e) => {
          setReferenceElement(e.target);
          setShowPopup(true);
        }}
        profile={profile}
        firstPostInTopic={false}
      />
    </>
  );
}
