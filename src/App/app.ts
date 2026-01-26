import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GameService } from '../Services/game.service';

@Component({
  selector: '#app_root',
  imports: [RouterOutlet],
  templateUrl: './template.html'
})
export class App {
  gameService = inject(GameService);
}
