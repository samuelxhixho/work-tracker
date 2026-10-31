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
import {MascotHost} from './mascot/components/mascot-host/mascot-host';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MusicDock,
    MascotHost
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly musicSession = inject(MusicSessionService);
}
