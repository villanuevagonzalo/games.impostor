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

export interface SetupState {
    // Configuration
    impostorCount: number;
    selectedCategories: string[];
    shareImpostorHints: boolean;
    isRandomImpostorCount: boolean;

    // UI State
    isPlayersOpen: boolean;
    isImpostorsOpen: boolean;
    isCategoriesOpen: boolean;
    playerNameInput: string;
}

const DEFAULT_SETUP_STATE: SetupState = {
    impostorCount: 1,
    selectedCategories: [],
    shareImpostorHints: true,
    isRandomImpostorCount: false,
    isPlayersOpen: true,
    isImpostorsOpen: true,
    isCategoriesOpen: true,
    playerNameInput: ''
};

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
    readonly startingPlayer = signal<string | null>(null);

    // Game Data Signals
    readonly currentWord = signal<GameWord | null>(null);
    readonly timer = signal<number>(0);

    // Persisted Setup State
    readonly setupState = signal<SetupState>(DEFAULT_SETUP_STATE);

    readonly currentPlayer = computed(() => this.players()[this.currentTurnIndex()]);
    readonly isGameReady = computed(() => this.players().length >= 3);

    private words: GameWord[] = [];
    private readonly STORAGE_KEY = 'impostor_game_state';
    private isFreshStart = true;

    constructor() {
        this.loadState();
        this.loadWords();

        // Auto-save effect
        effect(() => {
            this.saveState();
        });

        // Auto-clamp impostor count effect
        effect(() => {
            const max = this.players().length;
            const currentData = this.setupState();
            // Only clamp if we have players (max > 0) or if we want to enforce 0 when 0 players.
            // Usually max is player count.
            // Be careful not to create infinite loops or unneeded writes.
            if (currentData.impostorCount > max && max > 0) {
                this.setImpostorCount(max);
            }
        });
    }

    private saveState() {
        const state = {
            players: this.players(),
            gameState: this.gameState(),
            currentTurnIndex: this.currentTurnIndex(),
            currentWord: this.currentWord(),
            setupState: this.setupState(),
            startingPlayer: this.startingPlayer()
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }

    private loadState() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            this.isFreshStart = false;
            try {
                const state = JSON.parse(saved);
                this.players.set(state.players || []);
                this.gameState.set(state.gameState || 'SETUP');
                this.currentTurnIndex.set(state.currentTurnIndex || 0);
                this.currentWord.set(state.currentWord || null);
                this.startingPlayer.set(state.startingPlayer || null);

                // Load setup state or migrate/fallback
                const loadedSetup = state.setupState || {};

                // Handle migration from old lastGameConfig if setupState doesn't exist but lastGameConfig does
                if (!state.setupState && state.lastGameConfig) {
                    loadedSetup.impostorCount = state.lastGameConfig.impostorCount;
                    loadedSetup.selectedCategories = state.lastGameConfig.categories;
                    loadedSetup.shareImpostorHints = state.lastGameConfig.shareImpostorHints;
                    loadedSetup.isRandomImpostorCount = state.lastGameConfig.isRandomImpostorCount;
                }

                this.setupState.set({ ...DEFAULT_SETUP_STATE, ...loadedSetup });

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

            // If fresh start (no previous config), select all categories by default
            if (this.isFreshStart) {
                this.updateSetupConfig({ selectedCategories: uniqueCategories });
            }

        } catch (error) {
            console.error('Error loading words', error);
            // Fallback data if load fails
            this.words = [
                { categoria: "Cultura Arg", palabraSecreta: "Mate", pistasImpostor: ["Yerba", "Bombilla", "Caliente", "Porongo", "Amargo"] }
            ];
            this.categories.set(["Cultura Arg"]);
            if (this.isFreshStart) {
                this.updateSetupConfig({ selectedCategories: ["Cultura Arg"] });
            }
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

    // --- Setup State Actions ---

    updateSetupConfig(partial: Partial<SetupState>) {
        this.setupState.update(s => ({ ...s, ...partial }));
    }

    toggleSection(section: 'players' | 'impostors' | 'categories') {
        this.setupState.update(s => {
            switch (section) {
                case 'players': return { ...s, isPlayersOpen: !s.isPlayersOpen };
                case 'impostors': return { ...s, isImpostorsOpen: !s.isImpostorsOpen };
                case 'categories': return { ...s, isCategoriesOpen: !s.isCategoriesOpen };
            }
        });
    }

    toggleCategory(category: string) {
        this.setupState.update(s => {
            const cats = s.selectedCategories;
            const newCats = cats.includes(category)
                ? cats.filter(c => c !== category)
                : [...cats, category];
            return { ...s, selectedCategories: newCats };
        });
    }

    selectAllCategories() {
        this.setupState.update(s => ({ ...s, selectedCategories: this.categories() }));
    }

    selectNoCategories() {
        this.setupState.update(s => ({ ...s, selectedCategories: [] }));
    }

    invertCategorySelection() {
        this.setupState.update(s => {
            const available = this.categories();
            const current = s.selectedCategories;
            const inverted = available.filter(c => !current.includes(c));
            return { ...s, selectedCategories: inverted };
        });
    }

    setImpostorCount(count: number) {
        this.setupState.update(s => ({ ...s, impostorCount: count }));
    }

    setPlayerNameInput(name: string) {
        this.setupState.update(s => ({ ...s, playerNameInput: name }));
    }

    // --- Game Logic ---

    startGame(config: { impostorCount: number, categories: string[], shareImpostorHints: boolean, isRandomImpostorCount?: boolean }) {
        this.updateSetupConfig(config); // Ensure config is saved

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

        // Determine shared hint if enabled
        let sharedHint: string | undefined;
        if (config.shareImpostorHints && randomWord.pistasImpostor?.length) {
            sharedHint = randomWord.pistasImpostor[Math.floor(Math.random() * randomWord.pistasImpostor.length)];
        }

        // Assign to players
        this.players.update(currentPlayers =>
            currentPlayers.map((p, i) => {
                const role = roles[i];
                let impostorHint: string | undefined;

                if (role === 'Impostor') {
                    if (sharedHint) {
                        impostorHint = sharedHint;
                    } else if (randomWord.pistasImpostor?.length) {
                        impostorHint = randomWord.pistasImpostor[Math.floor(Math.random() * randomWord.pistasImpostor.length)];
                    }
                }

                return { ...p, role, impostorHint };
            })
        );

        // Select Random Starting Player
        const currentPlayers = this.players();
        if (currentPlayers.length > 0) {
            const randomIndex = Math.floor(Math.random() * currentPlayers.length);
            this.startingPlayer.set(currentPlayers[randomIndex].name);
        } else {
            this.startingPlayer.set(null);
        }

        this.currentTurnIndex.set(0);
        this.gameState.set('VIEW_ROLE');
    }

    nextTurn() {
        const nextIndex = this.currentTurnIndex() + 1;
        if (nextIndex < this.players().length) {
            this.currentTurnIndex.set(nextIndex);
        } else {
            this.gameState.set('PLAYING');
        }
    }

    previousTurn() {
        if (this.gameState() === 'PLAYING') {
            this.gameState.set('VIEW_ROLE');
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
        this.startingPlayer.set(null);
        this.players.update(players => players.map(p => ({ name: p.name })));
        // We DO NOT remove item from local storage here anymore, or we only remove game state but KEEP setup state?
        // User asked to persist setup config "al refrescar y al reiniciar".
        // resetGame is usually called at end of game. We likely want to keep players and config.
        // Original code: localStorage.removeItem(this.STORAGE_KEY); -> This would wipe everything including players.
        // If we want to keep Setup persistence, we should NOT wipe the whole key, but just reset game-specific parts in the state.

        // Let's simply SAVE the state with reset values instead of removing the key.
        this.saveState();
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

