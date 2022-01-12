/* eslint-disable i18next/no-literal-string */
import React from "react";
import fromMarkdown from "./fromMarkdown";
import WelcomeMessage from "./WelcomeMessage";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SurveyContext } from "./FormElement";
import { TestSurveyContextValue } from "./testContext";

const body = fromMarkdown(`
# Welcome to the Survey

Enjoy your stay!

`);

test("Component renders with custom body and button text", async () => {
  render(
    <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
      <WelcomeMessage
        body={body}
        id={1}
        onChange={() => null}
        onSubmit={() => null}
        editable={false}
        isRequired={false}
        componentSettings={{
          beginButtonText: "Proceed",
          disablePracticeMode: false,
        }}
        alternateLanguageSettings={{}}
      />
    </SurveyContext.Provider>
  );
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Welcome to the Survey"
    );
    expect(screen.getByText("Proceed")).toBeInTheDocument();
  });
});

test("Clicking button proceeds to next page of survey", async () => {
  const onChange = jest.fn();
  render(
    <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
      <WelcomeMessage
        body={body}
        id={1}
        onChange={onChange}
        onSubmit={() => null}
        editable={false}
        isRequired={false}
        componentSettings={{
          beginButtonText: "Proceed",
          disablePracticeMode: false,
        }}
        alternateLanguageSettings={{}}
      />
    </SurveyContext.Provider>
  );
  await waitFor(() => {
    expect(screen.getByText("Proceed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Proceed"));
    expect(onChange).toBeCalled();
  });
});
