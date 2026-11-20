import { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import BookmarkCard from "./BookmarkCard";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

function card(props: { pending: boolean; imageId?: string }) {
  return (
    <BookmarkCard
      labelledBy="bookmark-title"
      pending={props.pending}
      failed={false}
      imageId={props.imageId}
      onClose={() => undefined}
    >
      <div id="bookmark-title" />
    </BookmarkCard>
  );
}

test("says the screenshot service is rendering while no image exists yet", () => {
  render(card({ pending: true }));
  expect(screen.getByText("Rendering map image…")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});

test("shows only a spinner while an existing image is still downloading", () => {
  render(card({ pending: false, imageId: "bookmark-images/already-made" }));
  expect(screen.queryByText("Rendering map image…")).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Loading" })).toBeInTheDocument();
});
