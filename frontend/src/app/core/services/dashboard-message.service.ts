import {inject, Injectable} from '@angular/core';

import {HttpClient} from '@angular/common/http';

import {catchError, map, Observable, of, shareReplay} from 'rxjs';

export type DashboardMessageSlot =
  | 'GREETING'
  | 'HERO_TITLE'
  | 'HERO_BODY'
  | 'FOCUS_QUOTE'
  | 'SCENE_KICKER'
  | 'SCENE_CAPTION';

export type DashboardMessageState =
  | 'ANY'
  | 'NO_WORK'
  | 'LIGHT'
  | 'STEADY'
  | 'STRONG'
  | 'COMPLETE'
  | 'BLOCKED';

export type DashboardMessagePeriod =
  | 'ANY'
  | 'MORNING'
  | 'AFTERNOON'
  | 'EVENING'
  | 'NIGHT';

export interface DashboardMessage {
  id: string;
  slot: DashboardMessageSlot;
  state: DashboardMessageState;
  period: DashboardMessagePeriod;
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardMessageService {
  private readonly http = inject(HttpClient);

  private readonly messages$ =
    this.http
      .get(
        'data/dashboard-messages.csv',
        {
          responseType: 'text'
        }
      )
      .pipe(
        map(csv =>
          this.parseCsv(csv)
        ),

        catchError(error => {
          console.error(
            'Failed to load dashboard messages',
            error
          );

          return of([]);
        }),

        shareReplay({
          bufferSize: 1,
          refCount: false
        })
      );

  getMessages():
    Observable<DashboardMessage[]> {
    return this.messages$;
  }

  pickMessage(
    messages: DashboardMessage[],
    slot: DashboardMessageSlot,
    state: DashboardMessageState,
    period: DashboardMessagePeriod
  ): DashboardMessage | null {
    const exactStateAndPeriod =
      messages.filter(message =>
        message.slot === slot &&
        message.state === state &&
        message.period === period
      );

    if (exactStateAndPeriod.length > 0) {
      return this.randomFrom(
        exactStateAndPeriod
      );
    }

    const exactState =
      messages.filter(message =>
        message.slot === slot &&
        message.state === state &&
        message.period === 'ANY'
      );

    if (exactState.length > 0) {
      return this.randomFrom(
        exactState
      );
    }

    const exactPeriod =
      messages.filter(message =>
        message.slot === slot &&
        message.state === 'ANY' &&
        message.period === period
      );

    if (exactPeriod.length > 0) {
      return this.randomFrom(
        exactPeriod
      );
    }

    const fallback =
      messages.filter(message =>
        message.slot === slot &&
        message.state === 'ANY' &&
        message.period === 'ANY'
      );

    if (fallback.length > 0) {
      return this.randomFrom(
        fallback
      );
    }

    return null;
  }

  private randomFrom(
    messages: DashboardMessage[]
  ): DashboardMessage {
    const index =
      Math.floor(
        Math.random() *
        messages.length
      );

    return messages[index];
  }

  private parseCsv(
    csv: string
  ): DashboardMessage[] {
    const cleanCsv =
      csv.replace(
        /^\uFEFF/,
        ''
      );

    const lines =
      cleanCsv
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (lines.length <= 1) {
      return [];
    }

    return lines
      .slice(1)
      .map(line =>
        this.parseMessageRow(line)
      )
      .filter(
        (
          message
        ): message is DashboardMessage =>
          message !== null
      );
  }

  private parseMessageRow(
    line: string
  ): DashboardMessage | null {
    const values =
      this.parseCsvLine(line);

    if (values.length < 5) {
      return null;
    }

    const [
      id,
      rawSlot,
      rawState,
      rawPeriod,
      ...textParts
    ] = values;

    const slot =
      rawSlot as DashboardMessageSlot;

    const state =
      rawState as DashboardMessageState;

    const period =
      rawPeriod as DashboardMessagePeriod;

    const text =
      textParts
        .join(',')
        .trim();

    if (
      !id ||
      !text ||
      !this.isValidSlot(slot) ||
      !this.isValidState(state) ||
      !this.isValidPeriod(period)
    ) {
      return null;
    }

    return {
      id,
      slot,
      state,
      period,
      text
    };
  }

  private parseCsvLine(
    line: string
  ): string[] {
    const values: string[] = [];

    let current = '';
    let insideQuotes = false;

    for (
      let index = 0;
      index < line.length;
      index++
    ) {
      const character =
        line[index];

      if (character === '"') {
        const nextCharacter =
          line[index + 1];

        if (
          insideQuotes &&
          nextCharacter === '"'
        ) {
          current += '"';
          index++;

          continue;
        }

        insideQuotes =
          !insideQuotes;

        continue;
      }

      if (
        character === ',' &&
        !insideQuotes
      ) {
        values.push(
          current.trim()
        );

        current = '';

        continue;
      }

      current += character;
    }

    values.push(
      current.trim()
    );

    return values;
  }

  private isValidSlot(
    slot: DashboardMessageSlot
  ): boolean {
    return [
      'GREETING',
      'HERO_TITLE',
      'HERO_BODY',
      'FOCUS_QUOTE',
      'SCENE_KICKER',
      'SCENE_CAPTION'
    ].includes(slot);
  }

  private isValidState(
    state: DashboardMessageState
  ): boolean {
    return [
      'ANY',
      'NO_WORK',
      'LIGHT',
      'STEADY',
      'STRONG',
      'COMPLETE',
      'BLOCKED'
    ].includes(state);
  }

  private isValidPeriod(
    period: DashboardMessagePeriod
  ): boolean {
    return [
      'ANY',
      'MORNING',
      'AFTERNOON',
      'EVENING',
      'NIGHT'
    ].includes(period);
  }
}
