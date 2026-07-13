'use strict';

function p2(n) { return n < 10 ? '0' + n : String(n); }

function g2j(gy, gm, gd) {
  var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var gy2 = (gm > 2) ? (gy + 1) : gy;
  var days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  var jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  var jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

function j2g(jy, jm, jd) {
  var jy2 = jy + 1595;
  var days = -355668 + (365 * jy2) + (Math.floor(jy2 / 33) * 8) + Math.floor(((jy2 % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  var gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  var gd = days + 1;
  var sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var gm = 0;
  for (; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return [gy, gm, gd];
}

function jAdd(jy, jm, jd, n) {
  var g = j2g(jy, jm, jd);
  var d = new Date(g[0], g[1] - 1, g[2] + n, 12);
  return g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function todayJalaliStr() {
  var d = new Date();
  var j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return j[0] + '/' + p2(j[1]) + '/' + p2(j[2]);
}

function parseJalali(str) {
  if (!str) return null;
  var p = String(str).trim().split('/');
  if (p.length < 3) return null;
  return [parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10)];
}

function formatJalali(j) {
  if (!j) return '';
  return j[0] + '/' + p2(j[1]) + '/' + p2(j[2]);
}

function addJalaliDays(jalaliStr, days) {
  var j = parseJalali(jalaliStr);
  if (!j) return '';
  return formatJalali(jAdd(j[0], j[1], j[2], days));
}

function compareJalali(a, b) {
  return String(a || '').localeCompare(String(b || ''));
}

module.exports = {
  g2j, j2g, jAdd, p2, todayJalaliStr, parseJalali, formatJalali, addJalaliDays, compareJalali,
};
