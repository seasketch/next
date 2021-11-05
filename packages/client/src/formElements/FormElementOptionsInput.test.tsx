/* eslint-disable i18next/no-literal-string */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import FormElementOptionsInput from "./FormElementOptionsInput";

const options = ["A", "B", "C"].map((value) => ({
  label: `Option ${value}`,
  value,
}));

test("Renders from options to text", async () => {
  const onChange = jest.fn();
  render(
    <FormElementOptionsInput initialValue={options} onChange={onChange} />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toHaveValue(
      `Option A,A\nOption B,B\nOption C,C`
    );
  });
});

test("onChange emits values from parsed text", async () => {
  const onChange = jest.fn();
  render(
    <FormElementOptionsInput initialValue={options} onChange={onChange} />
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox")).toHaveValue(
      `Option A,A\nOption B,B\nOption C,C`
    );
  });
  fireEvent.input(screen.getByRole("textbox"), {
    target: { value: `Option A\nB Button,B\nOption D,D` },
  });
  expect(onChange).toBeCalledWith([
    { label: "Option A" },
    { label: "B Button", value: "B" },
    { label: "Option D", value: "D" },
  ]);
});
