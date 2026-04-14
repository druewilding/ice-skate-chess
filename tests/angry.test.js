import { describe, it } from 'vitest';
import { chess, chessFromPosition } from './harness.js';

describe('Angry Chess', () => {

  // ── Friendly captures ──────────────────────────────────────────────

  it('can capture own pieces (except king)', () => {
    chess('angry')
      .play('e4', 'e5', 'Nf3', 'Nc6', 'Bc4')
      // White bishop on c4 — it's now black's turn, so let's check white moves after black plays
      .play('d6')
      // Now it's white's turn. White bishop on c4 can capture friendly pawn on d3? No, d3 is empty.
      // Let's check that Nf3 can capture own pawn on d2 — but d2 pawn blocks.
      // Actually, Nf3 can reach d2 via knight move. d2 has a white pawn.
      .assertLegalMovesInclude('f3', 'd2') // knight can capture own pawn on d2
      .play('Nfxd2')
      .assertCaptures({ white: [], black: ['pawn'] }) // friendly capture credited to opponent
      .assertMaterial(-1);
  });

  it('friendly capture credits the opponent capture list', () => {
    // White knight on f3 captures own pawn on d2 — friendly capture
    chess('angry')
      .play('e4', 'e5', 'Nf3', 'Nc6')
      .play('Nfxd2')  // knight captures own pawn on d2
      .assertPiece('d2', 'knight', 'white')
      .assertEmpty('f3')
      // Friendly capture: the captured piece (own pawn) is credited to OPPONENT's list
      .assertCaptures({ white: [], black: ['pawn'] })
      .assertMaterial(-1);
  });

  it('friendly capture notation uses * suffix', () => {
    chess('angry')
      .play('e4', 'e5', 'Nf3', 'Nc6', 'Nfxd2')
      .assertLastMoves('Nfxd2*');
  });

  // ── Cannot capture own king ────────────────────────────────────────

  it('cannot capture own king', () => {
    chess('angry')
      .play('e4', 'e5', 'Qf3', 'Nc6')
      // White queen on f3 — should NOT be able to capture own king on e1
      .assertLegalMovesExclude('f3', 'e1');
  });

  // ── Friendly capture preview ───────────────────────────────────────

  it('preview friendly capture shows correct pen adjustment', () => {
    chess('angry')
      .play('e4', 'e5', 'Nf3', 'Nc6')
      .preview('Nfxd2') // knight captures own pawn
      .assertPreviewCaptures({ white: [], black: ['pawn'] }) // credited to opponent
      .assertPreviewMaterial(-1)
      .cancelPreview()
      .assertCaptures({ white: [], black: [] }); // unchanged after cancel
  });

  it('preview enemy capture in angry chess is normal', () => {
    chess('angry')
      .play('e4', 'd5')
      .preview('exd5')
      .assertPreviewCaptures({ white: ['pawn'], black: [] })
      .assertPreviewMaterial(1)
      .commitPreview()
      .assertCaptures({ white: ['pawn'], black: [] });
  });

  // ── Material tracking after mixed captures ─────────────────────────

  it('mixed friendly and enemy captures', () => {
    chess('angry')
      .play('e4', 'e5', 'Nf3', 'Nc6')
      .play('Nxe5')  // capture enemy pawn on e5
      .assertCaptures({ white: ['pawn'], black: [] })
      .assertMaterial(1)
      .play('Nxe5')  // black recaptures white knight
      .assertCaptures({ white: ['pawn'], black: ['knight'] })
      .assertMaterial(-2);
  });

  // ── History navigation with angry captures ─────────────────────────

  it('navigate history of angry captures', () => {
    chess('angry')
      .play('e4', 'e5', 'Nf3', 'Nc6', 'Nfxd2') // friendly capture move 5
      .goToMove(4)   // before the friendly capture
      .assertCaptures({ white: [], black: [] })
      .assertMaterial(0)
      .goToMove(5)   // after the friendly capture
      .assertCaptures({ white: [], black: ['pawn'] })
      .assertMaterial(-1)
      .goToLive();
  });

  // ── Checkmate still works ──────────────────────────────────────────

  it('checkmate with no friendly escape in angry chess', () => {
    // Black king alone on h8. White queen on b7 → Qg7# covers g8 (file),
    // h7 (rank), and f8 (diagonal). No friendly black pieces to escape into.
    chessFromPosition(
      '.......k/.Q....../.....K../......../......../......../......../........',
      { variant: 'angry', turn: 'white' }
    )
      .play('Qg7#')
      .assertGameOver('white', 'checkmate');
  });

  // ── Scholar's mate is NOT checkmate in Angry Chess ─────────────────

  it("scholar's mate is check but not checkmate — king escapes via Kxd8", () => {
    // After Qxf7+, the white queen is on f7 defended by Bc4.
    // In standard chess this is checkmate: the king can't go to d8 (own queen)
    // or f8 (own bishop, also covered by Qf7), and Kxf7 is illegal (Bc4 covers f7).
    // In ANGRY CHESS the king CAN capture its own friendly pieces (except other kings),
    // so Kxd8 — capturing the black queen — is a legal escape.
    chess('angry')
      .play('e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7+')
      .assertCheck(true)
      .assertNotGameOver()
      // The king's legal escape: capture own queen on d8
      .assertLegalMovesInclude('e8', 'd8')
      // Play the escape and verify the king is safe on d8
      .play('Kxd8')
      .assertPiece('d8', 'king', 'black')
      .assertEmpty('e8')
      .assertCheck(false)
      .assertNotGameOver();
  });
});
