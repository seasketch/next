var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) =>
  key in obj
    ? __defProp(obj, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value,
      })
    : (obj[key] = value);
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop)) __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop)) __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __markAsModule = (target) =>
  __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, copyDefault, desc) => {
  if (
    (module2 && typeof module2 === "object") ||
    typeof module2 === "function"
  ) {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && (copyDefault || key !== "default"))
        __defProp(target, key, {
          get: () => module2[key],
          enumerable:
            !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable,
        });
  }
  return target;
};
var __toCommonJS = /* @__PURE__ */ ((cache) => {
  return (module2, temp) => {
    return (
      (cache && cache.get(module2)) ||
      ((temp = __reExport(__markAsModule({}), module2, 1)),
      cache && cache.set(module2, temp),
      temp)
    );
  };
})(typeof WeakMap !== "undefined" ? /* @__PURE__ */ new WeakMap() : 0);

// src/formElements/ExportUtils.ts
var ExportUtils_exports = {};
__export(ExportUtils_exports, {
  getAnswers: () => getAnswers,
  getDataForExport: () => getDataForExport,
  normalizeSpatialProperties: () => normalizeSpatialProperties,
});

// src/formElements/sortFormElements.ts
function sortFormElements(elements) {
  if (elements.length === 0) {
    return [];
  }
  const Welcome = elements.find((el) => el.typeId === "WelcomeMessage");
  const ThankYou = elements.find((el) => el.typeId === "ThankYou");
  const SaveScreen = elements.find((el) => el.typeId === "SaveScreen");
  const FeatureName = elements.find((el) => el.typeId === "FeatureName");
  const SAPRange = elements.find((el) => el.typeId === "SAPRange");
  const Consent = elements.find((el) => el.typeId === "Consent");
  const bodyElements = elements.filter(
    (el) =>
      el.typeId !== "WelcomeMessage" &&
      el.typeId !== "ThankYou" &&
      el.typeId !== "SaveScreen" &&
      el.typeId !== "FeatureName" &&
      el.typeId !== "SAPRange" &&
      el.typeId !== "Consent"
  );
  bodyElements.sort((a, b) => {
    return a.position - b.position;
  });
  const pre = [];
  const post = [];
  if (Welcome) {
    pre.push(Welcome);
  }
  if (Consent) {
    pre.push(Consent);
  }
  if (FeatureName) {
    pre.push(FeatureName);
  }
  if (SAPRange) {
    pre.push(SAPRange);
  }
  if (SaveScreen) {
    post.push(SaveScreen);
  }
  if (ThankYou) {
    post.push(ThankYou);
  }
  if (Welcome || ThankYou) {
    if (!Welcome) {
      throw new Error("WelcomeMessage FormElement not in Form");
    }
    if (!ThankYou) {
      throw new Error("ThankYou FormElement not in Form");
    }
    if (!SaveScreen) {
      throw new Error("SaveScreen FormElement is not in Form");
    }
    return [...pre, ...bodyElements, ...post];
  } else {
    return [...pre, ...bodyElements, ...post];
  }
}

// src/formElements/ExportUtils.ts
function getAnswers(componentName, exportId, componentSettings, answer) {
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
function getDataForExport(responses, formElements) {
  const sortedElements = sortFormElements(formElements);
  const rows = [];
  const columns = [
    "id",
    "survey_id",
    "created_at_utc",
    "updated_at_utc",
    "is_practice",
    "is_duplicate_ip",
    "is_logged_in",
    "account_email",
  ];
  for (const element of sortedElements) {
    if (element.isInput) {
      if (element.typeId in components) {
        columns.push(
          ...components[element.typeId].getColumns(
            element.componentSettings,
            element.exportId
          )
        );
      } else {
        columns.push(element.exportId);
      }
    }
  }
  for (const response of responses) {
    const row = {
      id: response.id,
      survey_id: response.surveyId,
      created_at_utc: new Date(response.createdAt).toISOString(),
      is_practice: response.isPractice,
      updated_at_utc: response.updatedAt
        ? new Date(response.updatedAt).toISOString()
        : null,
      is_duplicate_ip: response.isDuplicateIp,
      is_logged_in: !!response.userId,
      account_email: response.accountEmail || null,
    };
    const answers = getAnswersAsProperties(sortedElements, response.data);
    rows.push(__spreadValues(__spreadValues({}, row), answers));
  }
  return { rows, columns };
}
function getAnswersAsProperties(sortedElements, data) {
  const answers = {};
  for (const element of sortedElements) {
    const answer = data[element.id];
    if (answer !== void 0) {
      const columnData = getAnswers(
        element.typeId,
        element.exportId,
        element.componentSettings,
        answer
      );
      for (const col in columnData) {
        answers[col] = columnData[col];
      }
    }
  }
  return answers;
}
function normalizeSpatialProperties(surveyId, collection, formElements) {
  const sortedElements = sortFormElements(formElements);
  for (const feature of collection.features) {
    feature.properties = __spreadValues(
      __spreadValues(
        {
          survey_id: surveyId,
          response_id: feature.properties.response_id,
        },
        getAnswersAsProperties(sortedElements, feature.properties)
      ),
      feature.properties.area_sq_meters
        ? { area_sq_meters: feature.properties.area_sq_meters }
        : {}
    );
  }
  return collection;
}
var components = {};
function registerComponent(componentName, getColumns, getAnswers2) {
  components[componentName] = {
    getColumns,
    getAnswers: getAnswers2,
  };
}
registerComponent(
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
registerComponent(
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
registerComponent(
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
        : void 0,
    };
  }
);
registerComponent(
  "ComboBox",
  (componentSettings, exportId) => {
    return [exportId];
  },
  (settings, exportId, answer) => {
    return {
      [exportId]: Array.isArray(answer) ? answer[0] : answer || void 0,
    };
  }
);
registerComponent(
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
    }, {});
  }
);
registerComponent(
  "SpatialAccessPriorityInput",
  (componentSettings, exportId) => {
    return [`${exportId}_sectors`, `${exportId}_feature_ids`];
  },
  (settings, exportId, answer) => {
    if (Array.isArray(answer)) {
      return {
        [`${exportId}_sectors`]: [
          "Unknown -- https://github.com/seasketch/next/commit/3a69e33b14dd444b240edc24aa95d754099e2c25",
        ],
        [`${exportId}_feature_ids`]: answer,
      };
    } else {
      return {
        [`${exportId}_sectors`]: answer.sectors,
        [`${exportId}_feature_ids`]: answer.collection || [],
      };
    }
  }
);
module.exports = __toCommonJS(ExportUtils_exports);
// Annotate the CommonJS export names for ESM import in node:
0 &&
  (module.exports = {
    getAnswers,
    getDataForExport,
    normalizeSpatialProperties,
  });
