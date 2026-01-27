import { Component, inject, signal, effect, computed } from '@angular/core';
import { GameService } from '../../Services/game.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-game-board',
  imports: [CommonModule],
  templateUrl: './game-board.html',
  styleUrl: './game-board.scss'
})
export class GameBoard {
  gameService = inject(GameService);
  private router = inject(Router);

  currentPlayer = this.gameService.currentPlayer;
  currentWord = this.gameService.currentWord;
  gameState = this.gameService.gameState;
  players = this.gameService.players;
  currentTurnIndex = this.gameService.currentTurnIndex;
  startingPlayer = this.gameService.startingPlayer;

  // Voting State
  revealedVotingRoles = signal<Set<number>>(new Set());
  wordRevealed = signal(false);
  rolesRevealed = signal(false);

  allImpostorsFound = computed(() => {
    const players = this.players();
    const revealedIndices = this.revealedVotingRoles();
    const impostors = players.map((p, i) => ({ ...p, originalIndex: i })).filter(p => p.role === 'Impostor');

    // Check if ALL impostors are in the revealed set
    return impostors.length > 0 && impostors.every(imp => revealedIndices.has(imp.originalIndex));
  });

  isRevealed = signal(false);

  constructor() {
    // Reset reveal state when interactions happen or turn changes could be handled here or in methods
    effect(() => {
      // When turn index OR game state changes, hide role
      const idx = this.gameService.currentTurnIndex();
      const state = this.gameService.gameState();
      this.isRevealed.set(false);
    });
  }

  toggleReveal() {
    this.isRevealed.update(v => !v);
  }

  nextTurn() {
    this.gameService.nextTurn();
  }

  previousTurn() {
    this.gameService.previousTurn();
  }

  startVoting() {
    this.gameService.startVoting();
  }

  toggleVotingRole(index: number) {
    this.revealedVotingRoles.update(set => {
      const newSet = new Set(set);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }

  toggleWordReveal() {
    this.wordRevealed.update(v => !v);
  }

  toggleRolesReveal() {
    this.rolesRevealed.update(v => !v);
  }

  resetGame() {
    this.gameService.resetGame();
    this.router.navigate(['/']);
  }
}
