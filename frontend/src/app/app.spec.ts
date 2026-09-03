import {
  TestBed
} from '@angular/core/testing';

import {
  provideRouter
} from '@angular/router';

import {
  App
} from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed
      .configureTestingModule({
        imports: [
          App
        ],
        providers: [
          provideRouter([])
        ]
      })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture =
      TestBed.createComponent(App);

    expect(
      fixture.componentInstance
    ).toBeTruthy();
  });

  it('should render WorkTracker branding', () => {
    const fixture =
      TestBed.createComponent(App);

    fixture.detectChanges();

    const compiled: HTMLElement =
      fixture.nativeElement;

    expect(
      compiled
        .querySelector('.brand-name')
        ?.textContent
        ?.trim()
    ).toBe('WorkTracker');
  });

  it('should render the main navigation', () => {
    const fixture =
      TestBed.createComponent(App);

    fixture.detectChanges();

    const compiled: HTMLElement =
      fixture.nativeElement;

    const navigationItems =
      compiled.querySelectorAll(
        '.navigation .nav-item'
      );

    expect(
      navigationItems.length
    ).toBe(5);
  });
});
