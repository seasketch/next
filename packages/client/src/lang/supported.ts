export interface LangDetails {
  name: string;
  localName?: string;
  code: string;
  rtl?: boolean;
}

const languages: LangDetails[] = [
  { name: "English", localName: "English", code: "EN" },
  {
    name: "Dhivehi",
    localName: "ދިވެހި,",
    code: "dv",
    rtl: true,
  },
  {
    name: "Portuguese",
    localName: "Portuguese",
    code: "pt",
  },
  {
    name: "Norwegian",
    localName: "Norsk",
    code: "no",
  },
  {
    name: "Kosraean",
    localName: "Kosraean",
    code: "kos",
  },
];

export default languages;
