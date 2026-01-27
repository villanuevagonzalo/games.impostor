import { Component, inject, signal, ViewChild, ElementRef, AfterViewInit, computed, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '../../Services/game.service';

@Component({
  selector: 'app-setup',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './setup.html',
  styleUrl: './setup.scss'
})
export class Setup implements AfterViewInit {
  private gameService = inject(GameService);
  private router = inject(Router);

  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;

  // Bindings to GameService Setup State
  isPlayersOpen = computed(() => this.gameService.setupState().isPlayersOpen);
  isImpostorsOpen = computed(() => this.gameService.setupState().isImpostorsOpen);
  isCategoriesOpen = computed(() => this.gameService.setupState().isCategoriesOpen);

  // Two-way binding proxies (or just read/write via methods)
  // For ngModel, we might need a getter/setter if we want strict binding, or just handle events.
  // Using signals for local input handling if needed, but for persistence we want direct updates.
  // Player name input can be transient or persisted. Plan said persist.
  playerName = computed(() => this.gameService.setupState().playerNameInput);

  players = this.gameService.players;
  isGameReady = this.gameService.isGameReady;

  // Category Logic
  availableCategories = this.gameService.categories;
  selectedCategories = computed(() => this.gameService.setupState().selectedCategories);

  isSetupValid = computed(() => {
    return this.isGameReady() && this.selectedCategories().length > 0;
  });

  // Impostor Logic
  impostorCount = computed(() => this.gameService.setupState().impostorCount);
  maxImpostors = computed(() => Math.max(1, this.players().length));

  shareImpostorHint = computed(() => this.gameService.setupState().shareImpostorHints);
  isRandomImpostorCount = computed(() => this.gameService.setupState().isRandomImpostorCount);

  constructor() {
    // No initialization logic needed, handled by service default/load
  }

  ngAfterViewInit() {
    this.focusNameInput();
  }

  // --- UI Interactions ---

  focusNameInput() {
    if (this.isPlayersOpen()) {
      this.nameInput.nativeElement.focus();
    }
  }

  toggleSection(section: 'players' | 'impostors' | 'categories') {
    this.gameService.toggleSection(section);
  }

  updatePlayerName(name: string) {
    this.gameService.setPlayerNameInput(name);
  }

  addPlayer() {
    const name = this.playerName();
    if (!name.trim()) return;

    this.gameService.addPlayer(name);
    this.gameService.setPlayerNameInput(''); // Clear input after adding
    this.focusNameInput();

    // Adjust impostor count if it exceeds max
    if (this.impostorCount() > this.maxImpostors()) {
      this.gameService.setImpostorCount(this.maxImpostors());
    }
  }

  clearPlayers() {
    this.gameService.clearPlayers();
    this.gameService.setPlayerNameInput('');
    this.focusNameInput();
  }

  removePlayer(index: number) {
    this.gameService.removePlayer(index);
    // Adjust impostor count if it exceeds max
    if (this.impostorCount() > this.maxImpostors()) {
      this.gameService.setImpostorCount(this.maxImpostors());
    }
  }

  // --- Category Actions ---

  toggleCategory(category: string) {
    this.gameService.toggleCategory(category);
  }

  selectAll() {
    this.gameService.selectAllCategories();
  }

  selectNone() {
    this.gameService.selectNoCategories();
  }

  invertSelection() {
    this.gameService.invertCategorySelection();
  }

  // --- Impostor Actions ---

  adjustImpostorCount(delta: number) {
    const newCount = this.impostorCount() + delta;
    if (newCount >= 0 && newCount <= this.maxImpostors()) {
      this.gameService.setImpostorCount(newCount);
    }
  }

  toggleShareImpostorHints(checked: boolean) {
    this.gameService.updateSetupConfig({ shareImpostorHints: checked });
  }

  toggleRandomImpostorCount(checked: boolean) {
    this.gameService.updateSetupConfig({ isRandomImpostorCount: checked });
  }

  // --- Game Start ---

  private calculateRandomImpostorCount(): number {
    const totalPlayers = this.players().length;
    const config = { sharpness: 4.5, noiseFloor: 0.02 };
    const peak = Math.floor((totalPlayers + 2) / 4);

    const leftDistance = peak;
    const rightDistance = totalPlayers - peak;

    const leftSigma = leftDistance > 0 ? leftDistance / config.sharpness : 1;
    const rightSigma = rightDistance > 0 ? rightDistance / config.sharpness : 1;

    const weights: number[] = [];
    let totalWeight = 0;

    for (let i = 0; i <= totalPlayers; i++) {
      let baseWeight = 0;
      if (i < peak) {
        baseWeight = Math.exp(-Math.pow(i - peak, 2) / (2 * Math.pow(leftSigma, 2)));
      } else {
        baseWeight = Math.exp(-Math.pow(i - peak, 2) / (2 * Math.pow(rightSigma, 2)));
      }
      const finalWeight = baseWeight + config.noiseFloor;
      weights.push(finalWeight);
      totalWeight += finalWeight;
    }

    const randomValue = Math.random() * totalWeight;
    let accumulatedWeight = 0;

    for (let i = 0; i < weights.length; i++) {
      accumulatedWeight += weights[i];
      if (randomValue <= accumulatedWeight) {
        return i;
      }
    }
    return peak;
  }

  debugProbability() {
    const iterations = 1000;
    const results: Record<number, number> = {};

    for (let i = 0; i < iterations; i++) {
      const count = this.calculateRandomImpostorCount();
      results[count] = (results[count] || 0) + 1;
    }


    // Log percentages
    const percentages = Object.entries(results).map(([k, v]) => ({
      count: v,
      percentage: (v / iterations) * 100 + '%'
    }));
    console.table(percentages);
    console.log(`Total: ${iterations} iterations`);
  }

  startGame() {
    let finalImpostorCount = this.impostorCount();

    if (this.isRandomImpostorCount()) {
      finalImpostorCount = this.calculateRandomImpostorCount();
      console.log(`Random Impostor Count Selected: ${finalImpostorCount} (Players: ${this.players().length})`);
    }

    this.gameService.startGame({
      impostorCount: finalImpostorCount,
      categories: this.selectedCategories(),
      shareImpostorHints: this.shareImpostorHint(),
      isRandomImpostorCount: this.isRandomImpostorCount()
    });
    this.router.navigate(['/game']);
  }
}
