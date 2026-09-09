import Papa from "papaparse";
import {
  formatInviteStatus,
  INVITE_CSV_COLUMNS,
  invitesExportFilename,
  invitesToCsv,
  sanitizeFilename,
  USER_CSV_COLUMNS,
  usersExportFilename,
  usersToCsv,
} from "./exportCsv";

test("usersToCsv includes detail-modal fields and quotes special characters", () => {
  const csv = usersToCsv([
    {
      isAdmin: true,
      canonicalEmail: "chad@example.com",
      bannedFromForums: false,
      onboarded: "2024-02-01T12:00:00.000Z",
      groups: [{ name: "Expedition Reporting" }, { name: "Expedition Planning" }],
      profile: {
        fullname: "Burt, Chad",
        nickname: "Chad",
        email: "chad.public@example.com",
      },
    },
    {
      isAdmin: false,
      canonicalEmail: "pending@example.com",
      needsAccessRequestApproval: true,
      profile: { fullname: "Pending User" },
    },
    {
      isAdmin: false,
      canonicalEmail: "denied@example.com",
      deniedBy: { canonicalEmail: "admin@example.com" },
      approvedOrDeniedOn: "2024-03-15T08:30:00.000Z",
      profile: { email: "denied@example.com" },
    },
  ]);

  const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
  expect(parsed.meta.fields).toEqual([...USER_CSV_COLUMNS]);
  expect(parsed.data[0]).toMatchObject({
    Name: "Burt, Chad",
    Nickname: "Chad",
    Email: "chad.public@example.com",
    "Canonical Email": "chad@example.com",
    Admin: "Yes",
    Groups: "Expedition Planning; Expedition Reporting",
    "Banned from Forums": "No",
    Onboarded: "2024-02-01T12:00:00.000Z",
    "Access Status": "",
  });
  expect(parsed.data[1]["Access Status"]).toBe("Needs approval");
  expect(parsed.data[2]).toMatchObject({
    Admin: "No",
    "Access Status": "Denied",
    "Denied By": "admin@example.com",
    "Approved or Denied On": "2024-03-15T08:30:00.000Z",
  });
  expect(csv).toContain('"Burt, Chad"');
});

test("usersToCsv still emits a header row when there are no users", () => {
  const csv = usersToCsv([]);
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
  expect(parsed.meta.fields).toEqual([...USER_CSV_COLUMNS]);
  expect(csv.split("\n")[0]).toBe(
    USER_CSV_COLUMNS.map((column) => `"${column}"`).join(",")
  );
  expect(parsed.data.filter((row) => row.Name)).toEqual([]);
});

test("invitesToCsv includes status and related invite fields", () => {
  const csv = invitesToCsv([
    {
      email: "draft@example.com",
      fullname: "Draft User",
      status: "UNSENT",
      makeAdmin: true,
      wasUsed: false,
      createdAt: "2024-01-10T00:00:00.000Z",
      groups: [{ name: "Expedition Planning" }],
    },
    {
      email: "bounced@example.com",
      status: "BOUNCED",
      makeAdmin: false,
      wasUsed: false,
    },
    {
      email: "used@example.com",
      status: "CONFIRMED",
      wasUsed: true,
    },
  ]);

  const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
  expect(parsed.meta.fields).toEqual([...INVITE_CSV_COLUMNS]);
  expect(parsed.data[0]).toMatchObject({
    Name: "Draft User",
    Email: "draft@example.com",
    Status: "Unsent",
    Admin: "Yes",
    Groups: "Expedition Planning",
    "Created At": "2024-01-10T00:00:00.000Z",
    Used: "No",
  });
  expect(parsed.data[1].Status).toBe("Bounced");
  expect(parsed.data[2]).toMatchObject({
    Status: "Confirmed",
    Used: "Yes",
    Admin: "No",
  });
});

test("formatInviteStatus humanizes enum values", () => {
  expect(formatInviteStatus("TOKEN_EXPIRED")).toBe("Token Expired");
  expect(formatInviteStatus("UNSENT")).toBe("Unsent");
  expect(formatInviteStatus(null)).toBe("");
});

test("sanitizeFilename strips unsafe characters and keeps the extension", () => {
  expect(sanitizeFilename("Blue Prosperity Vanuatu/users.csv")).toBe(
    "Blue-Prosperity-Vanuatu-users.csv"
  );
  expect(sanitizeFilename("group: expedition planning.csv")).toBe(
    "group-expedition-planning.csv"
  );
});

test("export filenames include slug and list context", () => {
  expect(usersExportFilename({ slug: "blue-prosperity-vanuatu" })).toBe(
    "blue-prosperity-vanuatu-users.csv"
  );
  expect(
    usersExportFilename({
      slug: "blue-prosperity-vanuatu",
      adminsOnly: true,
    })
  ).toBe("blue-prosperity-vanuatu-admins.csv");
  expect(
    usersExportFilename({
      slug: "blue-prosperity-vanuatu",
      groupName: "Expedition Planning",
    })
  ).toBe("blue-prosperity-vanuatu-Expedition-Planning-users.csv");
  expect(invitesExportFilename("blue-prosperity-vanuatu", ["UNSENT"])).toBe(
    "blue-prosperity-vanuatu-invites-draft.csv"
  );
  expect(
    invitesExportFilename("blue-prosperity-vanuatu", ["BOUNCED", "ERROR"])
  ).toBe("blue-prosperity-vanuatu-invites-problems.csv");
});
