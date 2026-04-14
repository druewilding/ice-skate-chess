import { describe, it } from 'vitest';
import { chess, chessFromPosition } from './harness.js';

describe('Ice Skate Chess', () => {

  // ── Sliding pieces must travel maximum distance ────────────────────

  it('bishop cannot stop early — must slide to the end', () => {
    chess('iceskate')
      .play('e4', 'e5')
      // The bishop on f1 can now move. In ice skate, it must go as far as possible.
      // Bc4 is NOT the max distance — Ba6 or Bb5... let's check what's legal.
      .assertLegalMovesExclude('f1', 'e2', 'd3') // can't stop on short squares
      .assertLegalMovesInclude('f1', 'a6');       // must go to edge
  });

  it('rook must slide to the far edge or first piece', () => {
    chessFromPosition(
      'r...k..r/pppppppp/......../......../......../......../PPPPPPPP/R...K..R',
      { variant: 'iceskate', castling: {
        white: { king: true, queen: true },
        black: { king: true, queen: true }
      }}
    )
      // White rook on a1 — blocked by pawn on a2, so no vertical moves.
      // Horizontal: can only go to b1, c1, d1 — but must go to d1 (max distance before king).
      .assertLegalMovesExclude('a1', 'b1', 'c1')
      .assertLegalMovesInclude('a1', 'd1');
  });

  it('queen must slide to maximum distance', () => {
    chess('iceskate')
      .play('e4', 'd5', 'exd5')
      // After exd5, the white queen on d1 has paths open via d-file.
      // In iceskate mode, it can't stop on d2, d3, d4 — must go to d5 (captures) or beyond.
      .assertLegalMovesExclude('d1', 'd2', 'd3', 'd4');
  });

  // ── Check-blocking exception ───────────────────────────────────────

  it('sliding piece CAN stop early to block check', () => {
    // Set up: white king in check, white rook can block by moving.
    // Black queen on e4 attacks white king on e1 along e-file.
    // White rook on a3 can move to e3 to block (intermediate, not max distance).
    chessFromPosition(
      '....k.../......../......../......../....q.../R......./......../....K...',
      { variant: 'iceskate', turn: 'white' }
    )
      // White king is in check from e4 queen.
      // White rook on a3 — in ice skate normally must go max distance.
      // But with check, it can stop at e3 to block.
      .assertCheck(true)
      .assertLegalMovesInclude('a3', 'e3');
  });

  // ── Knights are unaffected ─────────────────────────────────────────

  it('knights move normally — they are not sliding pieces', () => {
    chess('iceskate')
      .play('e4', 'e5')
      .assertLegalMovesInclude('g1', 'f3', 'h3')   // both squares available
      .assertLegalMovesInclude('b1', 'c3', 'a3');   // both squares available
  });

  // ── Capture at max distance ─────────────────────────────────────────

  it('capturing an enemy piece at max distance works', () => {
    chessFromPosition(
      '....k.../......../......../......../......../......../......../R......r',
      { variant: 'iceskate', turn: 'white',
        castling: { white: { king: false, queen: false }, black: { king: false, queen: false } }
      }
    )
      // White rook on a1 can slide all the way to h1 capturing the black rook
      // (that's max distance and a capture). No king blocking the path.
      .assertLegalMovesInclude('a1', 'h1')
      .play('Rxh1')
      .assertCaptures({ white: ['rook'], black: [] })
      .assertMaterial(5);
  });

  // ── Capture pen and material after ice skate game ──────────────────

  it('captures accumulate correctly in ice skate', () => {
    chess('iceskate')
      .play('e4', 'd5', 'exd5', 'Qxd5')
      .assertCaptures({ white: ['pawn'], black: ['pawn'] })
      .assertMaterial(0);
  });

  // ── Preview ────────────────────────────────────────────────────────

  it('preview capture at maximum slide distance', () => {
    chessFromPosition(
      '....k.../......../......../......../......../......../......../R......r',
      { variant: 'iceskate', turn: 'white',
        castling: { white: { king: false, queen: false }, black: { king: false, queen: false } }
      }
    )
      .preview('Rxh1')
      .assertPreviewCaptures({ white: ['rook'], black: [] })
      .assertPreviewMaterial(5)
      .commitPreview()
      .assertCaptures({ white: ['rook'], black: [] });
  });
});
