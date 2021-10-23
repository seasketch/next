import { FormElementComponent } from "./FormElement";
import Rating from "./Rating";
import ShortText from "./ShortText";
import WelcomeMessage from "./WelcomeMessage";

export const components: {
  /** componentName must match form_elements db table */
  [componentName: string]: FormElementComponent<any, any>;
} = {};

components["WelcomeMessage"] = WelcomeMessage;
components["ShortText"] = ShortText;
components["Rating"] = Rating;
