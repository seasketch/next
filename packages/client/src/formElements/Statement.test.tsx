/* eslint-disable i18next/no-literal-string */
import React from "react";
import fromMarkdown from "./fromMarkdown";
import Statement from "./Statement";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const body = fromMarkdown(`
# Welcome to the Survey

Enjoy your stay!

`);

test("Component renders with custom body", async () => {
  render(
    <Statement
      body={body}
      id={1}
      onChange={() => null}
      onSubmit={() => null}
      editable={false}
      isRequired={false}
      componentSettings={{}}
    />
  );
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Welcome to the Survey"
    );
  });
});
