// https://stackoverflow.com/a/13348618
// @ts-ignore
const isChromium = window.chrome;
const winNav = window.navigator;
const vendorName = winNav.vendor;
// @ts-ignore
const isOpera = typeof window.opr !== "undefined";
const isIEedge = winNav.userAgent.indexOf("Edg") > -1;
const isIOSChrome = winNav.userAgent.match("CriOS");

let isGoogleChrome = false;
if (isIOSChrome) {
  // is Google Chrome on IOS
} else if (
  isChromium !== null &&
  typeof isChromium !== "undefined" &&
  vendorName === "Google Inc." &&
  isOpera === false &&
  isIEedge === false
) {
  isGoogleChrome = true;
  // is Google Chrome
} else {
  // not Google Chrome
}

export default isGoogleChrome;
