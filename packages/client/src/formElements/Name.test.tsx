import React from "react";
import Name, { NameProps } from "./Name";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SurveyContext } from "./FormElement";
import { TestSurveyContextValue } from "./testContext";

const body = Name.defaultBody;
const makeArgs = (componentSettings: NameProps) => ({
  body,
  id: 1,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  editable: false,
  componentSettings: {
    ...Name.defaultComponentSettings,
    ...componentSettings,
  },
  isRequired: true,
  alternateLanguageSettings: {},
});

test("Component renders with custom body", async () => {
  render(
    <SurveyContext.Provider value={{ ...TestSurveyContextValue }}>
      <Name {...makeArgs({})} />
    </SurveyContext.Provider>
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByRole("heading")).toHaveTextContent("What is your name?");
});

test("Name should be populated with name from context, if available", async () => {
  render(
    <SurveyContext.Provider
      value={{ ...TestSurveyContextValue, bestName: "Chad Burt" }}
    >
      <Name {...makeArgs({})} value={undefined} />
    </SurveyContext.Provider>
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  expect(screen.getByDisplayValue("Chad Burt")).toBeInTheDocument();
});

test("Facilitated surveys should have a place for facilitator name", async () => {
  render(
    <SurveyContext.Provider
      value={{ ...TestSurveyContextValue, isFacilitatedResponse: true }}
    >
      <Name {...makeArgs({})} />
    </SurveyContext.Provider>
  );
  await waitFor(() => {
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
  });
  expect(screen.getByText("What is your name?")).toBeInTheDocument();
  expect(screen.getByText("Facilitator name")).toBeInTheDocument();
});
