export function sortFormElements<
  T extends {
    position: number;
    typeId: string;
  }
>(elements: T[]) {
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
  const pre: T[] = [];
  const post: T[] = [];
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
    return [...pre, ...bodyElements, ...post] as T[];
  } else {
    return [...pre, ...bodyElements, ...post] as T[];
  }
}
