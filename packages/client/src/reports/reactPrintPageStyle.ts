/** Passed to react-to-print `pageStyle` (CRA/webpack 4 import path see ReportFullPrintBridge). */
// eslint-disable-next-line i18next/no-literal-string -- CSS for print iframe only
export const REACT_PRINT_PAGE_STYLE = `
  @page { size: auto; margin: 12mm; }
  @media print {
    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .report-print-root {
      width: 100% !important;
      max-width: none !important;
      background: #ffffff !important;
      color: #000000 !important;
    }
    .report-print-root .ReportCard {
      width: 100% !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .report-print-tab {
      break-inside: auto;
      page-break-inside: auto;
    }
    .report-print-tab > h2 {
      break-after: avoid;
      page-break-after: avoid;
    }
  }
`;
