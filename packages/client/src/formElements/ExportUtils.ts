/* eslint-disable i18next/no-literal-string */
import { ComboBoxProps, ComboBoxValue } from "./ComboBox";
import { ConsentProps, ConsentValue } from "./Consent";
import { MultipleChoiceProps, MultipleChoiceValue } from "./MultipleChoice";
import { NameProps, NameType } from "./Name";
import { MatrixProps, MatrixValue } from "./Matrix";
import {
  SAPValueType,
  SpatialAccessPriorityProps,
} from "./SpatialAccessPriority/SpatialAccessPriority";

/**
 * Returns the column names that should appear in survey data export for a given
 * form element configuration. All arguments are derived from columns in the
 * form_elements table. Usually, this will be a single column with a name
 * matching the export_id. In some more complex FormElement types, also inlcuded
 * will be multiple generated columns.
 *
 * For example, even the simple Name field can include a facilitator option. So,
 * for the name field with a an exportId of `name`, the exported columns would
 * be:
 *
 * [
 *    # Name given for respondent
 *    'name',
 *    # Facilitator's name if given
 *    'name_facilitator'
 * ]
 *
 * @param componentName
 * @param exportId
 * @param componentSettings
 * @returns
 */
export function getColumnNames(
  componentName: string,
  exportId: string,
  componentSettings: any
): string[] {
  if (componentName in components) {
    return components[componentName].getColumns(componentSettings, exportId);
  } else {
    return [exportId];
  }
}

export function getAnswers(
  componentName: string,
  exportId: string,
  componentSettings: any,
  answer: any
) {
  if (componentName in components) {
    return components[componentName].getAnswers(
      componentSettings,
      exportId,
      answer
    );
  } else {
    return { [exportId]: answer };
  }
}

type ColumnsFunction<T = any> = (
  componentSettings: T,
  exportId: string
) => string[];
type AnswersFunction<T = any, A = any> = (
  componentSettings: T,
  exportId: string,
  answer: A
) => { [column: string]: any };

let components: {
  [componentName: string]: {
    getColumns: ColumnsFunction;
    getAnswers: AnswersFunction;
  };
} = {};

function registerComponent<ComponentSettingsType, AnswersType>(
  componentName: string,
  getColumns: ColumnsFunction<ComponentSettingsType>,
  getAnswers: AnswersFunction<ComponentSettingsType, AnswersType>
) {
  components[componentName] = {
    getColumns,
    getAnswers,
  };
}

registerComponent<NameProps, NameType>(
  "Name",
  (componentSettings, exportId) => {
    return [exportId, `is_facilitated`, `facilitator_name`];
  },
  (settings, exportId, answer) => {
    return {
      [exportId]: answer.name,
      is_facilitated: !!(answer.facilitator && answer.facilitator.length > 0),
      facilitator_name: answer.facilitator,
    };
  }
);

registerComponent<ConsentProps, ConsentValue>(
  "Consent",
  (componentSettings, exportId) => {
    return [exportId, `${exportId}_doc_version`, `${exportId}_doc_clicked`];
  },
  (settings, exportId, answer) => {
    return {
      [exportId]: !!answer.consented,
      [`${exportId}_doc_version`]: answer.docVersion,
      [`${exportId}_doc_clicked`]: !!answer.clickedDoc,
    };
  }
);

registerComponent<MultipleChoiceProps, MultipleChoiceValue>(
  "MultipleChoice",
  (componentSettings, exportId) => {
    return [exportId];
  },
  (settings, exportId, answer) => {
    return {
      [exportId]: settings.multipleSelect
        ? answer
        : Array.isArray(answer)
        ? answer[0]
        : undefined,
    };
  }
);

registerComponent<ComboBoxProps, ComboBoxValue>(
  "ComboBox",
  (componentSettings, exportId) => {
    return [exportId];
  },
  (settings, exportId, answer) => {
    return {
      [exportId]: Array.isArray(answer) ? answer[0] : answer || undefined,
    };
  }
);

registerComponent<MatrixProps, MatrixValue>(
  "Matrix",
  (componentSettings, exportId) => {
    return (componentSettings.rows || []).map(
      (option) => `${exportId}_${option.value || option.label}`
    );
  },
  (settings, exportId, answer) => {
    return (settings.rows || []).reduce((prev, option) => {
      prev[`${exportId}_${option.value || option.label}`] =
        answer[option.value || option.label];
      return prev;
    }, {} as { [answer: string]: string });
  }
);

registerComponent<SpatialAccessPriorityProps, SAPValueType>(
  "SpatialAccessPriorityInput",
  (componentSettings, exportId) => {
    return [`${exportId}_sectors`, `${exportId}_feature_ids`];
  },
  (settings, exportId, answer) => {
    return {
      [`${exportId}_sectors`]: answer.sectors,
      [`${exportId}_feature_ids`]: answer.collection || [],
    };
  }
);
