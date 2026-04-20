import { isSameMonth } from 'date-fns';

import type { DayEvents } from './hebrewDate';
import {
  formatParshaDisplayHe,
  formatYmdJerusalem,
  hebrewTitleLooksLikeParshaLine,
  getGregorianDayMonthJerusalem,
  getHebrewDayAndMonth,
  getHebrewDayGematriya,
  getIsoWeekdaySun0Jerusalem,
  isErevPesachGregorian,
  isErevSheviShelPesachGregorian,
  isPesachIGregorian,
  isRoshHashanaHolidayTitleHe,
  isSheviShelPesachGregorian,
  isYomKippurHolidayTitleHe,
} from './hebrewDate';
import { getJerusalemDstTransitionLabel } from './jerusalemDst';

/** One cell in the month grid: data only (no React). */
export type CalendarDayMeta = {
  g: Date;
  gKey: string;
  gDay: number;
  gMonth: number;
  hebDay: string;
  hebMonth: string;
  isToday: boolean;
  isShabbat: boolean;
  isEventDay: boolean;
  inMonth: boolean;
  titles: string[];
  candleLightingJer?: string;
  candleLightingTA?: string;
  havdalahJer?: string;
  havdalahTA?: string;
  parshaHe?: string;
  fastBeginsJer?: string;
  fastEndsJer?: string;
  fastBeginsTA?: string;
  fastEndsTA?: string;
  fastNameHe?: string;
  dstTransitionLabel?: string;
};

export function buildCalendarDayMetas(input: {
  viewDate: Date;
  gridDays: Date[];
  dayEventsJer: Map<string, DayEvents>;
  dayEventsTA: Map<string, DayEvents>;
  /** yyyy-MM-dd (Jerusalem civil), same scheme as gKey */
  todayKey: string;
}): CalendarDayMeta[] {
  const { viewDate, gridDays, dayEventsJer, dayEventsTA, todayKey } = input;
  const metas: CalendarDayMeta[] = [];

  for (const g of gridDays) {
    const gKey = formatYmdJerusalem(g);
    const { month: gMonth, day: gDay } = getGregorianDayMonthJerusalem(g);
    const evJer = dayEventsJer.get(gKey);
    const evTA = dayEventsTA.get(gKey);
    const titlesRaw = evJer?.titles ?? [];
    const parshaNormalized = formatParshaDisplayHe(evJer?.parshaHe);
    const titles = titlesRaw.filter((t: string) => {
      if (!parshaNormalized) return true;
      if (!hebrewTitleLooksLikeParshaLine(t)) return true;
      return formatParshaDisplayHe(t ?? '') !== parshaNormalized;
    });

    const fastNameHe = evJer?.fastNameHe;
    const isErevPesach = isErevPesachGregorian(g);
    const isErevSheviShelPesach = isErevSheviShelPesachGregorian(g);
    const isPesachI = isPesachIGregorian(g);
    const isSheviShelPesach = isSheviShelPesachGregorian(g);
    const isRhPanelDay = isRoshHashanaHolidayTitleHe(titles);
    const isYkPanelDay = isYomKippurHolidayTitleHe(titles);
    const isFriday = getIsoWeekdaySun0Jerusalem(g) === 5;

    const inMonth = isSameMonth(g, viewDate);

    metas.push({
      g,
      gKey,
      gDay,
      gMonth,
      hebDay: getHebrewDayGematriya(g),
      hebMonth: getHebrewDayAndMonth(g).month,
      isToday: gKey === todayKey,
      isShabbat: getIsoWeekdaySun0Jerusalem(g) === 6,
      isEventDay: titles.length > 0,
      inMonth,
      titles,
      candleLightingJer:
        isFriday ||
        isErevPesach ||
        isErevSheviShelPesach ||
        isRhPanelDay ||
        isYkPanelDay
          ? evJer?.candleLighting
          : undefined,
      candleLightingTA:
        isFriday ||
        isErevPesach ||
        isErevSheviShelPesach ||
        isRhPanelDay ||
        isYkPanelDay
          ? evTA?.candleLighting
          : undefined,
      havdalahJer:
        getIsoWeekdaySun0Jerusalem(g) === 6 ||
        isPesachI ||
        isSheviShelPesach ||
        isRhPanelDay ||
        isYkPanelDay
          ? evJer?.havdalah
          : undefined,
      havdalahTA:
        getIsoWeekdaySun0Jerusalem(g) === 6 ||
        isPesachI ||
        isSheviShelPesach ||
        isRhPanelDay ||
        isYkPanelDay
          ? evTA?.havdalah
          : undefined,
      parshaHe: evJer?.parshaHe,
      fastBeginsJer: isErevPesach || isErevSheviShelPesach ? undefined : evJer?.fastBegins,
      fastEndsJer: evJer?.fastEnds,
      fastBeginsTA: isErevPesach || isErevSheviShelPesach ? undefined : evTA?.fastBegins,
      fastEndsTA: evTA?.fastEnds,
      fastNameHe,
      dstTransitionLabel: getJerusalemDstTransitionLabel(gKey) ?? undefined,
    });
  }

  return metas;
}
