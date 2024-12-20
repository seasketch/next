/* eslint-disable i18next/no-literal-string */
import React from "react";
import fromMarkdown from "./fromMarkdown";
import ThankYou, { ThankYouProps } from "./ThankYou";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Router, useHistory } from "react-router";
import { createMemoryHistory } from "history";
import { SurveyContext } from "./FormElement";
import { TestSurveyContextValue } from "./testContext";

const body = ThankYou.defaultBody;
const makeArgs = (componentSettings: ThankYouProps) => ({
  id: 1,
  body,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  editable: false,
  isRequired: false,
  componentSettings: {
    ...ThankYou.defaultProps!.componentSettings,
    ...componentSettings,
  },
  projectName: "Project A",
  projectUrl: "https://example.com/a",
  surveyUrl: "https://example.com/a/surveys/1",
  surveySupportsFacilitation: true,
  isFacilitatedResponse: false,
  alternateLanguageSettings: {},
});

test("Component renders with custom body", async () => {
  render(
    <Router history={createMemoryHistory()}>
      <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
        <ThankYou {...makeArgs({})} />
      </SurveyContext.Provider>
    </Router>
  );
  await waitFor(() => {
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Thank You for Responding"
    );
  });
});

test("Has a button linking to the project url if linkToProject=true", async () => {
  render(
    <Router history={createMemoryHistory()}>
      <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
        <ThankYou {...makeArgs({ linkToProject: true })} />
      </SurveyContext.Provider>
    </Router>
  );
  await waitFor(() => {
    expect(screen.getByText("Return to Project A")).toBeInTheDocument();
  });
});

test("Has a button to take survey again if promptToRespondAgain=true", async () => {
  render(
    <Router history={createMemoryHistory()}>
      <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
        <ThankYou {...makeArgs({ promptToRespondAgain: true })} />
      </SurveyContext.Provider>
    </Router>
  );
  await waitFor(() => {
    expect(screen.getByText("Submit Another Response")).toBeInTheDocument();
  });
});

test("Respond Again link text can be customized", async () => {
  render(
    <Router history={createMemoryHistory()}>
      <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
        <ThankYou
          {...makeArgs({
            promptToRespondAgain: true,
            respondAgainMessage: "Do it again",
          })}
        />
      </SurveyContext.Provider>
    </Router>
  );
  await waitFor(() => {
    expect(screen.getByText("Do it again")).toBeInTheDocument();
  });
});

test("Optional social sharing buttons", async () => {
  render(
    <Router history={createMemoryHistory()}>
      <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
        <ThankYou
          {...makeArgs({
            shareButtons: true,
          })}
        />
      </SurveyContext.Provider>
    </Router>
  );
  await waitFor(() => {
    expect(screen.getByLabelText("twitter")).toBeInTheDocument();
    expect(screen.getByLabelText("facebook")).toBeInTheDocument();
  });
});
