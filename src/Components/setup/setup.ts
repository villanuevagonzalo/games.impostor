import { Component, inject, signal, ViewChild, ElementRef, AfterViewInit, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '../../Services/game.service';

@Component({
  selector: 'app-setup',
  imports: [FormsModule],
  templateUrl: './setup.html',
  styleUrl: './setup.scss'
})
export class Setup implements AfterViewInit {
  private gameService = inject(GameService);
  private router = inject(Router);

  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;

  playerName = signal('');
  players = this.gameService.players;
  isGameReady = this.gameService.isGameReady;

  isSetupValid = computed(() => {
    return this.isGameReady() && this.selectedCategories().length > 0;
  });

  // Category Logic
  availableCategories = this.gameService.categories;
  selectedCategories = signal<string[]>([]);
  private categoriesInitialized = false;

  constructor() {
    effect(() => {
      const available = this.availableCategories();
      if (available.length > 0 && !this.categoriesInitialized) {
        this.selectedCategories.set(available);
        this.categoriesInitialized = true;
      }
    });
  }

  // Impostor Logic
  impostorCount = signal(1);
  maxImpostors = computed(() => Math.max(0, this.players().length));

  toggleCategory(category: string) {
    this.selectedCategories.update(cats => {
      if (cats.includes(category)) {
        return cats.filter(c => c !== category);
      } else {
        return [...cats, category];
      }
    });
  }

  selectAll() {
    this.selectedCategories.set(this.availableCategories());
  }

  selectNone() {
    this.selectedCategories.set([]);
  }

  invertSelection() {
    const current = this.selectedCategories();
    const available = this.availableCategories();
    const inverted = available.filter(c => !current.includes(c));
    this.selectedCategories.set(inverted);
  }

  ngAfterViewInit() {
    this.nameInput.nativeElement.focus();
  }


  addPlayer() {
    if (!this.playerName().trim()) return;
    this.gameService.addPlayer(this.playerName());
    this.playerName.set('');
    this.nameInput.nativeElement.focus();

    // Adjust impostor count if it exceeds max
    if (this.impostorCount() > this.maxImpostors()) {
      this.impostorCount.set(this.maxImpostors());
    }
  }

  clearPlayers() {
    this.gameService.clearPlayers();
    this.playerName.set('');
    this.nameInput.nativeElement.focus();
  }

  adjustImpostorCount(delta: number) {
    const newCount = this.impostorCount() + delta;
    if (newCount >= 0 && newCount <= this.maxImpostors()) {
      this.impostorCount.set(newCount);
    }
  }

  removePlayer(index: number) {
    this.gameService.removePlayer(index);
    // Adjust impostor count if it exceeds max
    if (this.impostorCount() > this.maxImpostors()) {
      this.impostorCount.set(this.maxImpostors());
    }
  }

  startGame() {
    this.gameService.startGame({
      impostorCount: this.impostorCount(),
      categories: this.selectedCategories()
    });
    this.router.navigate(['/game']);
  }
}
