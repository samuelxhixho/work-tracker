import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  signal
} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {filter, Subscription} from 'rxjs';
import {MascotIdle} from '../mascot-idle/mascot-idle';

type Point = {x: number; y: number};
type Area = {left: number; top: number; right: number; bottom: number};

const GAP = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isClear(
  point: Point,
  width: number,
  height: number,
  obstacles: Area[]
): boolean {
  return obstacles.every(rect =>
    point.x + width <= rect.left ||
    point.x >= rect.right ||
    point.y + height <= rect.top ||
    point.y >= rect.bottom
  );
}

@Component({
  selector: 'app-mascot-host',
  standalone: true,
  imports: [MascotIdle],
  templateUrl: './mascot-host.html',
  styleUrl: './mascot-host.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.transform]': 'translation()',
    '[style.visibility]': 'noRoom() ? "hidden" : null',
    '[attr.inert]': 'noRoom() ? "" : null',
    '[class.teleport-out]': 'teleportPhase() === "out"',
    '[class.teleport-in]': 'teleportPhase() === "in"',
    '[class.note-on-left]': 'noteOnLeft()',
  }
})
export class MascotHost implements AfterViewInit, OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);

  readonly noteOpen = signal(false);
  readonly noteOnLeft = signal(false);
  readonly noRoom = signal(false);

  readonly teleportPhase = signal<'idle' | 'out' | 'in'>('idle');

  private readonly motionQuery =
    window.matchMedia('(prefers-reduced-motion: reduce)');

  private teleportTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingOffset: Point | null = null;
  private hasPlaced = false;

  private readonly offset = signal<Point>({x: 0, y: 0});

  readonly translation = computed(() => {
    const {x, y} = this.offset();
    return `translate3d(${x}px, ${y}px, 0)`;
  });

  private frame = 0;
  private destroyed = false;
  private watchedPage: HTMLElement | null = null;

  private hostObserver?: ResizeObserver;
  private pageObserver?: ResizeObserver;
  private contentObserver?: MutationObserver;
  private routeSubscription?: Subscription;

  private readonly schedule = (): void => {
    if (this.frame || this.destroyed) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.placeMascot();
      });
    });
  };

  private readonly onScroll = (): void => {
    if (this.noteOpen()) {
      this.zone.run(() => this.noteOpen.set(false));
    }

    this.schedule();
  };

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('resize', this.schedule, {passive: true});
      document.addEventListener('scroll', this.onScroll, {
        capture: true,
        passive: true
      });

      this.hostObserver = new ResizeObserver(this.schedule);
      this.hostObserver.observe(this.element.nativeElement);

      this.routeSubscription = this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          this.zone.run(() => this.noteOpen.set(false));
          this.schedule();
        });

      this.schedule();
    });
  }

  toggleNote(): void {
    this.noteOpen.update(open => !open);
  }

  closeNote(): void {
    this.noteOpen.set(false);
  }

  private syncPageObserver(): void {
    const page = document.querySelector<HTMLElement>('.quests-page');

    if (page === this.watchedPage) {
      return;
    }

    this.contentObserver?.disconnect();
    this.pageObserver?.disconnect();
    this.watchedPage = page;

    this.pageObserver = new ResizeObserver(this.schedule);

    this.contentObserver = new MutationObserver(() => {
      const dock = document.querySelector<HTMLElement>('.sidebar-music');

      if (dock) {
        this.pageObserver?.observe(dock);
      }

      this.schedule();
    });

    const sidebar = document.querySelector<HTMLElement>('.sidebar');

    if (sidebar) {
      this.contentObserver.observe(sidebar, {
        childList: true,
        subtree: true
      });

      for (const element of sidebar.querySelectorAll<HTMLElement>(
        '.brand, .navigation, .sidebar-music, .sidebar-card'
      )) {
        this.pageObserver.observe(element);
      }
    }

    if (page) {
      this.contentObserver.observe(page, {
        childList: true,
        subtree: true
      });

      this.pageObserver.observe(page);
    }
  }

  private placeMascot(): void {
    if (this.destroyed) {
      return;
    }

    this.syncPageObserver();

    const host = this.element.nativeElement;
    const rect = host.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (!width || !height) {
      return;
    }

    const style = getComputedStyle(host);

    const base: Point = {
      x: window.innerWidth - parseFloat(style.right) - width,
      y: window.innerHeight - parseFloat(style.bottom) - height
    };

    const minX = 12;
    const maxX = window.innerWidth - width - 12;

    let bottomLimit = window.innerHeight - 12;

    const mobileNav = document.querySelector<HTMLElement>(
      '.mobile-navigation'
    );

    if (mobileNav && getComputedStyle(mobileNav).display !== 'none') {
      bottomLimit = Math.min(
        bottomLimit,
        mobileNav.getBoundingClientRect().top - 12
      );
    }

    const minY = 12;
    const maxY = bottomLimit - height;

    if (maxX < minX || maxY < minY) {
      this.applyPlacement(null, base);
      return;
    }

    const bounds = {minX, maxX, minY, maxY};

    const fit = (point: Point): Point => ({
      x: clamp(point.x, minX, maxX),
      y: clamp(point.y, minY, maxY)
    });

    let preferred = fit(base);
    const offset = this.offset();

    const current = fit({
      x: base.x + offset.x,
      y: base.y + offset.y
    });

    const obstacles: Area[] = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-companion-avoid], ' +
        '.sidebar .brand, ' +
        '.sidebar .navigation, ' +
        '.sidebar .sidebar-music, ' +
        '.sidebar .sidebar-card'
      )
    )
      .map(element => element.getBoundingClientRect())
      .filter(rect =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight
      )
      .map(rect => ({
        left: rect.left - GAP,
        top: rect.top - GAP,
        right: rect.right + GAP,
        bottom: rect.bottom + GAP
      }));

    let placement = this.findPlacement(
      preferred,
      current,
      width,
      height,
      obstacles,
      bounds
    );

    if (!isClear(preferred, width, height, obstacles)) {
      const sidebar = document.querySelector<HTMLElement>('.sidebar');

      if (sidebar && sidebar.getClientRects().length > 0) {
        const dock = sidebar.querySelector<HTMLElement>('.sidebar-music');
        const card = sidebar.querySelector<HTMLElement>('.sidebar-card');

        const visibleDock =
          dock && dock.getClientRects().length > 0
            ? dock
            : null;

        const visibleCard =
          card && card.getClientRects().length > 0
            ? card
            : null;

        const anchor = visibleDock ?? visibleCard;

        if (anchor) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const anchorRect = anchor.getBoundingClientRect();

          const home: Point = {
            x: sidebarRect.left + (sidebarRect.width - width) / 2,
            y: anchorRect.top - height - 12
          };

          const fits =
            home.x >= Math.max(minX, sidebarRect.left + 8) &&
            home.x <= Math.min(maxX, sidebarRect.right - width - 8) &&
            home.y >= Math.max(minY, sidebarRect.top + 8) &&
            home.y <= Math.min(maxY, sidebarRect.bottom - height - 8);

          if (fits && isClear(home, width, height, obstacles)) {
            placement = home;
          }
        }
      }
    }

    this.applyPlacement(placement, base);
  }

  private findPlacement(
    preferred: Point,
    current: Point,
    width: number,
    height: number,
    obstacles: Area[],
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    }
  ): Point | null {
    const {minX, maxX, minY, maxY} = bounds;

    const fit = (point: Point): Point => ({
      x: clamp(point.x, minX, maxX),
      y: clamp(point.y, minY, maxY)
    });

    if (isClear(preferred, width, height, obstacles)) {
      return preferred;
    }

    const candidates: Point[] = [
      current,
      {x: minX, y: minY},
      {x: maxX, y: minY},
      {x: minX, y: maxY},
      {x: maxX, y: maxY}
    ];

    for (const rect of obstacles) {
      candidates.push(
        {x: preferred.x, y: rect.top - height},
        {x: preferred.x, y: rect.bottom},
        {x: rect.left - width, y: preferred.y},
        {x: rect.right, y: preferred.y},
        {x: rect.left - width, y: rect.top - height},
        {x: rect.left - width, y: rect.bottom},
        {x: rect.right, y: rect.top - height},
        {x: rect.right, y: rect.bottom}
      );
    }

    let best: Point | null = null;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
      const point = fit(candidate);

      if (!isClear(point, width, height, obstacles)) {
        continue;
      }

      const score = distance(point, preferred);

      if (score < bestDistance) {
        best = point;
        bestDistance = score;
      }
    }

    if (
      best &&
      isClear(current, width, height, obstacles) &&
      distance(current, preferred) <= bestDistance + 16
    ) {
      return current;
    }

    return best;
  }

  private applyPlacement(point: Point | null, base: Point): void {
    this.zone.run(() => {
      const wasHidden = this.noRoom();

      if (!point) {
        this.cancelTeleport();
        this.noteOpen.set(false);
        this.noRoom.set(true);
        this.hasPlaced = false;
        return;
      }

      this.noRoom.set(false);
      this.noteOnLeft.set(point.x < window.innerWidth / 2);

      const next: Point = {
        x: Math.round(point.x - base.x),
        y: Math.round(point.y - base.y)
      };

      const previous = this.offset();
      const same =
        previous.x === next.x &&
        previous.y === next.y;

      if (!this.hasPlaced || wasHidden || this.motionQuery.matches) {
        this.cancelTeleport();
        this.hasPlaced = true;
        this.offset.set(next);
        return;
      }

      if (this.teleportPhase() === 'out') {
        this.pendingOffset = next;
        return;
      }

      if (same) {
        return;
      }

      this.noteOpen.set(false);
      this.startTeleport(next);
    });
  }

  private startTeleport(target: Point): void {
    this.cancelTeleport();

    this.pendingOffset = target;
    this.teleportPhase.set('out');

    this.teleportTimer = setTimeout(() => {
      this.teleportTimer = null;

      if (this.destroyed || this.noRoom()) {
        return;
      }

      this.placeMascot();

      if (this.teleportPhase() !== 'out' || !this.pendingOffset) {
        return;
      }

      const destination = this.pendingOffset;
      this.pendingOffset = null;

      this.zone.run(() => {
        this.offset.set(destination);
        this.teleportPhase.set('in');
      });

      this.teleportTimer = setTimeout(() => {
        this.teleportTimer = null;

        if (this.destroyed) {
          return;
        }

        this.zone.run(() => this.teleportPhase.set('idle'));
        this.schedule();
      }, 240);
    }, 140);
  }

  private cancelTeleport(): void {
    if (this.teleportTimer !== null) {
      clearTimeout(this.teleportTimer);
      this.teleportTimer = null;
    }

    this.pendingOffset = null;
    this.teleportPhase.set('idle');
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    this.cancelTeleport();

    if (this.frame) {
      cancelAnimationFrame(this.frame);
    }

    window.removeEventListener('resize', this.schedule);
    document.removeEventListener('scroll', this.onScroll, true);

    this.hostObserver?.disconnect();
    this.pageObserver?.disconnect();
    this.contentObserver?.disconnect();
    this.routeSubscription?.unsubscribe();
  }
}
