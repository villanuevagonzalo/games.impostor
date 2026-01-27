import { Routes } from '@angular/router';
import { Setup } from '../Pages/Setup/setup';
import { GameBoard } from '../Pages/GameBoard/game-board';

export const routes: Routes = [
    { path: '', component: Setup },
    { path: 'game', component: GameBoard },
    { path: '**', redirectTo: '', pathMatch: 'full' }
];
