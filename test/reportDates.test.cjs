const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  todayGuatemala,
  fareCents,
  money,
  localDateTime,
} = require("../utils/reportDates.ts");
test("Guatemala date remains Sunday until 06:00 UTC on Monday", () => {
  assert.equal(todayGuatemala(new Date("2026-10-26T05:59:59Z")), "2026-10-25");
  assert.equal(todayGuatemala(new Date("2026-10-26T06:00:00Z")), "2026-10-26");
});
test("fare input converts whole quetzales and decimal amounts into cents", () => {
  assert.equal(fareCents("5"), 500);
  assert.equal(fareCents("5.25"), 525);
  assert.equal(fareCents("5,25"), 525);
  assert.equal(fareCents("0"), 0);
  assert.equal(fareCents("1000.00"), 100000);
});
test("invalid fare input is rejected rather than rounded silently", () => {
  for (const input of ["", "-5", "5.123", "1000.01", "Infinity", "5Q"])
    assert.throws(() => fareCents(input));
});
test("money and displayed timestamps distinguish UTC storage from Guatemala time", () => {
  assert.equal(money(500), "Q5.00");
  assert.equal(money(525), "Q5.25");
  assert.notEqual(
    localDateTime("2026-10-26 06:00:00.000"),
    "2026-10-26 06:00:00.000",
  );
});
