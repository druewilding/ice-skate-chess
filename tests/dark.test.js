import { describe, it } from 'vitest';
import { chess, chessFromPosition } from './harness.js';

describe('Dark Chess', () => {

  // Dark Chess uses standard chess rules — the `dark` flag on the engine is
  // purely informational and doesn't change move generation or legality.
  // All visibility hiding is done by the UI (ChessUI). So here we verify that
  // the engine behaves identically to standard chess, and that the dark flag
  // is properly set.

  // ── Standard rules still apply ─────────────────────────────────────

  it('moves follow standard chess rules', () => {
    chess('dark')
      .play('e4', 'e5', 'Nf3', 'Nc6', 'Bb5')
      .assertTurn('black')
      .assertBoard({
        e4: 'wp', e5: 'bp',
        f3: 'wN', c6: 'bN',
        b5: 'wB',
      })
      .assertCaptures({ white: [], black: [] })
      .assertMaterial(0);
  });

  it('captures work exactly like standard chess', () => {
    chess('dark')
      .play('e4', 'd5', 'exd5', 'Qxd5')
      .assertCaptures({ white: ['pawn'], black: ['pawn'] })
      .assertMaterial(0);
  });

  // ── Checkmate ──────────────────────────────────────────────────────

  it("scholar's mate in the dark", () => {
    chess('dark')
      .play('e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#')
      .assertGameOver('white', 'checkmate')
      .assertCaptures({ white: ['pawn'], black: [] });
  });

  // ── En passant ─────────────────────────────────────────────────────

  it('en passant works in dark chess', () => {
    chess('dark')
      .play('e4', 'a6', 'e5', 'd5', 'exd6')
      .assertEmpty('d5')
      .assertPiece('d6', 'pawn', 'white')
      .assertCaptures({ white: ['pawn'], black: [] });
  });

  // ── Preview ────────────────────────────────────────────────────────

  it('preview works the same as standard', () => {
    chess('dark')
      .play('e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6')
      .preview('Qxf7#')
      .assertPreviewResult({ check: true, checkmate: true })
      .assertPreviewCaptures({ white: ['pawn'], black: [] })
      .commitPreview()
      .assertGameOver('white', 'checkmate');
  });

  // ── History ────────────────────────────────────────────────────────

  it('history navigation works in dark chess', () => {
    chess('dark')
      .play('e4', 'd5', 'exd5')
      .goToMove(2) // after e4, d5
      .assertCaptures({ white: [], black: [] })
      .goToMove(3) // after exd5
      .assertCaptures({ white: ['pawn'], black: [] })
      .goToLive();
  });

  // ── Castling ───────────────────────────────────────────────────────

  it('castling works in the dark', () => {
    chess('dark')
      .play('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O')
      .assertPiece('g1', 'king', 'white')
      .assertPiece('f1', 'rook', 'white')
      .assertEmpty('e1', 'h1');
  });
});
