'use strict';

const LY = { 1399: 1, 1403: 1, 1408: 1 };
const NW = [
  [2020, 2, 20, 1399], [2021, 2, 20, 1400], [2022, 2, 21, 1401], [2023, 2, 21, 1402],
  [2024, 2, 20, 1403], [2025, 2, 20, 1404], [2026, 2, 20, 1405], [2027, 2, 21, 1406],
  [2028, 2, 20, 1407], [2029, 2, 20, 1408], [2030, 2, 20, 1409],
];

function p2(n) { return n < 10 ? '0' + n : String(n); }

function getNW(gy) {
  for (let i = NW.length - 1; i >= 0; i--) {
    if (NW[i][0] === gy) return NW[i];
  }
  return null;
}

function calcTodayJ() {
  const n = new Date();
  n.setHours(12, 0, 0, 0);
  const gy = n.getFullYear();
  const nw = getNW(gy);
  if (!nw) return '1405/03/02';
  let nd = new Date(gy, nw[1], nw[2]);
  nd.setHours(12, 0, 0, 0);
  let jy = nw[3];
  if (n < nd) {
    const p = getNW(gy - 1);
    if (!p) return '1405/03/02';
    nd = new Date(gy - 1, p[1], p[2]);
    nd.setHours(12, 0, 0, 0);
    jy = p[3];
  }
  const doy = Math.round((n - nd) / 86400000);
  const md = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, LY[jy] ? 30 : 29];
  let jm = 0;
  let rem = doy;
  while (jm < 11 && rem >= md[jm]) { rem -= md[jm]; jm++; }
  return jy + '/' + p2(jm + 1) + '/' + p2(rem + 1);
}

function j2d(s) {
  if (!s) return 0;
  const n = String(s).trim()
    .replace(/[۰-۹]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 1728); })
    .replace(/-/g, '/');
  const p = n.split('/');
  if (p.length !== 3) return 0;
  const y = +p[0]; const m = +p[1]; const d = +p[2];
  if (!y || !m || !d || y < 1300 || y > 1500) return 0;
  let md = 0;
  for (let i = 1; i < m; i++) md += i <= 6 ? 31 : i <= 11 ? 30 : 29;
  return (y - 1400) * 365 + Math.floor((y - 1400) / 4) + md + d;
}

function addDJ(jStr, days) {
  const d = j2d(jStr) + days;
  let y = 1400 + Math.floor((d - 1) / 365);
  let rem = d - (y - 1400) * 365 - Math.floor((y - 1400) / 4) - 1;
  if (rem < 0) { y--; rem = d - (y - 1400) * 365 - Math.floor((y - 1400) / 4) - 1; }
  const md = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let m = 0;
  while (m < 11 && rem >= md[m]) { rem -= md[m]; m++; }
  return y + '/' + p2(m + 1) + '/' + p2(rem + 1);
}

function urg(d) {
  if (d > 90) return { l: 'بحرانی +۹۰', c: '#dc2626', bg: '#fef2f2', bc: '#dc262633', cls: 'c4', lv: 4 };
  if (d > 60) return { l: 'تخلف ۶۰ روز', c: '#ea580c', bg: '#fff7ed', bc: '#ea580c33', cls: 'c3', lv: 3 };
  if (d > 30) return { l: 'اورژانسی', c: '#d97706', bg: '#fffbeb', bc: '#d9770633', cls: 'c2', lv: 2 };
  if (d > 0) return { l: 'پیگیری', c: '#2563eb', bg: '#eff6ff', bc: '#2563eb33', cls: 'c1', lv: 1 };
  return { l: 'جاری', c: '#16a34a', bg: '#f0fdf4', bc: '#16a34a33', cls: 'c0', lv: 0 };
}

function actTxt(d) {
  if (d > 90) return '⛔ توقف فروش + اقدام حقوقی';
  if (d > 60) return '🚨 تماس فوری مدیر + ضرب‌الاجل ۴۸ ساعته';
  if (d > 30) return '📞 تماس کارشناس + ثبت میزیتو';
  if (d > 0) return '💬 یادآوری + پیش‌فاکتور';
  return '✓ زیر نظر';
}

function enrichMtrRow(row, todayStr) {
  const today = todayStr || calcTodayJ();
  const todayDays = j2d(today);
  const due = row.due || (row.invDate ? addDJ(row.invDate, 60) : '');
  const od = due ? todayDays - j2d(due) : 0;
  const u = urg(od);
  return Object.assign({}, row, { due, od, urg: u, act: actTxt(od) });
}

function gregToJalali(date) {
  if (!date) return ['', ''];
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return ['', ''];
  const gy = d.getFullYear(); const gm = d.getMonth() + 1; const gd = d.getDate();
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4)
    - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400)
    + gd + g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  const dateStr = jy + '/' + p2(jm) + '/' + p2(jd);
  const monthStr = jy + '/' + p2(jm);
  return [dateStr, monthStr];
}

module.exports = { calcTodayJ, j2d, addDJ, urg, actTxt, enrichMtrRow, gregToJalali };
