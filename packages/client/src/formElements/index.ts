import Email from "./Email";
import { FormElementComponent } from "./FormElement";
import Number from "./Number";
import Rating from "./Rating";
import ShortText from "./ShortText";
import WelcomeMessage from "./WelcomeMessage";
import Statement from "./Statement";
import YesNo from "./YesNo";
import TextArea from "./TextArea";
import ThankYou from "./ThankYou";
import Name from "./Name";

export const components: {
  /** componentName must match form_elements db table */
  [componentName: string]: FormElementComponent<any, any>;
} = {};

components["WelcomeMessage"] = WelcomeMessage;
components["Name"] = Name;
components["Email"] = Email;
components["ShortText"] = ShortText;
components["TextArea"] = TextArea;
components["Number"] = Number;
components["Rating"] = Rating;
components["Statement"] = Statement;
components["YesNo"] = YesNo;
components["ThankYou"] = ThankYou;
