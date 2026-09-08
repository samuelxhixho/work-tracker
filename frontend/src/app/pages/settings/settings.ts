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
