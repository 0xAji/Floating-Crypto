const test = require("node:test");
const assert = require("node:assert/strict");
const { hexToHsl, hexToRgb, hslToHex } = require("../src/lib/color");

test("converts hex colors to RGB", () => {
  assert.deepEqual(hexToRgb("#131316"), { r: 19, g: 19, b: 22 });
  assert.equal(hexToRgb("invalid"), null);
});

test("converts hex colors to HSL", () => {
  assert.deepEqual(hexToHsl("#ff0000"), { h: 0, s: 100, l: 50 });
  assert.deepEqual(hexToHsl("#00ff00"), { h: 120, s: 100, l: 50 });
  assert.deepEqual(hexToHsl("#ffffff"), { h: 0, s: 0, l: 100 });
});

test("converts HSL values to hex colors", () => {
  assert.equal(hslToHex(0, 100, 50), "#ff0000");
  assert.equal(hslToHex(120, 100, 50), "#00ff00");
  assert.equal(hslToHex(240, 100, 50), "#0000ff");
  assert.equal(hslToHex(360, 100, 50), "#ff0000");
});
