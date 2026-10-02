import { ALLOWED_DOMAINS, DOMAIN_TO_UNIVERSITY, extractDomain, resolveUniversity } from "./constants";

describe("resolveUniversity -- the Belfast Lock", () => {
  test.each([
    ["ana@qub.ac.uk", "qub"],
    ["ana@ulster.ac.uk", "ulster"],
    ["ANA@QUB.AC.UK", "qub"],
    ["  ana@qub.ac.uk  ", "qub"],
    ["ana+tag@qub.ac.uk", "qub"],
  ])("accepts %s as %s", (email, uni) => {
    expect(resolveUniversity(email)).toBe(uni);
  });

  test.each([
    ["ana@gmail.com", "a personal address"],
    ["ana@qub.ac.uk.evil.com", "an allowed domain used as a prefix"],
    ["ana@evilqub.ac.uk", "an allowed domain used as a suffix"],
    // If QUB or Ulster ever issue subdomain addresses, this is the case to revisit.
    ["ana@cs.qub.ac.uk", "a subdomain"],
    ["ana@qub.ac.uk@gmail.com", "two @ signs"],
    ["qub.ac.uk", "no @ at all"],
    ["@qub.ac.uk", "no local part"],
    ["ana@", "no domain"],
    ["", "an empty string"],
  ])("rejects %s (%s)", (email) => {
    expect(resolveUniversity(email)).toBeNull();
  });
});

test("extractDomain lower-cases and trims", () => {
  expect(extractDomain("  Ana@QUB.ac.uk ")).toBe("qub.ac.uk");
});

test("every allowed domain maps to a university", () => {
  for (const domain of ALLOWED_DOMAINS) {
    expect(DOMAIN_TO_UNIVERSITY[domain]).toBeDefined();
  }
});
