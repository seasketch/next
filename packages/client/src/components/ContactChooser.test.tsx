import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "history";
import { Router } from "react-router-dom";
import { MockedProvider } from "@apollo/client/testing";
import ContactChooser from "./ContactChooser";
import { SEASKETCH_SUPPORT_EMAIL } from "./contactEmail";

function renderChooser(
  ui: React.ReactElement,
  path = "/"
) {
  const history = createMemoryHistory({ initialEntries: [path] });
  return render(
    <MockedProvider>
      <Router history={history}>{ui}</Router>
    </MockedProvider>
  );
}

describe("ContactChooser", () => {
  test("offers the project administrator and SeaSketch support", async () => {
    renderChooser(
      <ContactChooser
        project={{ name: "Demo Samoa", email: "planning@example.org" }}
      >
        Contact us
      </ContactChooser>
    );

    await userEvent.click(screen.getByRole("link", { name: "Contact us" }));

    expect(
      screen.getByRole("dialog", { name: "Who would you like to contact?" })
    ).toBeInTheDocument();
    expect(screen.getByText("Demo Samoa")).toBeInTheDocument();
    expect(screen.getByText("Email project administrator")).toBeInTheDocument();
    expect(screen.queryByText("This project")).not.toBeInTheDocument();
    expect(screen.queryByText("The software")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Questions about this project and questions/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Email project administrator" })
    ).toHaveAttribute("href", "mailto:planning@example.org");
    expect(
      screen.getByRole("link", { name: "Email SeaSketch support" })
    ).toHaveAttribute("href", `mailto:${SEASKETCH_SUPPORT_EMAIL}`);
  });

  test("emails SeaSketch directly when there is no project", () => {
    renderChooser(<ContactChooser>Contact us</ContactChooser>);

    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute(
      "href",
      `mailto:${SEASKETCH_SUPPORT_EMAIL}`
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
