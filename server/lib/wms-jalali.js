'use strict';

function p2(n) { return n < 10 ? '0' + n : String(n); }

function g2j(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
    + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

function j2g(jy, jm, jd) {
  let jy2 = jy + 1595;
  let days = -355668 + (365 * jy2) + (Math.floor(jy2 / 33) * 8) + Math.floor(((jy2 % 33) + 3) / 4) + jd
    + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return [gy, gm, gd];
}

function jDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return (((((jy - 474) % 2820) + 474 + 38) * 682) % 2816 < 682) ? 30 : 29;
}

function parseJalali(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.replace(/-/g, '/').split('/');
  if (parts.length < 3) return null;
  const jy = parseInt(parts[0], 10);
  const jm = parseInt(parts[1], 10);
  const jd = parseInt(parts[2], 10);
  if (!jy || !jm || !jd) return null;
  return [jy, jm, jd];
}

function jalaliToDate(str) {
  const j = parseJalali(str);
  if (!j) return null;
  const g = j2g(j[0], j[1], j[2]);
  return new Date(Date.UTC(g[0], g[1] - 1, g[2], 12, 0, 0));
}

function dateToJalali(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const j = g2j(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  return j[0] + '/' + p2(j[1]) + '/' + p2(j[2]);
}

function fiscalYearBounds(jy) {
  const startG = j2g(jy, 1, 1);
  const endJd = jDays(jy, 12);
  const endG = j2g(jy, 12, endJd);
  const start = new Date(Date.UTC(startG[0], startG[1] - 1, startG[2], 0, 0, 0));
  const end = new Date(Date.UTC(endG[0], endG[1] - 1, endG[2], 23, 59, 59));
  return { start, end, startJalali: jy + '/01/01', endJalali: jy + '/12/' + p2(endJd) };
}

function currentJalaliYear() {
  const now = new Date();
  return g2j(now.getFullYear(), now.getMonth() + 1, now.getDate())[0];
}

module.exports = {
  g2j, j2g, jDays, p2, parseJalali, jalaliToDate, dateToJalali, fiscalYearBounds, currentJalaliYear,
};
