import Email from "./Email";
import { FormElementComponent } from "./FormElement";
import Number from "./Number";
import Rating from "./Rating";
import ShortText from "./ShortText";
import WelcomeMessage from "./WelcomeMessage";

export const components: {
  /** componentName must match form_elements db table */
  [componentName: string]: FormElementComponent<any, any>;
} = {};

components["WelcomeMessage"] = WelcomeMessage;
components["Email"] = Email;
components["ShortText"] = ShortText;
components["Number"] = Number;
components["Rating"] = Rating;
