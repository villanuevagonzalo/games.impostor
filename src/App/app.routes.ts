import { Routes } from '@angular/router';
import { Setup } from '../Components/setup/setup';
import { GameBoard } from '../Components/game-board/game-board';

export const routes: Routes = [
    { path: '', component: Setup },
    { path: 'game', component: GameBoard },
    { path: '**', redirectTo: '', pathMatch: 'full' }
];
