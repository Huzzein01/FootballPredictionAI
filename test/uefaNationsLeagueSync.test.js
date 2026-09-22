"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { detectGroups, phaseFor } = require("../src/uefaNationsLeagueSync");

test("phaseFor reads event.season.slug, not the nonexistent event.season.type.name", () => {
  assert.equal(phaseFor({ season: { slug: "group-stage", year: 2026 } }), "group-stage");
  assert.equal(phaseFor({ season: { slug: "relegation-playoffs", year: 2024 } }), "playoff");
  assert.equal(phaseFor({ season: { slug: "promotion-playoffs", year: 2024 } }), "playoff");
  assert.equal(phaseFor({ season: { slug: "finals", year: 2027 } }), "finals");
  // Missing/unknown slug falls back to group-stage rather than throwing.
  assert.equal(phaseFor({ season: {} }), "group-stage");
  assert.equal(phaseFor({}), "group-stage");
});

test("detectGroups clusters teams by who they face in the group stage, ignoring playoff fixtures", () => {
  const fixtures = [
    { phase: "group-stage", homeTeam: "Germany", awayTeam: "Netherlands" },
    { phase: "group-stage", homeTeam: "Netherlands", awayTeam: "Germany" },
    { phase: "group-stage", homeTeam: "Serbia", awayTeam: "Greece" },
    { phase: "group-stage", homeTeam: "Germany", awayTeam: "Serbia" },
    { phase: "group-stage", homeTeam: "France", awayTeam: "Italy" },
    { phase: "group-stage", homeTeam: "Belgium", awayTeam: "Turkiye" },
    { phase: "group-stage", homeTeam: "France", awayTeam: "Belgium" },
    // A prior-cycle relegation playoff between two teams from otherwise
    // separate real groups — must NOT merge France's group with Germany's.
    { phase: "playoff", homeTeam: "Italy", awayTeam: "Germany" },
  ];
  const groups = detectGroups(fixtures);
  const groupList = Object.values(groups);

  const germanyGroup = groupList.find((teams) => teams.includes("Germany"));
  assert.deepEqual(germanyGroup.sort(), ["Germany", "Netherlands", "Serbia", "Greece"].sort());

  const franceGroup = groupList.find((teams) => teams.includes("France"));
  assert.deepEqual(franceGroup.sort(), ["France", "Italy", "Belgium", "Turkiye"].sort());

  // The playoff fixture must not have merged these two groups into one.
  assert.notDeepEqual(germanyGroup, franceGroup);
});
