"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fgb_source_1 = require("fgb-source");
const calculateArea_1 = require("./geographies/calculateArea");
const FijiEEZ = [
    {
        cql2Query: null,
        source: "https://uploads.seasketch.org/projects/superuser/public/8a1adc53-7e67-436a-9b19-3318b8b14ad2.fgb",
        op: "DIFFERENCE",
    },
    {
        cql2Query: {
            op: "=",
            args: [
                {
                    property: "MRGID_EEZ",
                },
                8325,
            ],
        },
        source: "https://uploads.seasketch.org/projects/superuser/public/9f969bf7-a3a9-4289-85ad-97e049faca07.fgb",
        op: "INTERSECT",
    },
];
const FSMEEZ = [
    {
        cql2Query: {
            op: "=",
            args: [
                {
                    property: "MRGID_EEZ",
                },
                8316,
            ],
        },
        source: "https://uploads.seasketch.org/projects/superuser/public/9f969bf7-a3a9-4289-85ad-97e049faca07.fgb",
        op: "INTERSECT",
    },
    {
        cql2Query: null,
        source: "https://uploads.seasketch.org/projects/superuser/public/8a1adc53-7e67-436a-9b19-3318b8b14ad2.fgb",
        op: "DIFFERENCE",
    },
];
const USEEZ = [
    {
        cql2Query: null,
        source: "https://uploads.seasketch.org/projects/superuser/public/8a1adc53-7e67-436a-9b19-3318b8b14ad2.fgb",
        op: "DIFFERENCE",
    },
    {
        cql2Query: {
            op: "=",
            args: [
                {
                    property: "MRGID_EEZ",
                },
                8456,
            ],
        },
        source: "https://uploads.seasketch.org/projects/superuser/public/9f969bf7-a3a9-4289-85ad-97e049faca07.fgb",
        op: "INTERSECT",
    },
];
const sourceCache = new fgb_source_1.SourceCache("128mb", {
    overfetchBytes: 2000000,
});
(0, calculateArea_1.calculateArea)(USEEZ, sourceCache).then(console.log);
//# sourceMappingURL=test.js.map