import { describe, it } from "vitest";

import { chess } from "../harness.js";

describe("Dark Chess, 2026-04-14", () => {
  it("capture accounting is correct throughout", () => {
    chess("dark")
      .play("e4", "Nf6")
      .assertCaptures({ white: [], black: [] })
      .assertMaterial(0)

      .play("Qf3", "e6", "e5", "d6", "exf6", "gxf6")
      .assertCaptures({ white: ["knight"], black: ["pawn"] })
      .assertMaterial(2)

      .play("Bc4", "Rg8", "Nc3", "Rxg2")
      .assertCaptures({ white: ["knight"], black: ["pawn", "pawn"] })
      .assertMaterial(1)

      .play("Qxg2", "Bh6")
      .assertCaptures({ white: ["knight", "rook"], black: ["pawn", "pawn"] })
      .assertMaterial(6)

      .play("Nf3", "f5", "d3", "Bxc1")
      .assertCaptures({ white: ["knight", "rook"], black: ["pawn", "pawn", "bishop"] })
      .assertMaterial(3)

      .play("Rxc1", "Qh4")
      .assertCaptures({ white: ["knight", "bishop", "rook"], black: ["pawn", "pawn", "bishop"] })
      .assertMaterial(6)

      .play("Nxh4", "f4")
      .assertCaptures({ white: ["knight", "bishop", "rook", "queen"], black: ["pawn", "pawn", "bishop"] })
      .assertMaterial(15)

      .play("Nb5", "f3", "Nxc7+")
      .assertCheck(true)
      .play("Ke7")
      .assertCheck(false)

      .play("Nxa8")
      .assertCaptures({
        white: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "bishop"],
      })
      .assertMaterial(21)
      .play("fxg2")
      .assertCaptures({
        white: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "bishop", "queen"],
      })
      .assertMaterial(12)

      .goToMove(27)
      .assertCaptures({
        white: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "bishop"],
      })
      .assertMaterial(21)
      .goToLive()
      .assertCaptures({
        white: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "bishop", "queen"],
      })
      .assertMaterial(12)

      .play("Nxg2", "a5")
      .assertCaptures({
        white: ["pawn", "pawn", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "bishop", "queen"],
      })
      .assertMaterial(13)

      .play("O-O", "Nc6", "Rfe1", "Ne5", "Rxe5")
      .assertCaptures({
        white: ["pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "bishop", "queen"],
      })
      .assertMaterial(16)
      .play("dxe5")
      .assertCaptures({
        white: ["pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "bishop", "rook", "queen"],
      })
      .assertMaterial(11)

      .play("f4", "exf4")
      .assertCaptures({
        white: ["pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "pawn", "bishop", "rook", "queen"],
      })
      .assertMaterial(10)

      .play("Re1", "a4", "Rxe6+")
      .assertCheck(true)
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "pawn", "bishop", "rook", "queen"],
      })
      .assertMaterial(11)
      .play("fxe6")
      .assertCheck(false)
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "pawn", "bishop", "rook", "rook", "queen"],
      })
      .assertMaterial(6)

      .play("b3", "axb3")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "pawn", "pawn", "bishop", "rook", "rook", "queen"],
      })
      .assertMaterial(5)

      .play("axb3", "f3")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "pawn", "pawn", "bishop", "rook", "rook", "queen"],
      })
      .assertMaterial(6)

      .play("Nc7", "fxg2")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "pawn", "pawn", "knight", "bishop", "rook", "rook", "queen"],
      })
      .assertMaterial(3)

      .play("Nxe6", "Bxe6")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      })
      .assertMaterial(1)

      .play("Bb5", "Bxb3")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
        black: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      })
      .assertMaterial(0)

      .play("cxb3", "h5")
      .assertCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      })
      .assertMaterial(3)

      .play("h4", "b6", "d4", "Kf6", "Be2", "b5", "Bxh5", "Kg7")
      .assertCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      })
      .assertMaterial(4)

      .play("d5", "Kh6", "Bg6", "Kxg6")
      .assertCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
      })
      .assertMaterial(1)

      .play("d6", "Kf5", "d7", "Kg4", "b4", "Kxh4")
      .assertCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
      })
      .assertMaterial(0)

      .preview("d8=Q+")
      .assertPreviewCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
        ],
      })
      .assertPreviewMaterial(8)
      .commitPreview()
      .assertCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
        ],
      })
      .assertMaterial(8)
      .assertCheck(true)
      .play("Kg3")
      .assertCheck(false)

      .play("Qd3+")
      .assertCheck(true)
      .play("Kf4")
      .assertCheck(false)

      .play("Kxg2", "Ke5")
      .assertCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
        ],
      })
      .assertMaterial(9)

      .play("Qxb5+")
      .assertCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
        ],
      })
      .assertMaterial(10)
      .assertCheck(true)
      .play("Ke4")
      .assertCheck(false)

      .play("Kf2", "Kd4", "Kf3", "Kc3", "Ke3", "Kc2", "Qd3+")
      .assertCheck(true)
      .play("Kb2")
      .assertCheck(false)

      .play("Kd2", "Ka2", "Kc2", "Ka1")
      .assertNotGameOver()
      .play("Qa3#")
      .assertGameOver("white", "checkmate")

      .goToMove(1)
      .assertCaptures({ white: [], black: [] })
      .assertMaterial(0)
      .assertNotGameOver()

      .goToMove(73)
      .assertCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
        ],
      })
      .assertMaterial(8)
      .assertNotGameOver()

      .goToLive()
      .assertCaptures({
        white: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
          "queen",
        ],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "bishop",
          "rook",
          "rook",
        ],
      })
      .assertMaterial(10)
      .assertGameOver("white", "checkmate");
  });
});
