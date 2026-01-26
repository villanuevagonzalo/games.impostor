import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface GameWord {
    categoria: string;
    palabraSecreta: string;
    pistasImpostor: string[];
}

export type Role = 'Citizen' | 'Impostor';

export interface Player {
    name: string;
    role?: Role;
    impostorHint?: string;
}

export type GameState = 'SETUP' | 'VIEW_ROLE' | 'PLAYING' | 'VOTING' | 'RESULT';

@Injectable({
    providedIn: 'root'
})
export class GameService {
    private http = inject(HttpClient);

    // State Signals
    readonly players = signal<Player[]>([]);
    readonly gameState = signal<GameState>('SETUP');
    readonly currentTurnIndex = signal<number>(0);
    readonly categories = signal<string[]>([]);

    // Game Data Signals
    readonly currentWord = signal<GameWord | null>(null);
    readonly timer = signal<number>(0);

    // Computed
    readonly currentPlayer = computed(() => this.players()[this.currentTurnIndex()]);
    readonly isGameReady = computed(() => this.players().length >= 3);

    private words: GameWord[] = [];
    private readonly STORAGE_KEY = 'impostor_game_state';

    constructor() {
        this.loadState();
        this.loadWords();

        // Auto-save effect
        effect(() => {
            this.saveState();
        });
    }

    private saveState() {
        const state = {
            players: this.players(),
            gameState: this.gameState(),
            currentTurnIndex: this.currentTurnIndex(),
            currentWord: this.currentWord()
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }

    private loadState() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.players.set(state.players || []);
                this.gameState.set(state.gameState || 'SETUP');
                this.currentTurnIndex.set(state.currentTurnIndex || 0);
                this.currentWord.set(state.currentWord || null);
            } catch (e) {
                console.error('Error parsing saved state', e);
                localStorage.removeItem(this.STORAGE_KEY);
            }
        }
    }

    async loadWords() {
        try {
            this.words = await firstValueFrom(this.http.get<GameWord[]>('assets/palabras.json'));
            const uniqueCategories = [...new Set(this.words.map(w => w.categoria))];
            this.categories.set(uniqueCategories);
        } catch (error) {
            console.error('Error loading words', error);
            // Fallback data if load fails
            this.words = [
                { categoria: "Cultura Arg", palabraSecreta: "Mate", pistasImpostor: ["Yerba", "Bombilla", "Caliente", "Porongo", "Amargo"] }
            ];
            this.categories.set(["Cultura Arg"]);
        }
    }

    addPlayer(name: string) {
        if (name.trim()) {
            this.players.update(p => [...p, { name: name.trim() }]);
        }
    }

    removePlayer(index: number) {
        this.players.update(p => p.filter((_, i) => i !== index));
    }

    clearPlayers() {
        this.players.set([]);
    }

    startGame(config: { impostorCount: number, categories: string[] }) {
        if (!this.words.length || !this.isGameReady()) return;

        // Filter words by category
        const filteredWords = this.words.filter(w => config.categories.includes(w.categoria));
        if (filteredWords.length === 0) {
            console.error('No words available for selected categories');
            return;
        }

        // Select random word
        const randomWord = filteredWords[Math.floor(Math.random() * filteredWords.length)];
        this.currentWord.set(randomWord);

        // Assign Roles
        const playerCount = this.players().length;
        let roles: Role[] = [];

        // Add Impostors
        for (let i = 0; i < config.impostorCount; i++) {
            roles.push('Impostor');
        }

        // Fill rest with Citizens
        while (roles.length < playerCount) {
            roles.push('Citizen');
        }

        // Shuffle roles
        roles = this.shuffleArray(roles);

        // Assign to players
        this.players.update(currentPlayers =>
            currentPlayers.map((p, i) => {
                const role = roles[i];
                let impostorHint: string | undefined;

                if (role === 'Impostor' && randomWord.pistasImpostor?.length) {
                    impostorHint = randomWord.pistasImpostor[Math.floor(Math.random() * randomWord.pistasImpostor.length)];
                }

                return { ...p, role, impostorHint };
            })
        );

        this.currentTurnIndex.set(0);
        this.gameState.set('VIEW_ROLE');
    }

    nextTurn() {
        const nextIndex = this.currentTurnIndex() + 1;
        if (nextIndex < this.players().length) {
            this.currentTurnIndex.set(nextIndex);
        } else {
            this.gameState.set('PLAYING');
            // Start timer or game logic here if needed
        }
    }

    previousTurn() {
        if (this.gameState() === 'PLAYING') {
            this.gameState.set('VIEW_ROLE');
            // Go back to the last player
            this.currentTurnIndex.set(this.players().length - 1);
        } else if (this.currentTurnIndex() > 0) {
            this.currentTurnIndex.update(i => i - 1);
        }
    }

    startVoting() {
        this.gameState.set('VOTING');
    }

    resetGame() {
        this.gameState.set('SETUP');
        this.currentTurnIndex.set(0);
        this.currentWord.set(null);
        this.players.update(players => players.map(p => ({ name: p.name }))); // Keep names, reset roles
        localStorage.removeItem(this.STORAGE_KEY);
    }

    private shuffleArray<T>(array: T[]): T[] {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}
