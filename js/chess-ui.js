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

    // Dark Chess: hide enemy pieces unless a selected piece illuminates them
    this.dark = options.dark || false;
    this.playerColor = options.playerColor || 'white';
    this.darkRevealed = false;


    // Map for image filenames
    this.pieceImagePaths = {
      white: {
        king:  'assets/pieces/white/king.webp',
        queen: 'assets/pieces/white/queen.webp',
        rook:  'assets/pieces/white/rook.webp',
        bishop:'assets/pieces/white/bishop.webp',
        knight:'assets/pieces/white/knight.webp',
        pawn:  'assets/pieces/white/pawn.webp',
        amazon: 'assets/pieces/white/amazon.webp',
      },
      black: {
        king:  'assets/pieces/black/king.webp',
        queen: 'assets/pieces/black/queen.webp',
        rook:  'assets/pieces/black/rook.webp',
        bishop:'assets/pieces/black/bishop.webp',
        knight:'assets/pieces/black/knight.webp',
        pawn:  'assets/pieces/black/pawn.webp',
        amazon: 'assets/pieces/black/amazon.webp',
      }
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

      if (castling) {
        // Castling is always on the back rank (fromRank === toRank)
        const rookFromFile = this.engine.initialRookFiles
          ? (castling === 'king' ? this.engine.initialRookFiles.king : this.engine.initialRookFiles.queen)
          : (castling === 'king' ? 7 : 0);
        const kingToFile = toFile;
        const rookToFile = castling === 'king' ? 5 : 3;

        if (rank !== fromRank) return this.engine.getPiece(rank, file);
        // Check destinations first, then sources — order matters for 960 overlaps
        if (file === kingToFile) return this.engine.getPiece(fromRank, fromFile);
        if (file === rookToFile) return this.engine.getPiece(fromRank, rookFromFile);
        if (file === fromFile)    return null; // king vacated
        if (file === rookFromFile) return null; // rook vacated
        return this.engine.getPiece(rank, file);
      }

      if (rank === fromRank && file === fromFile) return null;
      // En passant: hide the captured pawn (same rank as moving pawn, destination file)
      if (enPassant && rank === fromRank && file === toFile) return null;
      if (rank === toRank && file === toFile) {
        const piece = this.engine.getPiece(fromRank, fromFile);
        if (promotion && piece) return { ...piece, type: promotion };
        return piece;
      }
    }
    return this.engine.getPiece(rank, file);
  }

  render() {
    // Dark Chess: pre-compute which squares are illuminated (torch mechanic)
    const isDark = this.dark && !this.darkRevealed;
    let illuminatedSquares = null;
    if (isDark) {
      illuminatedSquares = new Set();
      if (this.selectedSquare) {
        illuminatedSquares.add(`${this.selectedSquare.rank},${this.selectedSquare.file}`);
      }
      for (const m of this.legalMoves) {
        illuminatedSquares.add(`${m.rank},${m.file}`);
      }
    }

    // Pre-compute whether the pending move results in check/checkmate/stalemate
    let previewCheckKing = null; // { rank, file }
    let previewIsCheckmate = false;
    let previewIsStalemate = false;
    let previewIsDraw = false;
    if (this.pendingMoveConfirm) {
      const { fromRank, fromFile, toRank, toFile, promotion, castling } = this.pendingMoveConfirm;
      const result = this.engine.previewMoveResult(fromRank, fromFile, toRank, toFile, promotion || null, castling);
      previewIsDraw = result.draw;
      if (result.check || result.checkmate || result.stalemate) {
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
          previewIsStalemate = result.stalemate;
        }
      }
    }

    // Dim board on any draw (live game-over or pending-move preview)
    const inStalemate = (this.engine.gameOver && this.engine.result === 'draw') || previewIsStalemate || previewIsDraw;
    this.boardEl.classList.toggle('board-stalemated', inStalemate);

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
        square.classList.remove('selected', 'legal-move', 'legal-capture', 'legal-friendly', 'last-move', 'in-check', 'in-checkmate', 'in-stalemate', 'pending-from', 'pending-to', 'preview-check', 'preview-checkmate', 'preview-stalemate', 'dark-shrouded', 'dark-illuminated');

        // Dark Chess: determine if this piece is hidden in darkness
        const hidePiece = isDark && piece && piece.color !== this.playerColor &&
          !(illuminatedSquares && illuminatedSquares.has(`${rank},${file}`));

        if (piece && !hidePiece) {
          const pieceEl = document.createElement('img');
          pieceEl.className = `piece piece-${piece.color}`;
          pieceEl.src = this.pieceImagePaths[piece.color][piece.type];
          pieceEl.alt = `${piece.color} ${piece.type}`;
          pieceEl.draggable = false;
          square.appendChild(pieceEl);
        }

        // Dark Chess: apply darkness / illumination classes
        if (isDark) {
          const isOwnPiece = piece && piece.color === this.playerColor;
          const isIlluminated = illuminatedSquares && illuminatedSquares.has(`${rank},${file}`);
          if (!isOwnPiece && !isIlluminated) {
            square.classList.add('dark-shrouded');
          } else if (isIlluminated) {
            square.classList.add('dark-illuminated');
          }
        }

        // Highlight last move (suppress in dark mode for opponent's move squares)
        if (this.lastMove) {
          const lastMoveIsOpponent = isDark && this.lastMove.piece.color !== this.playerColor;
          if (!lastMoveIsOpponent) {
            if ((rank === this.lastMove.from.rank && file === this.lastMove.from.file) ||
                (rank === this.lastMove.to.rank && file === this.lastMove.to.file)) {
              square.classList.add('last-move');
            }
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
            const isCastlingTarget = this.legalMoves.some(m => m.rank === rank && m.file === file && m.castling);
            if (isCastlingTarget) {
              square.classList.add('legal-friendly');
            } else if (targetPiece || isEnPassant) {
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

        // Highlight king in check, checkmate, or stalemate
        // Suppress during pending move preview — any legal pending move resolves check
        if (!this.pendingMoveConfirm && piece && piece.type === 'king' && piece.color === this.engine.turn) {
          if (this.engine.gameOver && this.engine.resultReason === 'checkmate') {
            square.classList.add('in-checkmate');
          } else if (this.engine.gameOver && this.engine.resultReason === 'stalemate') {
            square.classList.add('in-stalemate');
          } else if (this.engine.isInCheck(this.engine.turn)) {
            square.classList.add('in-check');
          }
        }

        // Highlight opponent king that would be in check/checkmate/stalemate from pending move
        if (previewCheckKing && rank === previewCheckKing.rank && file === previewCheckKing.file) {
          if (previewIsCheckmate) square.classList.add('preview-checkmate');
          else if (previewIsStalemate) square.classList.add('preview-stalemate');
          else square.classList.add('preview-check');
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

        // Check for castling ambiguity (Chess 960: king move and castle land on same square)
        const movesToSquare = this.legalMoves.filter(m => m.rank === rank && m.file === file);
        const castlingCandidate = movesToSquare.find(m => m.castling);
        const regularCandidate = movesToSquare.find(m => !m.castling);
        if (castlingCandidate && regularCandidate) {
          this.showCastlingDisambiguationDialog(rank, file, castlingCandidate, regularCandidate);
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
  animateMove(fromRank, fromFile, toRank, toFile, pieceType, pieceColor, onComplete) {
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

    const flyer = document.createElement('img');
    flyer.className = `piece piece-${pieceColor}`;
    flyer.src = this.pieceImagePaths[pieceColor][pieceType];
    flyer.alt = `${pieceColor} ${pieceType}`;
    Object.assign(flyer.style, {
      position: 'fixed',
      left: fromRect.left + 'px',
      top:  fromRect.top  + 'px',
      width:  fromRect.width  + 'px',
      height: fromRect.height + 'px',
      pointerEvents: 'none',
      zIndex: '1000',
      margin: '0',
      padding: '0',
      transition: 'left 160ms ease, top 160ms ease',
    });
    document.body.appendChild(flyer);

    // Force reflow so the starting position is painted before we transition
    flyer.getBoundingClientRect();

    flyer.style.left = toRect.left + 'px';
    flyer.style.top  = toRect.top  + 'px';

    const DURATION = 160; // ms
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

  executeMove(fromRank, fromFile, toRank, toFile, promotion = null, castling = undefined) {

    const piece = this.engine.getPiece(fromRank, fromFile);
    if (!piece) return;
    // Clear selection highlights and lock interaction for the duration of the animation
    this.selectedSquare = null;
    this.legalMoves = [];
    this.interactive = false;
    this.render(); // board shows piece at source, no highlights

    this.animateMove(fromRank, fromFile, toRank, toFile, piece.type, piece.color, () => {
      const moveData = this.engine.makeMove(fromRank, fromFile, toRank, toFile, promotion, castling);
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
    const { fromRank, fromFile, toRank, toFile, promotion, castling } = this.pendingMoveConfirm;
    this.pendingMoveConfirm = null;
    if (this.onPendingMoveChange) this.onPendingMoveChange(null);
    this.executeMove(fromRank, fromFile, toRank, toFile, promotion || null, castling !== undefined ? castling : undefined);
  }

  cancelPendingMove() {
    if (!this.pendingMoveConfirm) return;
    this.pendingMoveConfirm = null;
    this.selectedSquare = null;
    this.legalMoves = [];
    this.render();
    if (this.onPendingMoveChange) this.onPendingMoveChange(null);
  }

  showCastlingDisambiguationDialog(toRank, toFile, castlingMove, regularMove) {
    const fromRank = this.selectedSquare.rank;
    const fromFile = this.selectedSquare.file;
    const color = this.engine.turn;
    const isFriendlyCapture = regularMove.friendlyCapture;

    const overlay = document.createElement('div');
    overlay.className = 'promotion-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'promotion-dialog castling-disambiguation-dialog';

    const label = document.createElement('div');
    label.className = 'castling-disambiguation-label';
    label.textContent = isFriendlyCapture ? 'Capture rook or castle?' : 'Move king or castle?';
    dialog.appendChild(label);

    const choices = [
      { text: isFriendlyCapture ? 'Capture' : 'Move king', move: regularMove },
      { text: 'Castle', move: castlingMove },
    ];

    for (const { text, move } of choices) {
      const btn = document.createElement('button');
      btn.className = 'promotion-choice castling-choice';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        overlay.remove();
        if (this.confirmMove) {
          this.pendingMoveConfirm = {
            fromRank,
            fromFile,
            toRank,
            toFile,
            castling: move.castling || null,
            enPassant: move.enPassant || false,
          };
          if (this.onPendingMoveChange) this.onPendingMoveChange(this.pendingMoveConfirm);
          this.render();
        } else {
          this.executeMove(fromRank, fromFile, toRank, toFile, null, move.castling || null);
        }
      });
      dialog.appendChild(btn);
    }

    overlay.appendChild(dialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    this.boardEl.parentElement.appendChild(overlay);
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

    let pieces = ['queen', 'rook', 'bishop', 'knight'];
    // If Superchess, add Amazon as a promotion option
    if (this.engine.superchess) pieces.unshift('amazon');
    for (const pieceType of pieces) {
      const btn = document.createElement('button');
      btn.className = 'promotion-choice';
      const img = document.createElement('img');
      img.src = this.pieceImagePaths[color][pieceType];
      img.alt = `${color} ${pieceType}`;
      img.draggable = false;
      img.style.width = '100%';
      img.style.height = '100%';
      btn.appendChild(img);
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
    const typeOrder = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'amazon'];
    const pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, amazon: 13 };

    // Check for a pending capture from the confirm-move preview
    let pendingCapture = null; // { capturedBy: 'white'|'black', type: string }
    if (this.pendingMoveConfirm) {
      const { fromRank, fromFile, toRank, toFile, enPassant } = this.pendingMoveConfirm;
      const movingPiece = this.engine.getPiece(fromRank, fromFile);
      const capturedPiece = enPassant
        ? this.engine.getPiece(fromRank, toFile)
        : this.engine.getPiece(toRank, toFile);
      if (movingPiece && capturedPiece) {
        pendingCapture = { capturedBy: movingPiece.color, type: capturedPiece.type };
      }
    }

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

    // Adjust scores to reflect the pending capture and/or promotion
    let previewWhiteScore = whiteOnBoard;
    let previewBlackScore = blackOnBoard;
    if (pendingCapture) {
      const val = pieceValues[pendingCapture.type] || 0;
      if (pendingCapture.capturedBy === 'white') {
        // Check if this is a friendly capture (angry chess)
        const capturedPiece = this.pendingMoveConfirm.enPassant
          ? this.engine.getPiece(this.pendingMoveConfirm.fromRank, this.pendingMoveConfirm.toFile)
          : this.engine.getPiece(this.pendingMoveConfirm.toRank, this.pendingMoveConfirm.toFile);
        if (capturedPiece && capturedPiece.color === 'white') previewWhiteScore -= val;
        else previewBlackScore -= val;
      } else {
        const capturedPiece = this.pendingMoveConfirm.enPassant
          ? this.engine.getPiece(this.pendingMoveConfirm.fromRank, this.pendingMoveConfirm.toFile)
          : this.engine.getPiece(this.pendingMoveConfirm.toRank, this.pendingMoveConfirm.toFile);
        if (capturedPiece && capturedPiece.color === 'black') previewBlackScore -= val;
        else previewWhiteScore -= val;
      }
    }
    if (this.pendingMoveConfirm?.promotion) {
      const { fromRank, fromFile, promotion } = this.pendingMoveConfirm;
      const movingPiece = this.engine.getPiece(fromRank, fromFile);
      if (movingPiece) {
        const promotionGain = (pieceValues[promotion] || 0) - (pieceValues['pawn'] || 0);
        if (movingPiece.color === 'white') previewWhiteScore += promotionGain;
        else previewBlackScore += promotionGain;
      }
    }

    const render = (el, pieces, previewPieceType, color, advantage, isAdvantagePreview) => {
      if (!el) return;
      el.innerHTML = '';
      el.dataset.pieceColor = color;
      const counts = {};
      for (const type of pieces) counts[type] = (counts[type] || 0) + 1;
      for (const type of typeOrder) {
        const normalCount = counts[type] || 0;
        const hasPreview = previewPieceType === type;
        if (!normalCount && !hasPreview) continue;
        const group = document.createElement('span');
        group.className = 'captured-group';
        for (let i = 0; i < normalCount; i++) {
          const img = document.createElement('img');
          img.className = `captured-piece piece-${color}`;
          img.src = this.pieceImagePaths[color][type];
          img.alt = type;
          group.appendChild(img);
        }
        if (hasPreview) {
          const img = document.createElement('img');
          img.className = `captured-piece piece-${color} captured-piece--preview`;
          img.src = this.pieceImagePaths[color][type];
          img.alt = type;
          group.appendChild(img);
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
          pts.classList.toggle('captured-advantage--preview', isAdvantagePreview);
        } else if (pts) {
          pts.remove();
        }
      }
    };

    const previewWhiteAdv = Math.max(0, previewWhiteScore - previewBlackScore);
    const previewBlackAdv = Math.max(0, previewBlackScore - previewWhiteScore);
    const currentWhiteAdv = Math.max(0, whiteOnBoard - blackOnBoard);
    const currentBlackAdv = Math.max(0, blackOnBoard - whiteOnBoard);

    // For friendly captures (angry chess), credit opponent's capture list
    let whitePreviewType = null;
    let blackPreviewType = null;
    if (pendingCapture) {
      const capturedPiece = this.pendingMoveConfirm.enPassant
        ? this.engine.getPiece(this.pendingMoveConfirm.fromRank, this.pendingMoveConfirm.toFile)
        : this.engine.getPiece(this.pendingMoveConfirm.toRank, this.pendingMoveConfirm.toFile);
      if (capturedPiece && capturedPiece.color === pendingCapture.capturedBy) {
        // Friendly capture: credit opponent
        const opponent = pendingCapture.capturedBy === 'white' ? 'black' : 'white';
        if (opponent === 'white') whitePreviewType = pendingCapture.type;
        else blackPreviewType = pendingCapture.type;
      } else {
        if (pendingCapture.capturedBy === 'white') whitePreviewType = pendingCapture.type;
        else blackPreviewType = pendingCapture.type;
      }
    }

    // For a pending promotion, compute adjusted capture lists so the displayed
    // piece icons match what they'll look like after confirmation.
    let whiteCaptures = this.engine.capturedPieces.white;
    let blackCaptures = this.engine.capturedPieces.black;
    if (this.pendingMoveConfirm?.promotion) {
      const { fromRank, fromFile, promotion } = this.pendingMoveConfirm;
      const movingPiece = this.engine.getPiece(fromRank, fromFile);
      if (movingPiece) {
        const promoterColor = movingPiece.color;
        const opponentColor = promoterColor === 'white' ? 'black' : 'white';
        // Work on copies so we don't mutate engine state
        whiteCaptures = [...this.engine.capturedPieces.white];
        blackCaptures = [...this.engine.capturedPieces.black];
        const opponentCaptures = opponentColor === 'white' ? whiteCaptures : blackCaptures;
        const promoterCaptures = promoterColor === 'white' ? whiteCaptures : blackCaptures;
        // Opponent gains the promoting pawn
        opponentCaptures.push('pawn');
        // Promoted piece type: remove from opponent's prior captures or credit promoter
        const idx = opponentCaptures.indexOf(promotion);
        if (idx !== -1) {
          opponentCaptures.splice(idx, 1);
        } else {
          promoterCaptures.push(promotion);
        }
      }
    }

    // capturedDisplayWhite shows pieces captured BY white (i.e. black pieces)
    render(capturedDisplayWhite, whiteCaptures, whitePreviewType, 'black',
           previewWhiteAdv, previewWhiteAdv !== currentWhiteAdv);
    render(capturedDisplayBlack, blackCaptures, blackPreviewType, 'white',
           previewBlackAdv, previewBlackAdv !== currentBlackAdv);
  }
}
