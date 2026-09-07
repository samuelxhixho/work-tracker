import {
  Component
} from '@angular/core';

import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import {inject} from '@angular/core';
import {MusicDock} from './pages/chill-room/components/music-dock/music-dock';
import {MusicSessionService} from './pages/chill-room/services/music-session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MusicDock
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly musicSession = inject(MusicSessionService);
}
