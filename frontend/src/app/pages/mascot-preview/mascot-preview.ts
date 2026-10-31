import { Component } from '@angular/core';
import { MascotIdle } from '../../mascot/components/mascot-idle/mascot-idle';

@Component({
  selector: 'app-mascot-preview',
  standalone: true,
  imports: [MascotIdle],
  template: `
    <section class="mascot-preview">
      <span class="section-kicker">MASCOT PREVIEW</span>
      <h1>Our night owl.</h1>
      <p>Idle animation test. No application state is connected yet.</p>
      <div class="mascot-preview-stage">
        <app-mascot-idle />
      </div>
    </section>
  `,
  styles: [`
    .mascot-preview { max-width: 900px; margin: 0 auto; }
    .mascot-preview h1 { margin: 12px 0; }
    .mascot-preview p { color: #a9b4bf; }
    .mascot-preview-stage {
      display: flex;
      justify-content: center;
      padding: 32px 16px;
      margin-top: 24px;
      border: 1px solid #273849;
      border-radius: 16px;
      background: #101c29;
    }
    app-mascot-idle { max-width: 272px; }
  `]
})
export class MascotPreview {}
