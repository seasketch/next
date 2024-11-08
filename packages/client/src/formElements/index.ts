/* eslint-disable i18next/no-literal-string */
import { ConsentProps, ConsentValue } from "./Consent";
import { MatrixProps, MatrixValue } from "./Matrix";
import { MultipleChoiceProps, MultipleChoiceValue } from "./MultipleChoice";
import {
  MultiSpatialInputProps,
  MultiSpatialInputValueType,
} from "./MultiSpatialInput";
import { NameProps, NameType } from "./Name";
import {
  registerComponent,
  components,
  componentExportHelpers,
} from "./registerComponent";
import {
  SAPValueType,
  SpatialAccessPriorityProps,
} from "./SpatialAccessPriority/SpatialAccessPriority";

registerComponent({ name: "WelcomeMessage" });
registerComponent<NameProps, NameType>({
  name: "Name",
  getColumns: (componentSettings, exportId) => {
    return [exportId, `is_facilitated`, `facilitator_name`];
  },
  getAnswers: (settings, exportId, answer) => {
    return {
      [exportId]: answer.name,
      is_facilitated: !!(answer.facilitator && answer.facilitator.length > 0),
      facilitator_name: answer.facilitator,
    };
  },
});
registerComponent({ name: "Email" });
registerComponent({ name: "ParticipantCount" });
registerComponent<ConsentProps, ConsentValue>({
  name: "Consent",
  getColumns: (componentSettings, exportId) => {
    return [exportId, `${exportId}_doc_version`, `${exportId}_doc_clicked`];
  },
  getAnswers: (settings, exportId, answer) => {
    return {
      [exportId]: !!answer.consented,
      [`${exportId}_doc_version`]: answer.docVersion,
      [`${exportId}_doc_clicked`]: !!answer.clickedDoc,
    };
  },
});
registerComponent<MultipleChoiceProps, MultipleChoiceValue>({
  name: "MultipleChoice",
  getColumns: (componentSettings, exportId) => {
    return [exportId];
  },
  getAnswers: (settings, exportId, answer) => {
    if (settings.multipleSelect) {
      if (answer === undefined || answer === null) {
        return {
          [exportId]: [],
        };
      } else if (!Array.isArray(answer)) {
        return {
          [exportId]: [answer],
        };
      } else {
        return {
          [exportId]: answer,
        };
      }
    } else {
      if (Array.isArray(answer)) {
        return {
          [exportId]: answer[0],
        };
      } else {
        return {
          [exportId]: answer,
        };
      }
    }
  },
});
registerComponent({
  name: "DemographicChoice",
  getAnswers(componentSettings, exportId, answer) {
    return {
      [exportId]: JSON.stringify(answer),
    };
  },
});

registerComponent({ name: "ShortText" });
registerComponent({ name: "TextArea" });
registerComponent({ name: "Number" });
registerComponent({ name: "Rating" });
registerComponent({ name: "Statement" });
registerComponent({ name: "YesNo" });
registerComponent({ name: "ComboBox" });
registerComponent<MatrixProps, MatrixValue>({
  name: "Matrix",
  getColumns: (componentSettings, exportId) => {
    return (componentSettings.rows || []).map(
      (option) => `${exportId}_${option.value || option.label}`
    );
  },
  getAnswers: (settings, exportId, answer) => {
    return (settings.rows || []).reduce((prev, option) => {
      prev[`${exportId}_${option.value || option.label}`] =
        answer[option.value || option.label];
      return prev;
    }, {} as { [answer: string]: string });
  },
});
registerComponent({ name: "ThankYou" });
// registerComponent({ name: "SingleSpatialInput" });
registerComponent<MultiSpatialInputProps, MultiSpatialInputValueType>({
  name: "MultiSpatialInput",
  getColumns: (componentSettings, exportId) => [`${exportId}_feature_ids`],
  getAnswers: (settings, exportId, answer) => {
    return {
      [`${exportId}_feature_ids`]: answer.collection,
    };
  },
});
registerComponent<SpatialAccessPriorityProps, SAPValueType>({
  name: "SpatialAccessPriorityInput",
  fname: "SpatialAccessPriority/SpatialAccessPriority",
  getColumns: (componentSettings, exportId) => {
    return [`${exportId}_sectors`];
  },
  getAnswers: (settings, exportId, answer) => {
    if (Array.isArray(answer)) {
      // Bug in (very) early rollout stored the wrong data structure internally
      // so selected sectors were lost.
      // https://github.com/seasketch/next/commit/3a69e33b14dd444b240edc24aa95d754099e2c25
      return {
        [`${exportId}_sectors`]: [
          "Unknown -- https://github.com/seasketch/next/commit/3a69e33b14dd444b240edc24aa95d754099e2c25",
        ],
      };
    } else {
      return {
        [`${exportId}_sectors`]: answer.sectors,
      };
    }
  },
  getValueForRuleEvaluation: (value, componentSettings) => {
    return value.sectors;
  },
  shouldDisplaySubordinateElement: function (
    elementId,
    componentSettings,
    value
  ) {
    const sectors = value?.sectors || [];
    const visibilitySettings =
      componentSettings?.subordinateVisibilitySettings || {};
    for (const sector of sectors) {
      if (
        visibilitySettings[elementId] &&
        visibilitySettings[elementId].indexOf(sector) !== -1
      ) {
        return true;
      }
    }
    return false;
  },
});
registerComponent({ name: "FeatureName" });
registerComponent({ name: "SAPRange" });
registerComponent({ name: "SaveScreen" });
registerComponent({ name: "FilterInput" });
registerComponent({ name: "CollapsibleGroup" });

export { components, componentExportHelpers };
