import { describe, it } from "vitest";

import { chess } from "../harness.js";

describe("Risky Chess, 2026-04-19", () => {
  it("plays through the full game", () => {
    chess("risky")
      .play("e4", "c5")
      .play("Bc4", "e6")
      .play("Nf3", "Nf6")
      .play("O-O", "Nc6")
      .play("Nc3", "Bd6")
      .play("b3", "h5")
      .play("Ba3", "O-O")
      .play("d4", "e5")
      .play("dxc5", "Be7")
      .play("Nd5", "b6")
      .play("Nxf6", "Bxf6")
      .play("Qd6", "Qe8")
      .play("Rad1", "Be7")
      .play("Qd5", "Bxc5")
      .play("Bxc5", "bxc5")
      .play("Ng5", "f6")
      .play("Qxg8#")
      .assertGameOver("white", "king captured — 12 points ahead");
  });
});
