/* eslint-disable i18next/no-literal-string */
import React from "react";
import fromMarkdown from "./fromMarkdown";
import WelcomeMessage from "./WelcomeMessage";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const body = fromMarkdown(`
# Welcome to the Survey

Enjoy your stay!

`);

test("Component renders with custom body and button text", async () => {
  render(
    <WelcomeMessage
      body={body}
      id={1}
      onChange={() => null}
      onSubmit={() => null}
      editable={false}
      isRequired={false}
      componentSettings={{ beginButtonText: "Proceed" }}
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Welcome to the Survey"
    );
    expect(screen.getByRole("button")).toHaveTextContent("Proceed");
  });
});

test("Clicking button proceeds to next page of survey", async () => {
  const onSubmit = jest.fn();
  render(
    <WelcomeMessage
      body={body}
      id={1}
      onChange={() => null}
      onSubmit={onSubmit}
      editable={false}
      isRequired={false}
      componentSettings={{ beginButtonText: "Proceed" }}
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("button")).toHaveTextContent("Proceed");
    fireEvent.click(screen.getByRole("button"));
    expect(onSubmit).toBeCalled();
  });
});
