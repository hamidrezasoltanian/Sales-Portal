'use strict';
// ── Jalali date utilities ─────────────────────────────────────────────────────
// Extracted from app.js. Depends on: nothing (pure math).

// ════════════════════════ JALALI ════════════════════════
function g2j(gy,gm,gd){var g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];var gy2=(gm>2)?(gy+1):gy;var days=355666+(365*gy)+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)+gd+g_d_m[gm-1];var jy=-1595+(33*Math.floor(days/12053));days%=12053;jy+=4*Math.floor(days/1461);days%=1461;if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}var jm=(days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30);var jd=1+((days<186)?(days%31):((days-186)%30));return[jy,jm,jd];}
function j2g(jy,jm,jd){var jy2=jy+1595;var days=-355668+(365*jy2)+(Math.floor(jy2/33)*8)+Math.floor(((jy2%33)+3)/4)+jd+((jm<7)?(jm-1)*31:((jm-7)*30)+186);var gy=400*Math.floor(days/146097);days%=146097;if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++;}gy+=4*Math.floor(days/1461);days%=1461;if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365;}var gd=days+1;var sal_a=[0,31,((gy%4===0&&gy%100!==0)||(gy%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];var gm=0;for(;gm<13&&gd>sal_a[gm];gm++)gd-=sal_a[gm];return[gy,gm,gd];}
function todayJ(){var d=new Date();return g2j(d.getFullYear(),d.getMonth()+1,d.getDate());}
function todayStr(){var t=todayJ();return t[0]+'/'+p2(t[1])+'/'+p2(t[2]);}
function jDays(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return(((((jy-474)%2820)+474+38)*682)%2816<682)?30:29;}
function jDow(jy,jm,jd){var g=j2g(jy,jm,jd);return(new Date(g[0],g[1]-1,g[2]).getDay()+1)%7;}
function p2(n){return n<10?'0'+n:String(n);}
function jMs(jy,jm,jd){var g=j2g(jy,jm,jd);return new Date(g[0],g[1]-1,g[2]).getTime();}
function msToJ(ms){if(!ms)return'';var d=new Date(ms);var j=g2j(d.getFullYear(),d.getMonth()+1,d.getDate());return j[0]+'/'+p2(j[1])+'/'+p2(j[2]);}
function jAdd(jy,jm,jd,n){var g=j2g(jy,jm,jd);var d=new Date(g[0],g[1]-1,g[2]+n);return g2j(d.getFullYear(),d.getMonth()+1,d.getDate());}
function wkStart(jy,jm,jd){var dow=jDow(jy,jm,jd);var g=j2g(jy,jm,jd);var d=new Date(g[0],g[1]-1,g[2]-dow);return g2j(d.getFullYear(),d.getMonth()+1,d.getDate());}
