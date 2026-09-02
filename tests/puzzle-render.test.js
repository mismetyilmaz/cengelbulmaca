"use strict";

const assert = require("assert");
const path = require("path");
const PuzzleRender = require(path.join(__dirname, "..", "js", "puzzle-render.js"));

assert.strictEqual(PuzzleRender.arrowExitEdge("right"), "right");
assert.strictEqual(PuzzleRender.arrowExitEdge("right-down"), "right");
assert.strictEqual(PuzzleRender.arrowExitEdge("down"), "bottom");
assert.strictEqual(PuzzleRender.arrowExitEdge("down-right"), "bottom");

for (const direction of ["right", "right-down"]) {
  const style = PuzzleRender.computeArrowStyle(direction, 0, 1);
  assert.ok(Object.hasOwn(style, "right"), `${direction}: ok sağ kenarda değil`);
  assert.ok(!Object.hasOwn(style, "bottom"), `${direction}: ok yanlışlıkla alt kenarda`);
}

for (const direction of ["down", "down-right"]) {
  const style = PuzzleRender.computeArrowStyle(direction, 0, 1);
  assert.ok(Object.hasOwn(style, "bottom"), `${direction}: ok alt kenarda değil`);
  assert.ok(!Object.hasOwn(style, "right"), `${direction}: ok yanlışlıkla sağ kenarda`);
}

const ordered = PuzzleRender.orderClues([
  { wordId: "bottom", arrow: "down-right" },
  { wordId: "right", arrow: "right-down" }
]);
assert.deepStrictEqual(ordered.map(clue => clue.wordId), ["right", "bottom"]);

console.log("puzzle-render: ok kenarı ve ipucu sırası testleri geçti");
