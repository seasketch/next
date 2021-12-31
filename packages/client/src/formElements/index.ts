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
import ComboBox from "./ComboBox";
import MultipleChoice from "./MultipleChoice";
import SingleSpatialInput from "./SingleSpatialInput";
import MultiSpatialInput from "./MultiSpatialInput";
import FeatureName from "./FeatureName";
import SpatialAccessPriority from "./SpatialAccessPriority/SpatialAccessPriority";
import SAPRange from "./SAPRange";

export const components: {
  /** componentName must match form_elements db table */
  [componentName: string]: FormElementComponent<any, any>;
} = {};

components["WelcomeMessage"] = WelcomeMessage;
components["Name"] = Name;
components["Email"] = Email;
components["MultipleChoice"] = MultipleChoice;
components["ShortText"] = ShortText;
components["TextArea"] = TextArea;
components["Number"] = Number;
components["Rating"] = Rating;
components["Statement"] = Statement;
components["YesNo"] = YesNo;
components["ComboBox"] = ComboBox;
components["ThankYou"] = ThankYou;
components["SingleSpatialInput"] = SingleSpatialInput;
components["MultiSpatialInput"] = MultiSpatialInput;
components["SpatialAccessPriorityInput"] = SpatialAccessPriority;
components["FeatureName"] = FeatureName;
components["SAPRange"] = SAPRange;
