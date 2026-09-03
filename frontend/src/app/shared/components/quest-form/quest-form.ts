import {
  Component,
  HostListener,
  OnInit,
  inject,
  input,
  output,
  signal
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { TaskService } from '../../../core/services/task.service';

import {
  CreateTaskRequest,
  Task,
  TaskCategory,
  TaskStatus,
  UpdateTaskRequest
} from '../../../tasks/task.model';

@Component({
  selector: 'app-quest-form',
  standalone: true,
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './quest-form.html',
  styleUrl: './quest-form.scss'
})
export class QuestFormComponent implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly formBuilder = inject(FormBuilder);

  readonly task = input<Task | null>(null);

  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly saving = signal(false);
  readonly saveError = signal(false);

  readonly taskForm = this.formBuilder.nonNullable.group({
    title: ['', [
      Validators.required,
      Validators.maxLength(200)
    ]],

    description: [''],

    category: [
      'FRONTEND' as TaskCategory,
      Validators.required
    ],

    status: [
      'IN_PROGRESS' as TaskStatus,
      Validators.required
    ],

    workDate: [
      this.toLocalDateString(new Date()),
      Validators.required
    ]
  });

  ngOnInit(): void {
    const task = this.task();

    if (task) {
      this.taskForm.reset({
        title: task.title,
        description: task.description ?? '',
        category: task.category,
        status: task.status,
        workDate: task.workDate
      });

      return;
    }

    this.taskForm.reset({
      title: '',
      description: '',
      category: 'FRONTEND',
      status: 'IN_PROGRESS',
      workDate: this.toLocalDateString(new Date())
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    if (this.saving()) {
      return;
    }

    this.closed.emit();
  }

  save(): void {
    if (
      this.taskForm.invalid ||
      this.saving()
    ) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const formValue =
      this.taskForm.getRawValue();

    const request:
      CreateTaskRequest | UpdateTaskRequest = {
      title: formValue.title.trim(),
      description:
        formValue.description.trim() || null,
      category: formValue.category,
      status: formValue.status,
      workDate: formValue.workDate
    };

    this.saving.set(true);
    this.saveError.set(false);

    const task = this.task();

    const request$ = task
      ? this.taskService.updateTask(
        task.id,
        request
      )
      : this.taskService.createTask(request);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },

      error: error => {
        console.error(
          'Failed to save quest',
          error
        );

        this.saving.set(false);
        this.saveError.set(true);
      }
    });
  }

  private toLocalDateString(date: Date): string {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
