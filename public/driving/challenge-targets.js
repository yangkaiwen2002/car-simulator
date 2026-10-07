// Historical, source-verified session benchmarks. These are not live records,
// driver telemetry or a claim that every entry is a career/all-time best.
const austria='https://www.formula1.com/en/latest/article/qualifying-report-scintillating-bottas-takes-masterful-pole-as-ferrari.9DCxyNAuIA3gywPVRvyc3';
const monza='https://www.formula1.com/en/latest/article/verstappen-beats-norris-and-piastri-to-pole-for-italian-gp-in-qualifying.7j6Ls1jDJUp67EqfCoQhiN';
const silverstone='https://www.fia.com/news/f1-hamilton-powers-pole-position-silverstone-devastating-show-speed';
const porsche='https://newsroom.porsche.com/en/motorsports/porsche-919-hybrid-evo-record-nuerburgring-nordschleife-5-minutes-19-seconds-55-timo-bernhard-15752.html';
const driver=(id,name,time,session,source)=>({id,name,time,session,source,kind:'driver'});
export const BENCHMARKS={
 redbullring:[driver('ver-2020','维斯塔潘',63.477,'2020 奥地利 GP · 排位赛个人最佳',austria),driver('bot-2020','博塔斯',62.939,'2020 奥地利 GP · 杆位圈',austria)],
 monza:[driver('ver-2025','维斯塔潘',78.792,'2025 意大利 GP · 杆位圈',monza),driver('nor-2025','诺里斯',78.869,'2025 意大利 GP · 排位赛个人最佳',monza),driver('ham-2025','汉密尔顿',79.124,'2025 意大利 GP · 排位赛个人最佳',monza)],
 silverstone:[driver('ver-2020','维斯塔潘',85.325,'2020 英国 GP · 排位赛个人最佳',silverstone),driver('ham-2020','汉密尔顿',84.303,'2020 英国 GP · 杆位圈',silverstone)],
 nordschleife:[driver('bellof-1983','斯特凡·贝洛夫',371.13,'1983 · Porsche 956 · 排位纪录（历史布局约 20.835 km）',porsche),driver('bernhard-2018','蒂莫·伯恩哈德',319.55,'2018 · Porsche 919 Hybrid Evo · 20.832 km 纪录尝试',porsche)],
};
const practice={redbullring:[105,85,72],monza:[140,110,92],silverstone:[155,125,100],nordschleife:[660,510,420]};
export function targetsFor(circuit){return (practice[circuit]||[]).map((time,i)=>({id:['bronze','silver','gold'][i],name:['铜牌 · 完成节奏','银牌 · 稳定提速','金牌 · 进阶挑战'][i],kind:'game',time,session:'游戏设定目标 · 非真实车手成绩'})).concat(BENCHMARKS[circuit]||[]);}
export function resolveTarget(circuit,id){const list=targetsFor(circuit);return list.find(t=>t.id===id)||list[0]||null;}
export function assessLap(lap,target){if(!lap?.valid||!Number.isFinite(lap.time)||lap.time<=0||!target)return {valid:false,achieved:false,delta:null};const delta=lap.time-target.time;return {valid:true,achieved:delta<=0,delta};}
export function earnedTargets(circuit,best){if(!Number.isFinite(best)||best<=0)return [];return targetsFor(circuit).filter(t=>best<=t.time).map(t=>t.id);}
