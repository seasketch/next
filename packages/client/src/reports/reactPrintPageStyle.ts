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
    .report-tabs-control {
      display: none !important;
    }
    .report-tabs .report-tabs-panels > * {
      display: block !important;
    }
    .report-tabs [data-report-tab-panel] + [data-report-tab-panel] {
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
    }
    .report-tabs [data-report-tab-panel]::before {
      content: attr(data-tab-label);
      display: block;
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 0.5rem;
    }
  }
`;
