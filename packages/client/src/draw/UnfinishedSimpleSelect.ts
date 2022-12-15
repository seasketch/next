import S from "./SimpleSelect";

const SimpleSelect = S();

const _onSetup = SimpleSelect.onSetup;

const UnfinishedSimpleSelect = {
  ...SimpleSelect,
};

UnfinishedSimpleSelect.onSetup = function (opts: any) {
  const state = _onSetup.apply(this, [opts]);
  return state;
};

UnfinishedSimpleSelect.clickAnywhere = function (state: any) {
  // do nothing. don't allow switching away
};

UnfinishedSimpleSelect.clickOnVertex = function (state: any, e: any) {
  // do nothing. don't allow switching away
};

UnfinishedSimpleSelect.clickOnFeature = function (state: any, e: any) {
  // do nothing. don't allow switching away
};

UnfinishedSimpleSelect.onMouseMove = function (state: any, e: any) {
  const result = SimpleSelect.onMouseMove.apply(this, [state, e]);
  if (
    e.featureTarget?.properties?.active === "false" &&
    e.featureTarget?.properties?.meta === "feature"
  ) {
    this.updateUIClasses({ mouse: "not-allowed" });
  }
  return result;
};

export default UnfinishedSimpleSelect;
