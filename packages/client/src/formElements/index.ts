import Email from "./Email";
import { FormElementComponent } from "./FormElement";
import Number from "./Number";
import Rating from "./Rating";
import ShortText from "./ShortText";
import WelcomeMessage from "./WelcomeMessage";
import Statement from "./Statement";
import YesNo from "./YesNo";

export const components: {
  /** componentName must match form_elements db table */
  [componentName: string]: FormElementComponent<any, any>;
} = {};

components["WelcomeMessage"] = WelcomeMessage;
components["Email"] = Email;
components["ShortText"] = ShortText;
components["Number"] = Number;
components["Rating"] = Rating;
components["Statement"] = Statement;
components["YesNo"] = YesNo;
