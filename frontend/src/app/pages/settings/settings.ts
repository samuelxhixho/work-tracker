import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  SettingsService
} from '../../settings/settings.service';

import {
  UpdateSettingsRequest
} from '../../settings/settings.model';

import {
  MascotAnimationService
} from '../../mascot/services/mascot-animation.service';

interface WorkTrackerDesktopBridge {
  setupLocalAi(): Promise<{
    ollamaRunning: boolean;
    modelInstalled: boolean;
  }>;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings implements OnInit, OnDestroy {
  private readonly settingsService =
    inject(SettingsService);

  private readonly formBuilder =
    inject(FormBuilder);

  private readonly mascotAnimation =
    inject(MascotAnimationService);

  private finishSettingsThinking: (() => void) | null = null;

  readonly loading =
    signal(true);

  readonly loadError =
    signal(false);

  readonly saving =
    signal(false);

  readonly saveError =
    signal(false);

  readonly saved =
    signal(false);

  readonly aiSetupBusy = signal(false);
  readonly aiSetupMessage = signal('');
  readonly aiSetupError = signal(false);

  readonly aiSetupAvailable = Boolean(
    (window as Window & {
      workTrackerDesktop?: WorkTrackerDesktopBridge;
    }).workTrackerDesktop
  );

  readonly settingsForm =
    this.formBuilder.nonNullable.group({
      displayName: [
        '',
        [
          Validators.required,
          Validators.maxLength(80)
        ]
      ],

      contextualMessagesEnabled: [
        true
      ]
    });

  ngOnInit(): void {
    this.finishSettingsThinking =
      this.mascotAnimation.beginThinking();

    this.loadSettings();
  }

  save(): void {
    if (
      this.settingsForm.invalid ||
      this.saving()
    ) {
      this.settingsForm
        .markAllAsTouched();

      return;
    }

    const value =
      this.settingsForm
        .getRawValue();

    const request:
      UpdateSettingsRequest = {
      displayName:
        value.displayName.trim(),

      contextualMessagesEnabled:
      value.contextualMessagesEnabled
    };

    this.saving.set(true);
    this.saveError.set(false);
    this.saved.set(false);

    this.settingsService
      .updateSettings(request)
      .subscribe({
        next: settings => {
          this.settingsForm.patchValue({
            displayName:
            settings.displayName,

            contextualMessagesEnabled:
            settings
              .contextualMessagesEnabled
          });

          this.saving.set(false);
          this.saved.set(true);
          this.stopThinking();
        },

        error: error => {
          console.error(
            'Failed to save settings',
            error
          );

          this.saving.set(false);
          this.saveError.set(true);
        }
      });
  }

  async setupLocalAi(): Promise<void> {
    const bridge = (window as Window & {
      workTrackerDesktop?: WorkTrackerDesktopBridge;
    }).workTrackerDesktop;

    if (!bridge || this.aiSetupBusy()) {
      return;
    }

    this.aiSetupBusy.set(true);
    this.aiSetupMessage.set('');
    this.aiSetupError.set(false);

    try {
      const status = await bridge.setupLocalAi();

      if (status.ollamaRunning && status.modelInstalled) {
        this.aiSetupMessage.set(
          'Local AI is ready. Ollama and Qwen are available.'
        );
      } else if (status.ollamaRunning) {
        this.aiSetupMessage.set(
          'Ollama is available, but the Qwen model still needs setup.'
        );
      } else {
        this.aiSetupMessage.set(
          'Ollama is not available. You can retry setup later.'
        );
      }
    } catch (error) {
      console.error('Local AI setup failed', error);

      this.aiSetupError.set(true);
      this.aiSetupMessage.set(
        'Could not complete local AI setup. Please try again.'
      );
    } finally {
      this.aiSetupBusy.set(false);
    }
  }

  private loadSettings(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.settingsService
      .getSettings()
      .subscribe({
        next: settings => {
          this.settingsForm.setValue({
            displayName:
            settings.displayName,

            contextualMessagesEnabled:
            settings
              .contextualMessagesEnabled
          });

          this.loading.set(false);
        },

        error: error => {
          console.error(
            'Failed to load settings',
            error
          );

          this.loadError.set(true);
          this.loading.set(false);
        }
      });
  }

  private stopThinking(): void {
    this.finishSettingsThinking?.();
    this.finishSettingsThinking = null;
  }

  ngOnDestroy(): void {
    this.stopThinking();
  }
}
