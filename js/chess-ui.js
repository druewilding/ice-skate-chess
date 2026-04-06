// Chess UI - renders the board, handles piece selection and move highlights

export class ChessUI {
  constructor(boardElement, engine, options = {}) {
    this.boardEl = boardElement;
    this.engine = engine;
    this.flipped = options.flipped || false;
    this.interactive = options.interactive !== undefined ? options.interactive : true;
    this.onMove = options.onMove || null;
    this.onPromotionChoice = options.onPromotionChoice || null;

    this.selectedSquare = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.pendingPromotion = null;
    this.confirmMove = options.confirmMove !== undefined ? options.confirmMove : true;
    this.pendingMoveConfirm = null;
    this.onPendingMoveChange = options.onPendingMoveChange || null;

    this.pieceSymbols = {
      white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
      black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
    };

    this.buildBoard();
  }

  buildBoard() {
    this.boardEl.innerHTML = '';
    this.boardEl.classList.add('chess-board');

    this.squares = [];

    for (let displayRank = 0; displayRank < 8; displayRank++) {
      const row = [];
      for (let displayFile = 0; displayFile < 8; displayFile++) {
        const rank = this.flipped ? 7 - displayRank : displayRank;
        const file = this.flipped ? 7 - displayFile : displayFile;

        const square = document.createElement('div');
        square.className = 'square';
        square.classList.add((rank + file) % 2 === 0 ? 'light' : 'dark');
        square.dataset.rank = rank;
        square.dataset.file = file;

        // Coordinate labels
        if (displayFile === 0) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'coord coord-rank';
          rankLabel.textContent = 8 - rank;
          square.appendChild(rankLabel);
        }
        if (displayRank === 7) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'coord coord-file';
          fileLabel.textContent = 'abcdefgh'[file];
          square.appendChild(fileLabel);
        }

        square.addEventListener('click', () => this.handleSquareClick(rank, file));

        this.boardEl.appendChild(square);
        row.push(square);
      }
      this.squares.push(row);
    }

    this.render();
  }

  setFlipped(flipped) {
    this.flipped = flipped;
    this.buildBoard();
  }

  // Returns the piece that should be visually displayed at (rank, file),
  // accounting for a pending-confirm move (shows the piece at its destination).
  getVisualPiece(rank, file) {
    if (this.pendingMoveConfirm) {
      const { fromRank, fromFile, toRank, toFile, promotion, castling, enPassant } = this.pendingMoveConfirm;
      if (rank === fromRank && file === fromFile) return null;
      // En passant: hide the captured pawn (same rank as moving pawn, destination file)
      if (enPassant && rank === fromRank && file === toFile) return null;
      if (rank === toRank && file === toFile) {
        const piece = this.engine.getPiece(fromRank, fromFile);
        if (promotion && piece) return { ...piece, type: promotion };
        return piece;
      }
      // Handle castling: also move the rook visually
      if (castling) {
        const rookFromFile = castling === 'king' ? 7 : 0;
        const rookToFile = castling === 'king' ? 5 : 3;
        if (rank === fromRank && file === rookFromFile) return null;
        if (rank === fromRank && file === rookToFile) return this.engine.getPiece(fromRank, rookFromFile);
      }
    }
    return this.engine.getPiece(rank, file);
  }

  render() {
    // Pre-compute whether the pending move results in check/checkmate
    let previewCheckKing = null; // { rank, file }
    let previewIsCheckmate = false;
    if (this.pendingMoveConfirm) {
      const { fromRank, fromFile, toRank, toFile, promotion } = this.pendingMoveConfirm;
      const result = this.engine.previewMoveResult(fromRank, fromFile, toRank, toFile, promotion || null);
      if (result.check || result.checkmate) {
        const movingPiece = this.engine.getPiece(fromRank, fromFile);
        if (movingPiece) {
          const opponent = movingPiece.color === 'white' ? 'black' : 'white';
          outer: for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
              const p = this.engine.getPiece(r, f);
              if (p && p.type === 'king' && p.color === opponent) {
                previewCheckKing = { rank: r, file: f };
                break outer;
              }
            }
          }
          previewIsCheckmate = result.checkmate;
        }
      }
    }

    for (let displayRank = 0; displayRank < 8; displayRank++) {
      for (let displayFile = 0; displayFile < 8; displayFile++) {
        const rank = this.flipped ? 7 - displayRank : displayRank;
        const file = this.flipped ? 7 - displayFile : displayFile;
        const square = this.squares[displayRank][displayFile];
        const piece = this.getVisualPiece(rank, file);

        // Remove old piece
        const oldPiece = square.querySelector('.piece');
        if (oldPiece) oldPiece.remove();

        // Remove state classes
        square.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move', 'in-check', 'in-checkmate', 'pending-from', 'pending-to', 'preview-check', 'preview-checkmate');

        if (piece) {
          const pieceEl = document.createElement('span');
          pieceEl.className = `piece piece-${piece.color}`;
          pieceEl.textContent = this.pieceSymbols[piece.color][piece.type];
          square.appendChild(pieceEl);
        }

        // Highlight last move
        if (this.lastMove) {
          if ((rank === this.lastMove.from.rank && file === this.lastMove.from.file) ||
              (rank === this.lastMove.to.rank && file === this.lastMove.to.file)) {
            square.classList.add('last-move');
          }
        }

        // Highlight selected square (suppressed while confirming a pending move)
        if (!this.pendingMoveConfirm && this.selectedSquare && rank === this.selectedSquare.rank && file === this.selectedSquare.file) {
          square.classList.add('selected');
        }

        // Highlight legal moves (suppressed while confirming a pending move)
        if (!this.pendingMoveConfirm) {
          const isLegalTarget = this.legalMoves.some(m => m.rank === rank && m.file === file);
          if (isLegalTarget) {
            const targetPiece = this.engine.getPiece(rank, file);
            // Also check en passant
            const isEnPassant = this.legalMoves.some(m => m.rank === rank && m.file === file && m.enPassant);
            if (targetPiece || isEnPassant) {
              square.classList.add('legal-capture');
            } else {
              square.classList.add('legal-move');
            }
          }
        }

        // Highlight pending move squares
        if (this.pendingMoveConfirm) {
          if (rank === this.pendingMoveConfirm.fromRank && file === this.pendingMoveConfirm.fromFile) {
            square.classList.add('pending-from');
          }
          if (rank === this.pendingMoveConfirm.toRank && file === this.pendingMoveConfirm.toFile) {
            square.classList.add('pending-to');
          }
        }

        // Highlight king in check or checkmate
        // Suppress during pending move preview — any legal pending move resolves check
        if (!this.pendingMoveConfirm && piece && piece.type === 'king' && piece.color === this.engine.turn && this.engine.isInCheck(this.engine.turn)) {
          if (this.engine.gameOver && this.engine.resultReason === 'checkmate') {
            square.classList.add('in-checkmate');
          } else {
            square.classList.add('in-check');
          }
        }

        // Highlight opponent king that would be in check/checkmate from pending move
        if (previewCheckKing && rank === previewCheckKing.rank && file === previewCheckKing.file) {
          square.classList.add(previewIsCheckmate ? 'preview-checkmate' : 'preview-check');
        }
      }
    }
  }

  handleSquareClick(rank, file) {
    if (!this.interactive || this.engine.gameOver) return;

    // If we have a pending promotion, ignore board clicks
    if (this.pendingPromotion) return;

    // If a pending move is awaiting confirmation, any board click cancels it
    if (this.pendingMoveConfirm) {
      this.pendingMoveConfirm = null;
      this.selectedSquare = null;
      this.legalMoves = [];
      if (this.onPendingMoveChange) this.onPendingMoveChange(null);
      this.render();
      return;
    }

    const piece = this.engine.getPiece(rank, file);

    // If a piece is selected and we clicked on a legal target
    if (this.selectedSquare) {
      const isLegalTarget = this.legalMoves.some(m => m.rank === rank && m.file === file);

      if (isLegalTarget) {
        // Check if this is a promotion move
        const promotionMove = this.legalMoves.find(m => m.rank === rank && m.file === file && m.promotion);
        if (promotionMove) {
          this.showPromotionDialog(rank, file);
          return;
        }

        // Stage for confirmation instead of executing immediately
        if (this.confirmMove) {
          const legalMove = this.legalMoves.find(m => m.rank === rank && m.file === file);
          this.pendingMoveConfirm = {
            fromRank: this.selectedSquare.rank,
            fromFile: this.selectedSquare.file,
            toRank: rank,
            toFile: file,
            castling: legalMove ? legalMove.castling : null,
            enPassant: legalMove ? legalMove.enPassant || false : false,
          };
          if (this.onPendingMoveChange) this.onPendingMoveChange(this.pendingMoveConfirm);
          this.render();
          return;
        }

        this.executeMove(this.selectedSquare.rank, this.selectedSquare.file, rank, file);
        return;
      }

      // Clicked on own piece - reselect
      if (piece && piece.color === this.engine.turn) {
        this.selectPiece(rank, file);
        return;
      }

      // Clicked elsewhere - deselect
      this.clearSelection();
      return;
    }

    // No piece selected - select if it's the current player's piece
    if (piece && piece.color === this.engine.turn) {
      this.selectPiece(rank, file);
    }
  }

  selectPiece(rank, file) {
    this.selectedSquare = { rank, file };
    this.legalMoves = this.engine.getLegalMoves(rank, file);
    this.render();
  }

  clearSelection() {
    this.selectedSquare = null;
    this.legalMoves = [];
    this.render();
  }

  getSquareEl(rank, file) {
    const displayRank = this.flipped ? 7 - rank : rank;
    const displayFile = this.flipped ? 7 - file : file;
    return this.squares[displayRank][displayFile];
  }

  // Animate a piece sliding from one square to another, then call onComplete.
  animateMove(fromRank, fromFile, toRank, toFile, symbol, pieceColor, onComplete) {
    const fromEl = this.getSquareEl(fromRank, fromFile);
    const toEl   = this.getSquareEl(toRank,   toFile);

    const fromRect = fromEl.getBoundingClientRect();
    const toRect   = toEl.getBoundingClientRect();

    // Hide the real piece at source (and destination, for remote moves where
    // the piece is already rendered at the target)
    const srcPiece = fromEl.querySelector('.piece');
    const dstPiece = toEl.querySelector('.piece');
    if (srcPiece) srcPiece.style.visibility = 'hidden';
    if (dstPiece) dstPiece.style.visibility = 'hidden';

    // Create a flying piece fixed-positioned over the source square
    const flyer = document.createElement('span');
    flyer.className = `piece piece-${pieceColor}`;
    flyer.textContent = symbol;
    const fontSize = Math.round(fromRect.width * 0.78) + 'px';
    Object.assign(flyer.style, {
      position: 'fixed',
      left: fromRect.left + 'px',
      top:  fromRect.top  + 'px',
      width:  fromRect.width  + 'px',
      height: fromRect.height + 'px',
      fontSize,
      lineHeight: fromRect.height + 'px',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: '1000',
      transition: 'none',
      margin: '0',
      padding: '0',
    });
    document.body.appendChild(flyer);

    // Force reflow so the starting position is painted before we transition
    flyer.getBoundingClientRect();

    const DURATION = 160; // ms
    flyer.style.transition = `left ${DURATION}ms ease, top ${DURATION}ms ease`;
    flyer.style.left = toRect.left + 'px';
    flyer.style.top  = toRect.top  + 'px';

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      flyer.remove();
      if (srcPiece) srcPiece.style.visibility = '';
      if (dstPiece) dstPiece.style.visibility = '';
      onComplete();
    };

    flyer.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, DURATION + 80); // safety fallback
  }

  executeMove(fromRank, fromFile, toRank, toFile, promotion = null) {
    const piece = this.engine.getPiece(fromRank, fromFile);
    if (!piece) return;

    const symbol = this.pieceSymbols[piece.color][piece.type];

    // Clear selection highlights and lock interaction for the duration of the animation
    this.selectedSquare = null;
    this.legalMoves = [];
    this.interactive = false;
    this.render(); // board shows piece at source, no highlights

    this.animateMove(fromRank, fromFile, toRank, toFile, symbol, piece.color, () => {
      const moveData = this.engine.makeMove(fromRank, fromFile, toRank, toFile, promotion);
      if (!moveData) { this.render(); return; }

      this.lastMove = moveData;
      this.render();

      if (this.onMove) {
        this.onMove(moveData); // game.html sets ui.interactive based on whose turn it is
      }
    });
  }

  confirmPendingMove() {
    if (!this.pendingMoveConfirm) return;
    const { fromRank, fromFile, toRank, toFile, promotion } = this.pendingMoveConfirm;
    this.pendingMoveConfirm = null;
    if (this.onPendingMoveChange) this.onPendingMoveChange(null);
    this.executeMove(fromRank, fromFile, toRank, toFile, promotion || null);
  }

  cancelPendingMove() {
    if (!this.pendingMoveConfirm) return;
    this.pendingMoveConfirm = null;
    this.selectedSquare = null;
    this.legalMoves = [];
    this.render();
    if (this.onPendingMoveChange) this.onPendingMoveChange(null);
  }

  showPromotionDialog(toRank, toFile) {
    const fromRank = this.selectedSquare.rank;
    const fromFile = this.selectedSquare.file;
    const color = this.engine.turn;

    this.pendingPromotion = { fromRank, fromFile, toRank, toFile };

    // Create promotion overlay
    const overlay = document.createElement('div');
    overlay.className = 'promotion-overlay';

    const dialog = document.createElement('div');
    dialog.className = `promotion-dialog${color === 'black' ? ' promotion-dialog--black' : ''}`;

    const pieces = ['queen', 'rook', 'bishop', 'knight'];
    for (const pieceType of pieces) {
      const btn = document.createElement('button');
      btn.className = 'promotion-choice';
      btn.textContent = this.pieceSymbols[color][pieceType];
      btn.addEventListener('click', () => {
        overlay.remove();
        this.pendingPromotion = null;
        if (this.confirmMove) {
          this.pendingMoveConfirm = { fromRank, fromFile, toRank, toFile, promotion: pieceType };
          if (this.onPendingMoveChange) this.onPendingMoveChange(this.pendingMoveConfirm);
          this.render();
        } else {
          this.executeMove(fromRank, fromFile, toRank, toFile, pieceType);
        }
      });
      dialog.appendChild(btn);
    }

    overlay.appendChild(dialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        this.pendingPromotion = null;
      }
    });

    this.boardEl.parentElement.appendChild(overlay);
  }

  // Apply a move from remote (already validated)
  applyRemoteMove(moveData) {
    this.lastMove = moveData;
    this.clearSelection();
  }

  // Set the last move highlight without clearing selection
  setLastMove(moveData) {
    this.lastMove = moveData;
  }

  updateCapturedPieces(capturedDisplayWhite, capturedDisplayBlack) {
    const typeOrder = ['pawn', 'knight', 'bishop', 'rook', 'queen'];
    const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9 };

    // Score by live board so promotions count automatically
    let whiteOnBoard = 0, blackOnBoard = 0;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = this.engine.board[r][f];
        if (!p) continue;
        const v = pieceValues[p.type] || 0;
        if (p.color === 'white') whiteOnBoard += v;
        else blackOnBoard += v;
      }
    }
    const whiteScore = whiteOnBoard;
    const blackScore = blackOnBoard;

    const render = (el, pieces, color, advantage) => {
      if (!el) return;
      el.innerHTML = '';
      el.dataset.pieceColor = color;
      const counts = {};
      for (const type of pieces) counts[type] = (counts[type] || 0) + 1;
      for (const type of typeOrder) {
        if (!counts[type]) continue;
        const group = document.createElement('span');
        group.className = 'captured-group';
        for (let i = 0; i < counts[type]; i++) {
          const span = document.createElement('span');
          span.className = `captured-piece piece-${color}`;
          span.textContent = this.pieceSymbols[color][type];
          group.appendChild(span);
        }
        el.appendChild(group);
      }
      // Place advantage label as a sibling outside the captured-pieces container
      const parent = el.parentElement;
      if (parent) {
        let pts = parent.querySelector('.captured-advantage');
        if (advantage > 0) {
          if (!pts) {
            pts = document.createElement('span');
            pts.className = 'captured-advantage';
            parent.appendChild(pts);
          }
          pts.textContent = `+${advantage}`;
        } else if (pts) {
          pts.remove();
        }
      }
    };

    // capturedDisplayWhite shows pieces captured BY white (i.e. black pieces)
    render(capturedDisplayWhite, this.engine.capturedPieces.white, 'black', Math.max(0, whiteScore - blackScore));
    render(capturedDisplayBlack, this.engine.capturedPieces.black, 'white', Math.max(0, blackScore - whiteScore));
  }
}
