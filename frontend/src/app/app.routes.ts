import {
  Routes
} from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(
        './pages/dashboard/dashboard'
        )
        .then(
          component =>
            component.Dashboard
        )
  },
  {
    path: 'quests',
    loadComponent: () =>
      import(
        './pages/quests/quests'
        )
        .then(
          component =>
            component.Quests
        )
  },
  {
    path: 'weekly-log',
    loadComponent: () =>
      import(
        './pages/weekly-log/weekly-log'
        )
        .then(
          component =>
            component.WeeklyLog
        )
  },
  {
    path: 'history',
    loadComponent: () =>
      import(
        './pages/history/history'
        )
        .then(
          component =>
            component.History
        )
  },
  {
    path: 'settings',
    loadComponent: () =>
      import(
        './pages/settings/settings'
        )
        .then(
          component =>
            component.Settings
        )
  },
  {
    path: '**',
    redirectTo: ''
  }
];
