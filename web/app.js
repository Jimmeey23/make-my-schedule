// ============================================================
// CONSTANTS
// ============================================================
const DAY_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const LOC_SHORT = {
  "Kwality House, Kemps Corner":"Kwality House",
  "Supreme HQ, Bandra":"Supreme HQ",
  "Kenkere House":"Kenkere House",
  "Courtside":"Courtside",
  "Copper & Cloves":"Copper & Cloves"
};
const LOC_ABBR = {
  "Kwality House, Kemps Corner":"KW",
  "Supreme HQ, Bandra":"SU",
  "Kenkere House":"KE",
  "Courtside":"CS",
  "Copper & Cloves":"CC"
};
const LOC_COLOR = {
  "Kwality House, Kemps Corner":"#1E40AF",
  "Supreme HQ, Bandra":"#7C3AED",
  "Kenkere House":"#15803D",
  "Courtside":"#0F766E",
  "Copper & Cloves":"#B45309"
};
const LOC_LIGHT = {
  "Kwality House, Kemps Corner":"#EFF6FF",
  "Supreme HQ, Bandra":"#F5F3FF",
  "Kenkere House":"#F0FDF4",
  "Courtside":"#ECFDF5",
  "Copper & Cloves":"#FFF7ED"
};
const FAM_COLOR = {
  barre:"#7C3AED",powercycle:"#DC2626",strength_lab:"#1D4ED8",
  recovery:"#059669",foundations:"#D97706",mat_57:"#0284C7",
  hiit:"#DB2777",default:"#6B7280"
};
const FAM_BG = {
  barre:"#F5F3FF",powercycle:"#FEF2F2",strength_lab:"#EFF6FF",
  recovery:"#F0FDF4",foundations:"#FFFBEB",mat_57:"#F0F9FF",
  hiit:"#FDF2F8",default:"#F9FAFB"
};
const SCHEDULER_ADMIN_TOKEN_KEY = "scheduler_admin_token";

function schedulerAdminToken(){
  try{return localStorage.getItem(SCHEDULER_ADMIN_TOKEN_KEY)||"";}catch(_){return"";}
}

function schedulerSetAdminToken(token){
  try{
    const clean=String(token||"").trim();
    if(clean)localStorage.setItem(SCHEDULER_ADMIN_TOKEN_KEY,clean);
  }catch(_){}
}

async function schedulerFetch(url,options={}){
  const opts={...options};
  const headers=new Headers(opts.headers||{});
  if(typeof collaborationAuthToken==="function"){
    const accessToken=await collaborationAuthToken();
    if(accessToken)headers.set("Authorization",`Bearer ${accessToken}`);
  }
  const token=schedulerAdminToken();
  if(token)headers.set("X-Scheduler-Admin-Token",token);
  opts.headers=headers;
  const resp=await fetch(url,opts);
  if(resp.status!==401)return resp;

  let error="";
  try{error=String((await resp.clone().json()).error||"");}catch(_){}
  if(!/admin token required/i.test(error))return resp;

  const entered=window.prompt("Admin token required. Enter the Scheduler admin token for this browser:");
  if(!entered)return resp;
  schedulerSetAdminToken(entered);
  const retryHeaders=new Headers(opts.headers||{});
  retryHeaders.set("X-Scheduler-Admin-Token",String(entered).trim());
  return fetch(url,{...opts,headers:retryHeaders});
}
// Timeline groups variants into shared visual families.
const TIMELINE_GROUP_COLOR = {
  strength_lab:"#2563EB",
  express:"#0EA5E9",
  full:"#7C3AED",
  powercycle:"#EF4444",
  cardio:"#DB2777",
  mat:"#0891B2",
  recovery:"#059669",
  foundations:"#D97706",
  hiit:"#BE185D",
  special:"#64748B",
  manual:"#475569",
};
function timelineGroup(cn){
  const l=String(cn||"").toLowerCase();
  if(l.includes("strength lab"))return"strength_lab";
  if(l.includes("express")||l.includes("sweat in 30"))return"express";
  if(l.includes("powercycle")||l.includes("power cycle"))return"powercycle";
  if(l.includes("cardio"))return"cardio";
  if(l.includes("mat 57"))return"mat";
  if(l.includes("recovery"))return"recovery";
  if(l.includes("foundation"))return"foundations";
  if(l.includes("hiit"))return"hiit";
  if(l.includes("trainer")||l.includes("hosted"))return"special";
  return"full";
}
function timelineGroupLabel(k){
  return{strength_lab:"Strength Lab",express:"Express",full:"Full Classes",powercycle:"PowerCycle",cardio:"Cardio",mat:"Mat",recovery:"Recovery",foundations:"Foundations",hiit:"HIIT",special:"Special",manual:"Manual"}[k]||k;
}
function classLevel(cn){
  const n=(cn||"").toLowerCase();
  if(/strength lab|amped up|trainer'?s choice|hiit/.test(n))return"advanced";
  if(/barre 57|recovery|powercycle/.test(n))return"beginner";
  return"intermediate";
}
const LEVEL_LABEL={beginner:"Beginner",intermediate:"Intermediate",advanced:"Advanced"};
const LEVEL_COLOR={beginner:"#22C55E",intermediate:"#F59E0B",advanced:"#EF4444"};
function timelineColor(s){
  if(s&&((recGroup(s.recommendation)==="MANUAL")||s.manual_added||s.manual_moved))return TIMELINE_GROUP_COLOR.manual;
  return TIMELINE_GROUP_COLOR[timelineGroup(s?.class_name)]||TIMELINE_GROUP_COLOR.full;
}

// Unique color per class type for non-timeline surfaces.
const CLASS_COLOR = {
  "Studio Barre 57":          "#6D28D9",
  "Studio Barre 57 Express":  "#8B5CF6",
  "Studio Cardio Barre":      "#BE185D",
  "Studio Cardio Barre Express":"#EC4899",
  "Studio Cardio Barre Plus": "#F472B6",
  "Studio Mat 57":            "#0284C7",
  "Studio Mat 57 Express":    "#38BDF8",
  "Studio PowerCycle":        "#DC2626",
  "Studio PowerCycle Express":"#F97316",
  "Studio Strength Lab":      "#1D4ED8",
  "Studio Strength Lab (Push)":"#2563EB",
  "Studio Strength Lab (Pull)":"#1E40AF",
  "Studio Strength Lab (Full Body)":"#1E3A8A",
  "Studio Back Body Blaze":   "#D97706",
  "Studio Back Body Blaze Express":"#F59E0B",
  "Studio FIT":               "#16A34A",
  "Studio Recovery":          "#059669",
  "Studio Foundations":       "#92400E",
  "Studio Amped Up!":         "#EA580C",
  "Studio HIIT":              "#DB2777",
  "Studio SWEAT In 30":       "#7C3AED",
  "Studio Trainer's Choice":  "#64748B",
  "Studio Power Barre":       "#9333EA",
  "Studio Dance Cardio":      "#0891B2",
};
function classColor(cn){return CLASS_COLOR[cn]||FAM_COLOR[getFamily(cn)]||FAM_COLOR.default;}
const PRIME_TIMES = new Set(["08:00","08:30","09:00","09:30","10:00","10:15","11:00","11:30","17:30","17:45","18:00","18:15","19:00","19:15","19:30"]);
const REC_LIST = ["PINNED","PROTECT","EXPERIMENTAL","VARIETY","MANUAL"];
const REC_LABEL = {PINNED:"Pinned",PROTECT:"Protect",PROTECT_EXACT:"Protect",PROTECT_SLOT:"Protect",EXPERIMENTAL:"Experimental",INCLUDE:"Experimental",VARIETY:"Variety",CONSIDER:"Variety",MANUAL:"Manual",DROP:"Review"};

// ============================================================
// STATE
// ============================================================
let _loc = null;
let _view = "grid";
let _iter = "Main";
let _filtersOpen = false;
let _filterPinned = false;
let _activeLocations = new Set();
let _activeDays   = new Set(DAY_ORDER);
let _activeBands  = new Set(["morning","midday","evening"]);
let _activeRecs   = new Set(["PINNED","PROTECT","PROTECT_EXACT","PROTECT_SLOT","INCLUDE","EXPERIMENTAL","CONSIDER","VARIETY","DROP","MANUAL"]);
let _classFilter  = "";
let _trainerFilter= "";
let _roomFilter   = "";
let _minScore     = 0;
let _violOnly     = false;
let _expOnly      = false;
let _sortCol      = null;
let _sortDir      = 1;
let _historicSlotsCache = null;
let _timelineMode = "format";

// ============================================================
// HELPERS
// ============================================================
function getFamily(cn) {
  if (!cn) return "default";
  const l = cn.toLowerCase();
  if (l.includes("powercycle")||l.includes("power cycle")) return "powercycle";
  if (l.includes("strength lab")) return "strength_lab";
  if (l.includes("recovery")||l.includes("flex & flow")) return "recovery";
  if (l.includes("foundation")) return "foundations";
  if (l.includes("mat 57")) return "mat_57";
  if (l.includes("hiit")||l.includes("dance cardio")) return "hiit";
  if (l.includes("barre")||l.includes("fit")||l.includes("amped")||l.includes("back body")||l.includes("power barre")) return "barre";
  return "default";
}
function tmins(t){if(!t)return 0;const[h,m]=t.split(":").map(Number);return h*60+m}
function getDuration(cn){
  const lower=(cn||"").toLowerCase();
  if(lower.includes("express") && lower.includes("cycle")) return 30;
  if(lower.includes("cycle")) return 45;
  if(lower.includes("recovery")) return 30;
  if(lower.includes("express")) return 45;
  return 57;
}
function minsToTime(m){const h=Math.floor(m/60);const mm=m%60;return String(h).padStart(2,"0")+":"+String(mm).padStart(2,"0")}
function buildQuarterHourTimes(slots){
  const mins=[...new Set((slots||[]).map(s=>tmins(s.time)).filter(m=>Number.isFinite(m)&&m>0))].sort((a,b)=>a-b);
  if(!mins.length){
    const fallback=[];for(let m=6*60;m<=21*60;m+=15)fallback.push(minsToTime(m));
    return fallback;
  }
  const start=Math.floor(mins[0]/15)*15;
  const end=Math.ceil(mins[mins.length-1]/15)*15;
  const out=[];
  for(let m=start;m<=end;m+=15)out.push(minsToTime(m));
  mins.forEach(m=>{const t=minsToTime(m);if(!out.includes(t))out.push(t)});
  return out.sort();
}
function isPrime(t){return PRIME_TIMES.has(t)}
function isPinnedScheduleSlot(s){
  const rec=String(s?.recommendation||"").toUpperCase();
  const reason=String(s?.scheduling_reason||s?.reason||"").toLowerCase();
  return rec==="PINNED" || s?.manual_pin || s?.manual || s?.is_pinned || reason.includes("manual pin") || reason.includes("pinned");
}
function pct(v,d=0){if(v==null||isNaN(v))return"—";return(v*100).toFixed(d)+"%"}
function round1(v){return v==null?"—":v.toFixed(1)}
function fillColor(v){if(v==null)return"#9CA3AF";if(v>=0.6)return"#15803D";if(v>=0.4)return"#D97706";return"#DC2626"}
function timeBand(t){const m=tmins(t);if(m>=7*60&&m<10*60)return"morning";if(m>=10*60&&m<13*60)return"midday";return"evening"}
function displayClass(cn){return(cn||"").replace(/^Studio /,"")}
function metricSourceShortLabel(source){
  const s=String(source||"").toLowerCase();
  if(s.includes("canonical"))return"canonical";
  if(s.includes("nearby"))return"nearby";
  if(s.includes("trainer"))return"trainer";
  if(s.includes("fallback"))return"fallback";
  return s||"score";
}
function canonicalMixClass(cn){
  const l=String(cn||"").toLowerCase();
  if(l.includes("strength lab"))return"Studio Strength Lab";
  if(l.includes("back body blaze"))return"Studio Back Body Blaze";
  if(l.includes("powercycle")||l.includes("power cycle"))return"Studio PowerCycle";
  if(l.includes("cardio barre"))return"Studio Cardio Barre";
  if(l.includes("mat 57"))return"Studio Mat 57";
  if(l.includes("barre 57"))return"Studio Barre 57";
  if(l.includes("amped"))return"Studio Amped Up!";
  if(l.includes("hiit"))return"Studio HIIT";
  if(l.includes("recovery"))return"Studio Recovery";
  if(l.includes("foundation"))return"Studio Foundations";
  return cn||"Unknown";
}
const CLASS_SHORT={
  "Barre 57":"B57","Barre 57 Express":"B57E",
  "Cardio Barre":"CB","Cardio Barre Express":"CBE","Cardio Barre Plus":"CB+",
  "PowerCycle":"PCYC",
  "Strength Lab (Push)":"SL·P","Strength Lab (Pull)":"SL·L","Strength Lab (Full Body)":"SL·F",
  "Mat 57":"M57","Mat 57 Express":"M57E",
  "FIT":"FIT","SWEAT In 30":"SW30","Foundations":"FOUN",
  "Back Body Blaze":"BBB","Amped Up!":"AMP","Hosted Class":"HOST"
};
function shortClass(cn){
  const s=(cn||"").replace(/^Studio /,"");
  return CLASS_SHORT[s]||(s.split(" ").map(w=>w[0]).join("").slice(0,4).toUpperCase());
}
const REC_BLOCK={
  "PINNED":     {bg:"#15803D",stripe:"#bbf7d0"},
  "PROTECT_EXACT":{bg:"#16A34A",stripe:"#bbf7d0"},
  "PROTECT":    {bg:"#16A34A",stripe:"#bbf7d0"},
  "INCLUDE":    {bg:"#1D4ED8",stripe:"#bfdbfe"},
  "CONSIDER":   {bg:"#D97706",stripe:"#fde68a"},
  "DROP":       {bg:"#9CA3AF",stripe:"#e5e7eb"},
};
function trainerInitials(name){return(name||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
function recGroup(r){
  if(r==="PINNED")return"PINNED";
  if(r==="PROTECT_EXACT"||r==="PROTECT_SLOT"||r==="PROTECT")return"PROTECT";
  if(r==="INCLUDE"||r==="EXPERIMENTAL")return"EXPERIMENTAL";
  if(r==="CONSIDER"||r==="VARIETY"||r==="DROP")return"VARIETY";
  if(r==="MANUAL")return"MANUAL";
  return"VARIETY";
}
function recBadgeCls(r){
  const g=recGroup(r);
  return{PINNED:"bp",PROTECT:"bpe",EXPERIMENTAL:"bps",VARIETY:"bi",MANUAL:"bd"}[g]||"bd";
}
function recLabel(r){return REC_LABEL[r]||REC_LABEL[recGroup(r)]||r||"Include"}

function scoreRing(score,size=22){
  const s=score||0;
  const r=(size/2)-2;const cx=size/2;const cy=size/2;
  const circ=2*Math.PI*r;
  const fill=(s/100)*circ;
  const color=s>=70?"#15803D":s>=45?"#1D4ED8":s>=25?"#D97706":"#DC2626";
  return`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;flex-shrink:0">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2"
      stroke-dasharray="${fill.toFixed(1)} ${circ.toFixed(1)}"
      stroke-linecap="round"
      transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy+3.5}" text-anchor="middle" font-size="${size<28?6:8}" font-weight="700" fill="${color}" font-family="Inter,sans-serif">${Math.round(s)}</text>
  </svg>`;
}

function scoreBreakdownHtml(breakdown){
  if(!breakdown||!Array.isArray(breakdown.components)||!breakdown.components.length)return"";
  const rows=breakdown.components.map(c=>{
    const pts=Number(c.points||0);
    const max=Number(c.max_points||0)||1;
    const pctWidth=Math.max(0,Math.min(100,(pts/max)*100));
    const norm=c.normalized_value!=null?Number(c.normalized_value):null;
    const raw=c.raw_value;
    const rawText=typeof raw==="number"?raw.toLocaleString("en-IN",{maximumFractionDigits:2}):(raw??"—");
    const normText=norm!=null?`${Math.round(norm*100)}% of component`:"";
    return`<div class="score-component">
      <div class="score-component-top">
        <span class="score-component-label">${c.label||c.key||"Component"}</span>
        <span class="score-component-points">${pts.toFixed(1)} / ${max.toFixed(0)}</span>
      </div>
      <div class="score-component-bar"><div class="score-component-fill" style="width:${pctWidth}%"></div></div>
      <div class="score-component-meta">Raw: ${rawText}${normText?` · ${normText}`:""}<br>${c.explanation||""}</div>
    </div>`;
  }).join("");
  return`<div class="score-component-grid">${rows}</div>`;
}

function metricDefinitionsHtml(){
  const defs=[
    ["Average Attendance","Average checked-in members per class for the grouped slot. This is normalized within the studio and receives the highest score weight."],
    ["Capacity Fill Rate","Checked-in members divided by class capacity. In the current score it is used directly: 60% fill earns 60% of the fill component."],
    ["Revenue Generated","Average revenue per session for the grouped slot or trainer row, normalized within the same studio."],
    ["Number of Sessions","Historical sample size. It has the lowest weight so frequent but weak slots do not dominate stronger attendance patterns."],
    ["Blended Fill Rate","For scheduled trainer-specific rows, this is the scored fill metric carried from history. Under UniqueID scoring, grouped slots use the class-slot fill rate; trainer rows use UniqueID2 trainer fill."],
    ["Slot Trust","Confidence from historical sample size: clamp((sessions - 5) / 15, 0, 1). It is shown for context, not a major score driver in the new model."],
    ["Pinned Slot","A top-ranked UniqueID1 class/location/day/time slot with usable history. The scheduler locks the class/time, then assigns the best available trainer."],
    ["Protected Slot","A strong ranked UniqueID1 class/time slot. It is prioritized before ordinary fill, with trainer chosen from UniqueID2 ranking subject to rules."],
  ];
  return`<div class="metric-def-list">${defs.map(([k,v])=>`<div class="metric-def"><strong>${k}</strong><span>${v}</span></div>`).join("")}</div>`;
}

function sessionRowNumber(row,keys,fallback=0){
  for(const key of keys){
    const value=row?.[key];
    if(value!==undefined&&value!==null&&value!==""){
      const n=Number(value);
      if(Number.isFinite(n))return n;
    }
  }
  return fallback;
}

function sessionRowsTotals(rows){
  const safeRows=Array.isArray(rows)?rows:[];
  const totals=safeRows.reduce((acc,row)=>{
    const checked=sessionRowNumber(row,["checked_in","CheckedIn"]);
    const booked=sessionRowNumber(row,["booked","Booked"]);
    const capacity=sessionRowNumber(row,["capacity","Capacity"]);
    const cancelled=sessionRowNumber(row,["cancelled","Cancelled","cancelled_sessions","CancelledSessions"]);
    const lateCancelled=sessionRowNumber(row,["late_cancelled","LateCancelled","late_cancelled_count","LateCancelledCount"]);
    const revenue=sessionRowNumber(row,["revenue","Revenue"]);
    acc.sessions+=1;
    acc.empty+=checked>0?0:1;
    acc.checked+=checked;
    acc.booked+=booked;
    acc.capacity+=capacity;
    acc.cancelled+=cancelled;
    acc.lateCancelled+=lateCancelled;
    acc.revenue+=revenue;
    return acc;
  },{sessions:0,empty:0,checked:0,booked:0,capacity:0,cancelled:0,lateCancelled:0,revenue:0});
  totals.nonEmpty=Math.max(0,totals.sessions-totals.empty);
  totals.avgIncl=totals.sessions?totals.checked/totals.sessions:0;
  totals.avgExcl=totals.nonEmpty?totals.checked/totals.nonEmpty:0;
  totals.fillRate=totals.capacity?totals.checked/totals.capacity:0;
  totals.revMember=totals.checked?totals.revenue/totals.checked:0;
  return totals;
}

function sessionRowsTable(rows,opts={}){
  const safeRows=Array.isArray(rows)?rows:[];
  const totals=sessionRowsTotals(safeRows);
  const tableClass=opts.tableClass||"hist-modal-table";
  const emptyRow=!safeRows.length?`<tr><td colspan="18" class="hist-empty">No individual class rows were found for this ID.</td></tr>`:"";
  return`<div class="hist-sessions-wrap"><table class="${tableClass} session-rows-table">
    <thead><tr><th>Class Name</th><th>Day of Week</th><th>Time</th><th>Date</th><th>Trainer Name</th><th>Location</th><th>Capacity</th><th>Booked</th><th>Checked In</th><th>Cancelled</th><th>Late Cancelled</th><th>Total Sessions</th><th>Empty Sessions</th><th>Class Avg - Incl Empty</th><th>Class Avg - Excl Empty</th><th>Fill Rate</th><th>Revenue Generated</th><th>Rev / Member</th></tr></thead>
    <tbody>${emptyRow}${safeRows.map(x=>{
      const checked=sessionRowNumber(x,["checked_in","CheckedIn"]);
      const booked=sessionRowNumber(x,["booked","Booked"]);
      const capacity=sessionRowNumber(x,["capacity","Capacity"]);
      const cancelled=sessionRowNumber(x,["cancelled","Cancelled","cancelled_sessions","CancelledSessions"]);
      const lateCancelled=sessionRowNumber(x,["late_cancelled","LateCancelled","late_cancelled_count","LateCancelledCount"]);
      const revenue=sessionRowNumber(x,["revenue","Revenue"]);
      const rowFill=capacity?checked/capacity:sessionRowNumber(x,["fill_rate","FillRate"],0);
      const revMember=checked?revenue/checked:0;
      const empty=checked>0?0:1;
      return`<tr>
        <td>${rvEscapeHtml(displayClass(x.class||x.Class||"—"))}</td><td>${rvEscapeHtml(x.day||x.Day||"—")}</td><td>${rvEscapeHtml(x.time||x.Time||"—")}</td><td>${rvEscapeHtml(x.date||x.Date||"—")}</td>
        <td>${rvEscapeHtml(x.trainer||x.Trainer||"—")}</td><td>${rvEscapeHtml(x.location||x.Location||"—")}</td>
        <td class="num">${round1(capacity)}</td><td class="num">${round1(booked)}</td><td class="num">${round1(checked)}</td><td class="num">${round1(cancelled)}</td><td class="num">${round1(lateCancelled)}</td>
        <td class="num">1</td><td class="num">${empty}</td><td class="num">${round1(checked)}</td><td class="num">${checked>0?round1(checked):"—"}</td><td class="num">${pct(rowFill,1)}</td><td class="num">${inr(revenue,0)}</td><td class="num">${checked?inr(revMember,0):"—"}</td>
      </tr>`;
    }).join("")}</tbody>
    <tfoot><tr><td>Totals</td><td colspan="5">${safeRows.length} individual class rows</td><td class="num">${round1(totals.capacity)}</td><td class="num">${round1(totals.booked)}</td><td class="num">${round1(totals.checked)}</td><td class="num">${round1(totals.cancelled)}</td><td class="num">${round1(totals.lateCancelled)}</td><td class="num">${totals.sessions}</td><td class="num">${totals.empty}</td><td class="num">${round1(totals.avgIncl)}</td><td class="num">${totals.nonEmpty?round1(totals.avgExcl):"—"}</td><td class="num">${pct(totals.fillRate,1)}</td><td class="num">${inr(totals.revenue,0)}</td><td class="num">${totals.checked?inr(totals.revMember,0):"—"}</td></tr></tfoot>
  </table></div>`;
}

function drillSessionTableHtml(rows){
  return sessionRowsTable(rows,{tableClass:"drill-session-table"});
}

function historicDrilldownHtml(r){
  const h=r.historic_detail||{};
  const rows=[
    ["Exact sessions", r.session_count ?? h.session_rows ?? 0],
    ["Raw avg fill", pct(r.avg_fill_rate ?? h.avg_fill_rate,1)],
    ["Raw avg check-in", round1(r.avg_checkin ?? h.avg_checked_in)],
    ["Avg booked", h.avg_booked!=null?round1(h.avg_booked):"—"],
    ["Avg capacity", h.avg_capacity!=null?round1(h.avg_capacity):"—"],
    ["Avg revenue", r.avg_revenue!=null?`₹${Number(r.avg_revenue).toLocaleString("en-IN",{maximumFractionDigits:0})}`:(h.avg_revenue!=null?`₹${Number(h.avg_revenue).toLocaleString("en-IN",{maximumFractionDigits:0})}`:"—")],
    ["Total revenue", h.total_revenue!=null?`₹${Number(h.total_revenue).toLocaleString("en-IN",{maximumFractionDigits:0})}`:"—"],
    ["Late cancel", h.avg_late_cancel_rate!=null?pct(h.avg_late_cancel_rate,1):"—"],
    ["No show", h.avg_no_show_rate!=null?pct(h.avg_no_show_rate,1):"—"],
    ["Blended fill", pct(r.blended_fill,1)],
    ["Blended check-in", round1(r.blended_checkin)],
    ["Trainer sessions", r.trainer_total_sessions ?? "—"],
    ["Trainer avg check-in", round1(r.trainer_avg_ci)],
    ["Slot trust", pct(r.slot_trust,0)],
    ["Evidence depth", pct(r.longevity,0)],
    ["Studio avg fill", pct(r.studio_avg_fill,1)],
  ];
  return`<div class="hist-drill">
    <div class="hist-drill-grid">${rows.map(([label,value])=>`<div class="hist-drill-item"><div class="hist-drill-l">${label}</div><div class="hist-drill-v">${value}</div></div>`).join("")}</div>
    <div class="hist-formula">
      Score = average attendance × 75 + fill × 15 + revenue × 7 + sessions × 3. PowerCycle: fill × 50. Strength: fill × 70.
    </div>
  </div>`;
}

// ============================================================
// DATA ACCESSORS
// ============================================================
function getSlots(loc,iter){
  loc=loc||_loc; iter=iter||_iter;
  if(iter!=="Main"&&SCHEDULE_DATA.iterations&&SCHEDULE_DATA.iterations[iter]&&SCHEDULE_DATA.iterations[iter][loc])
    return SCHEDULE_DATA.iterations[iter][loc]||[];
  return(SCHEDULE_DATA.locations&&SCHEDULE_DATA.locations[loc])||[];
}
let _reasonFilter = "";
function filterSlots(slots){
  return slots.filter(s=>{
    if(_activeLocations.size&&s.location&&!_activeLocations.has(s.location))return false;
    if(!_activeDays.has(s.day_of_week))return false;
    if(!_activeBands.has(timeBand(s.time)))return false;
    const rg=recGroup(s.recommendation);
    if(!_activeRecs.has(rg))return false;
    if(_classFilter&&!s.class_name.toLowerCase().includes(_classFilter.toLowerCase()))return false;
    if(_trainerFilter&&(s.trainer_1||"").toLowerCase()!==_trainerFilter.toLowerCase())return false;
    if(_roomFilter&&(s.room||"").toLowerCase()!==_roomFilter.toLowerCase())return false;
    if(_reasonFilter&&getCanonicalSelectionReason(s)!==_reasonFilter)return false;
    if(_minScore>0&&(s.score||0)<_minScore)return false;
    if(_violOnly&&(!s.constraint_violations||s.constraint_violations.length===0))return false;
    if(_expOnly&&!s.is_experimental)return false;
    if(_primeOnly&&!isPrime(s.time))return false;
    if(_protectedOnly&&!["PINNED","PROTECT_EXACT","PROTECT","PROTECT_SLOT"].includes(s.recommendation))return false;
    if(_minFill>0&&(s.predicted_fill_rate||0)*100<_minFill)return false;
    return true;
  });
}
function getAllLocSlots(){
  const locs=allLocations();
  return locs.flatMap(l=>getSlots(l));
}
function allLocations(){
  const base=["Kwality House, Kemps Corner","Supreme HQ, Bandra","Courtside","Kenkere House","Copper & Cloves"];
  return [...new Set([...base,...Object.keys(SCHEDULE_DATA.locations||{})])];
}
function getActiveLocations(){
  const locs=allLocations();
  if(!_activeLocations.size) _activeLocations=new Set(locs);
  return locs.filter(loc=>_activeLocations.has(loc));
}
function getFilterScopeSlots(){
  const locs=(_view==="cross"||_view==="city"||_view==="analytics"||_view==="trainer"||_view==="rooms")?getActiveLocations():(_loc?[_loc]:getActiveLocations());
  return locs.flatMap(loc=>getSlots(loc));
}
function syncLocationControls(){
  document.querySelectorAll(".loc-tab").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.loc===_loc);
    btn.classList.toggle("muted",_activeLocations.size>0&&!_activeLocations.has(btn.dataset.loc));
  });
  document.querySelectorAll(".fp-location-item").forEach(btn=>{
    const loc=btn.dataset.loc;
    const on=_activeLocations.has(loc);
    btn.classList.toggle("active",on);
    btn.setAttribute("aria-pressed",on?"true":"false");
  });
}

// ============================================================
// UI BUILDERS
// ============================================================
function buildLocTabs(){
  const bar=document.getElementById("loc-bar");
  bar.innerHTML="";
  const locs=allLocations();
  if(!_activeLocations.size)_activeLocations=new Set(locs);
  const side=document.getElementById("fp-locations");
  if(side)side.innerHTML="";
  locs.forEach((loc,i)=>{
    const btn=document.createElement("button");
    btn.className="loc-tab"+(i===0?" active":"");
    btn.dataset.loc=loc;
    btn.textContent=LOC_SHORT[loc]||loc.split(",")[0];
    btn.title=loc;
    const activate=()=>{
      _loc=loc;
      if(!_activeLocations.has(loc))_activeLocations.add(loc);
      syncLocationControls();
      populateDropdowns(getFilterScopeSlots());
      renderView();
    };
    btn.onclick=activate;
    bar.appendChild(btn);
    if(i===0)_loc=loc;
    if(side){
      const sbtn=document.createElement("button");
      sbtn.className="fp-location-item active";
      sbtn.dataset.loc=loc;
      sbtn.type="button";
      sbtn.innerHTML=`<span class="fp-location-box"></span><span>${LOC_SHORT[loc]||loc.split(",")[0]}</span>`;
      sbtn.onclick=()=>{
        if(_activeLocations.has(loc)&&_activeLocations.size>1){
          _activeLocations.delete(loc);
        } else {
          _activeLocations.add(loc);
          _loc=loc;
        }
        if(!_activeLocations.has(_loc))_loc=getActiveLocations()[0]||loc;
        syncLocationControls();
        populateDropdowns(getFilterScopeSlots());
        renderView();
      };
      side.appendChild(sbtn);
    }
  });
  syncLocationControls();
}

function buildIterPills(){
  const row=document.getElementById("iter-row");
  row.innerHTML="";
  const iters=["Main"];
  if(SCHEDULE_DATA.iterations)Object.keys(SCHEDULE_DATA.iterations).forEach(k=>{if(k!=="Main")iters.push(k)});
  if(iters.length<=1)return;
  iters.forEach(iter=>{
    const btn=document.createElement("button");
    btn.className="iter-pill"+(iter==="Main"?" active":"");
    btn.textContent=iter;
    btn.onclick=()=>{
      document.querySelectorAll(".iter-pill").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      _iter=iter;renderView();
    };
    row.appendChild(btn);
  });
}

function buildDayChips(){
  const el=document.getElementById("fp-days");
  el.innerHTML="";
  DAY_ORDER.forEach((day,i)=>{
    const c=document.createElement("span");
    c.className="fc on";c.dataset.day=day;
    c.textContent=DAY_SHORT[i];
    c.onclick=()=>{c.classList.toggle("on");_activeDays.has(day)?_activeDays.delete(day):_activeDays.add(day);renderView()};
    el.appendChild(c);
  });
}

function buildRecChips(){
  const el=document.getElementById("fp-recs");
  el.innerHTML="";
  REC_LIST.forEach(r=>{
    const c=document.createElement("span");
    c.className="fc on";c.dataset.rec=r;
    c.textContent=recLabel(r);
    c.onclick=()=>{
      c.classList.toggle("on");
      const isOn=c.classList.contains("on");
      // Toggle all internal keys that map to this display group
      const g=recGroup(r);
      ["PINNED","PROTECT","PROTECT_EXACT","PROTECT_SLOT","INCLUDE","EXPERIMENTAL","CONSIDER","VARIETY","DROP","MANUAL"].forEach(k=>{
        if(recGroup(k)===g){isOn?_activeRecs.add(k):_activeRecs.delete(k);}
      });
      renderView();
    };
    el.appendChild(c);
  });
}

function populateDropdowns(slots){
  const classes=[...new Set(slots.map(s=>s.class_name).filter(Boolean))].sort();
  const trainers=[...new Set(slots.map(s=>s.trainer_1).filter(Boolean))].sort();
  const rooms=[...new Set(slots.map(s=>s.room).filter(Boolean))].sort();
  const cf=document.getElementById("fp-class");
  const tf=document.getElementById("fp-trainer");
  const rf=document.getElementById("fp-room");
  cf.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c}">${displayClass(c)}</option>`).join("");
  tf.innerHTML='<option value="">All Trainers</option>'+trainers.map(t=>`<option value="${t}">${t}</option>`).join("");
  rf.innerHTML='<option value="">All Rooms</option>'+rooms.map(r=>`<option value="${r}">${r}</option>`).join("");
  if(_classFilter&&classes.includes(_classFilter))cf.value=_classFilter;else if(_classFilter){_classFilter="";cf.value="";}
  if(_trainerFilter&&trainers.includes(_trainerFilter))tf.value=_trainerFilter;else if(_trainerFilter){_trainerFilter="";tf.value="";}
  if(_roomFilter&&rooms.includes(_roomFilter))rf.value=_roomFilter;else if(_roomFilter){_roomFilter="";rf.value="";}
}

// ============================================================
// FILTER HANDLERS
// ============================================================
function setFiltersOpen(open){
  _filtersOpen=!!open;
  document.getElementById("filter-panel").classList.toggle("open",_filtersOpen);
  document.getElementById("planner-shell").classList.toggle("filters-collapsed",!_filtersOpen);
  const toggle=document.getElementById("filter-toggle-btn");
  toggle.classList.toggle("active",_filtersOpen);
  toggle.classList.toggle("pinned",_filterPinned);
  const pin=document.getElementById("filter-pin-btn");
  if(pin)pin.classList.toggle("active",_filterPinned);
}
function toggleFilters(){
  if(_filtersOpen&&_filterPinned)_filterPinned=false;
  setFiltersOpen(!_filtersOpen);
}
function toggleFilterPin(){
  _filterPinned=!_filterPinned;
  if(_filterPinned)setFiltersOpen(true);
  else setFiltersOpen(_filtersOpen);
}
function toggleBand(el){el.classList.toggle("on");const b=el.dataset.band;_activeBands.has(b)?_activeBands.delete(b):_activeBands.add(b);renderView()}
function applyFilters(){
  _classFilter=document.getElementById("fp-class").value;
  _trainerFilter=document.getElementById("fp-trainer").value;
  _roomFilter=document.getElementById("fp-room").value;
  _reasonFilter=document.getElementById("fp-selection-reason")?.value||"";
  _minScore=parseInt(document.getElementById("fp-score-min").value)||0;
  _violOnly=document.getElementById("fp-violations").checked;
  _expOnly=document.getElementById("fp-experimental").checked;
  renderView();
}

function toggleTrainerFilter(name,e){
  if(e)e.stopPropagation();
  if(!name)return;
  const el=document.getElementById("fp-trainer");
  if(!el)return;
  const next=el.value===name?"":name;
  el.value=next;
  _trainerFilter=next;
  applyFilters();
  showToast(next?`Trainer filter: ${name}`:"Trainer filter cleared","");
}

function applyTrainerThumbnailState(root=document){
  const active=String(_trainerFilter||"").trim().toLowerCase();
  document.body.classList.toggle("trainer-filter-active",!!active);
  root.querySelectorAll(".workload-grid").forEach(grid=>grid.classList.toggle("has-trainer-filter",!!active));
  root.querySelectorAll(".workload-trainer,.trainer-spot-card").forEach(btn=>{
    const name=String(btn.dataset.trainer||"").trim().toLowerCase();
    btn.classList.toggle("selected",!!active&&name===active);
  });
  root.querySelectorAll(".cc-avatar-btn").forEach(btn=>{
    const name=String(btn.dataset.trainer||"").trim().toLowerCase();
    btn.classList.toggle("selected",!!active&&name===active);
  });
}

let _primeOnly=false;
let _protectedOnly=false;
let _minFill=0;

function applyFiltersAdvanced(){
  _primeOnly=document.getElementById("fp-prime-only")?.checked||false;
  _protectedOnly=document.getElementById("fp-protected-only")?.checked||false;
  _minFill=parseInt(document.getElementById("fp-fill-min")?.value||0);
  applyFilters();
}
function clearFilters(){
  _activeDays=new Set(DAY_ORDER);_activeBands=new Set(["morning","midday","evening"]);
  _activeRecs=new Set(["PINNED","PROTECT","PROTECT_EXACT","PROTECT_SLOT","INCLUDE","EXPERIMENTAL","CONSIDER","VARIETY","DROP","MANUAL"]);_classFilter="";_trainerFilter="";_roomFilter="";_reasonFilter="";
  _activeLocations=new Set(allLocations());
  _minScore=0;_violOnly=false;_expOnly=false;
  document.querySelectorAll(".fc").forEach(c=>c.classList.add("on"));
  syncLocationControls();
  populateDropdowns(getFilterScopeSlots());
  document.getElementById("fp-class").value="";
  document.getElementById("fp-trainer").value="";
  document.getElementById("fp-room").value="";
  const srEl=document.getElementById("fp-selection-reason");if(srEl)srEl.value="";
  document.getElementById("fp-score-min").value=0;
  document.getElementById("fp-score-val").textContent=0;
  document.getElementById("fp-violations").checked=false;
  document.getElementById("fp-experimental").checked=false;
  _primeOnly=false;_protectedOnly=false;_minFill=0;
  const pO=document.getElementById("fp-prime-only");if(pO)pO.checked=false;
  const prO=document.getElementById("fp-protected-only");if(prO)prO.checked=false;
  const fM=document.getElementById("fp-fill-min");if(fM)fM.value=0;
  const fV=document.getElementById("fp-fill-val");if(fV)fV.textContent="0%";
  renderView();
}

// ============================================================
// STATS ROW
// ============================================================
const CANONICAL_SELECTION_REASONS = [
  "Strong historic performance evidence",
  "Added for variety and to balance class mix",
  "Protected session & slot",
  "Experimental",
  "Trainer constraints"
];

function getCanonicalSelectionReason(s) {
  if (!s) return "Added for variety and to balance class mix";
  if (s.selection_reason_category && CANONICAL_SELECTION_REASONS.includes(s.selection_reason_category)) {
    return s.selection_reason_category;
  }
  if (s.selection_reason && CANONICAL_SELECTION_REASONS.includes(s.selection_reason)) {
    return s.selection_reason;
  }

  const rec = String(s.recommendation || "").toUpperCase();
  const schedReason = String(s.scheduling_reason || "").toLowerCase();
  const rationale = String(s.rationale || "").toLowerCase();

  // 1. Protected session & slot
  if (
    s.is_protected ||
    s.is_pinned ||
    ["PINNED", "PROTECT", "PROTECT_EXACT", "PROTECT_SLOT", "PROTECTED"].includes(rec) ||
    schedReason.includes("pinned") ||
    schedReason.includes("protected") ||
    schedReason.includes("rule ownership") ||
    schedReason.includes("protected_exact")
  ) {
    return "Protected session & slot";
  }

  // 2. Experimental
  if (
    s.is_experimental ||
    rec === "EXPERIMENTAL" ||
    rationale === "experimental" ||
    schedReason.includes("experimental")
  ) {
    return "Experimental";
  }

  // 3. Trainer constraints
  const bestTrainer = (Array.isArray(s.slot_top_trainers) && s.slot_top_trainers[0]?.trainer) || s.best_trainer_name || s.top_trainer_name;
  const isHighPerformer = (s.predicted_fill_rate || s.historical_avg_fill || 0) >= 0.35 || (s.historical_avg_checkin || 0) >= 5 || (s.score || 0) >= 40;
  const hasConstraintFlag = !!(s.trainer_constraint || s.trainer_rule_violated || s.rule_violating_trainer || (Array.isArray(s.constraint_violations) && s.constraint_violations.length > 0 && schedReason.includes("trainer")));

  if (
    hasConstraintFlag ||
    (bestTrainer && s.trainer_1 && bestTrainer !== s.trainer_1 && isHighPerformer && (s.trainer_violation_reason || s.best_trainer_unavailable || schedReason.includes("cap") || schedReason.includes("swap") || schedReason.includes("rule")))
  ) {
    return "Trainer constraints";
  }

  // 4. Added for variety and to balance class mix (explicit)
  if (
    s.is_variety_add ||
    rationale === "variety" ||
    rec === "VARIETY" ||
    rec === "BALANCE" ||
    schedReason.includes("variety") ||
    schedReason.includes("mix") ||
    schedReason.includes("filler") ||
    schedReason.includes("floor repair") ||
    schedReason.includes("minimum class count")
  ) {
    return "Added for variety and to balance class mix";
  }

  // 5. Strong historic performance evidence:
  // Requires actual historical sessions (sessions >= 2) AND solid performance metrics (fill >= 28% or checkins >= 4 or score >= 40)
  const sessions = Number(s.historical_session_count ?? s.session_count ?? s.sessions ?? 0);
  const fill = Number(s.historical_avg_fill ?? s.predicted_fill_rate ?? s.avg_fill_rate ?? 0);
  const checkins = Number(s.historical_avg_checkin ?? s.avg_checkin ?? 0);
  const score = Number(s.score ?? 0);
  const isTopPerformerReason = schedReason.includes("top performer") || schedReason.includes("strong performance") || schedReason.includes("proven");

  const hasProvenHistory = (sessions >= 3 && (fill >= 0.28 || checkins >= 4.0 || score >= 40)) ||
                            (sessions >= 2 && (fill >= 0.35 || checkins >= 5.0 || score >= 45));

  if (hasProvenHistory && (isTopPerformerReason || (!schedReason.includes("filler") && !schedReason.includes("repair")))) {
    return "Strong historic performance evidence";
  }

  if (bestTrainer && s.trainer_1 && bestTrainer !== s.trainer_1 && isHighPerformer) {
    return "Trainer constraints";
  }

  // 6. Default fallback: Added for variety and to balance class mix
  return "Added for variety and to balance class mix";
}

function renderStatsRow(area,slots){
  const total=slots.length;
  const pinnedClasses=slots.filter(isPinnedScheduleSlot).length;
  const generatedClasses=Math.max(0,total-pinnedClasses);
  const avgFill=total?slots.reduce((s,x)=>s+(x.predicted_fill_rate||0),0)/total:0;
  const avgScore=total?slots.reduce((s,x)=>s+(x.score||0),0)/total:0;
  const violations=slots.filter(s=>s.constraint_violations&&s.constraint_violations.length>0).length;

  const strongHistoric=slots.filter(s=>getCanonicalSelectionReason(s)==="Strong historic performance evidence").length;
  const varietyMix=slots.filter(s=>getCanonicalSelectionReason(s)==="Added for variety and to balance class mix").length;
  const protectedSlots=slots.filter(s=>getCanonicalSelectionReason(s)==="Protected session & slot").length;
  const experimental=slots.filter(s=>getCanonicalSelectionReason(s)==="Experimental").length;
  const trainerConstraints=slots.filter(s=>getCanonicalSelectionReason(s)==="Trainer constraints").length;

  const expPct = total ? ((experimental / total) * 100).toFixed(1) : "0.0";
  const expCls = (total > 0 && (experimental / total) > 0.10) ? "red" : "amber";

  area.insertAdjacentHTML("beforeend",`<div class="stats-row" style="display:flex;flex-wrap:wrap;gap:8px">
    ${sc("Generated Classes",generatedClasses,"blue")}
    ${sc("Pinned Classes",pinnedClasses,"amber","reason_pinned")}
    ${sc("Avg Fill",pct(avgFill,1),avgFill>=0.5?"green":avgFill>=0.35?"amber":"red")}
    ${sc("Strong Historic",`${strongHistoric} (${total?Math.round(strongHistoric/total*100):0}%)`,"green","reason_strong_historic")}
    ${sc("Variety & Mix",`${varietyMix} (${total?Math.round(varietyMix/total*100):0}%)`,"purple","reason_variety_mix")}
    ${sc("Protected Slot",`${protectedSlots} (${total?Math.round(protectedSlots/total*100):0}%)`,"blue","reason_protected")}
    ${sc("Experimental",`${experimental} (${expPct}%)`,expCls,"reason_experimental")}
    ${sc("Trainer Constraints",`${trainerConstraints} (${total?Math.round(trainerConstraints/total*100):0}%)`,"amber","reason_trainer_constraints")}
    ${sc("Violations",violations,violations>0?"red":"")}
  </div>`);
}
function sc(label,value,cls,kind){
  const click=kind?` onclick="openStatsModal('${kind}')" title="Open ${rvEscapeAttr(label)} schedule decisions"`:"";
  return`<div class="stat-card${kind?" clickable":""}"${click}><div class="sc-lbl">${label}</div><div class="sc-val${cls?" "+cls:""}">${value}</div></div>`;
}

function decisionReasonHtml(s){
  const reasons=[
    s.scheduling_reason,
    s.optimization_reason,
    s.score_reason,
    ...(Array.isArray(s.constraint_violations)?s.constraint_violations:[])
  ].filter(Boolean);
  return rvEscapeHtml(reasons.join(" · ")||"No decision reason was recorded for this class.");
}

function scheduleReasonPlain(s){
  const cat = getCanonicalSelectionReason(s);
  const detail = String(s?.scheduling_reason || s?.rationale || s?.optimization_reason || "").trim();
  if (!detail) return cat;
  if (detail.toLowerCase().includes(cat.toLowerCase())) return detail;
  return `${cat} — ${detail}`;
}
function hasAiOptimizationChange(s){
  const rec=String(s?.recommendation||"").toUpperCase();
  return !!(
    s?.ai_optimized ||
    s?.ai_added ||
    s?.ai_moved ||
    rec==="AI_OPTIMIZED" ||
    rec==="OPTIMIZED"
  );
}
function aiOptimizedIcon(s){
  if(!hasAiOptimizationChange(s))return "";
  const label=s?.ai_added?"AI added":(s?.ai_moved?"AI moved":"AI optimized");
  return `<span class="cc-ai-icon" title="${rvEscapeAttr(label)}" aria-label="${rvEscapeAttr(label)}">⚡</span>`;
}
function isBestHistoricTrainer(s){
  const slot=Number(s.slot_avg_checkin||0);
  const trainer=Number(s.trainer_slot_avg_checkin||0);
  const hist=Number(s.historical_session_count||0);
  return hist>0&&trainer>0&&(slot===0||trainer>=slot*.95);
}
function isNewHistoricAssignment(s){
  const hist=Number(s.historical_session_count||0);
  return !hist&&!s.historic_detail&&!s.slot_historic_detail&&!s.score_breakdown;
}
function scheduleReasonBadges(s){
  const chips=[];
  if(isBestHistoricTrainer(s)){
    chips.push(`<span class="cc-reason-badge best" title="Assigned to a historically strong trainer for this class/slot"><span>★</span><span>Best trainer</span></span>`);
  }
  if(isNewHistoricAssignment(s)){
    chips.push(`<span class="cc-reason-badge new" title="New assignment with no direct historic class-slot record"><span>✦</span><span>New data</span></span>`);
  }
  const reason=scheduleReasonPlain(s);
  const shortReason=reason.length>58?reason.slice(0,58).replace(/\s+\S*$/,"")+"…":reason;
  chips.push(`<span class="cc-reason-badge reason" title="${rvEscapeAttr(reason)}"><span>ⓘ</span><span class="cc-reason-text">${rvEscapeHtml(shortReason)}</span></span>`);
  return `<div class="cc-reason-row">${chips.join("")}</div>`;
}

function openStatsModal(kind){
  const slots=filterSlots(getActiveLocations().flatMap(loc=>getSlots(loc)));
  let title="Schedule Decisions";
  const rows=slots.filter(s=>{
    const reason=getCanonicalSelectionReason(s);
    if(kind==="reason_strong_historic") { title="Strong Historic Performance Evidence Classes"; return reason==="Strong historic performance evidence"; }
    if(kind==="reason_variety_mix") { title="Variety & Class Mix Balance Classes"; return reason==="Added for variety and to balance class mix"; }
    if(kind==="reason_pinned") { title="Pinned Classes"; return isPinnedScheduleSlot(s); }
    if(kind==="reason_protected" || kind==="protected") { title="Protected Session & Slot Classes"; return reason==="Protected session & slot" || ["PINNED","PROTECT","PROTECT_EXACT","PROTECT_SLOT"].includes(s.recommendation); }
    if(kind==="reason_experimental" || kind==="experimental") { title="Experimental Classes"; return reason==="Experimental" || ["EXPERIMENTAL"].includes(s.recommendation) || s.is_experimental; }
    if(kind==="reason_trainer_constraints") { title="Trainer Constraint Classes"; return reason==="Trainer constraints"; }
    return false;
  });
  const box=document.getElementById("modal-box");
  box.className="modal-box";
  box.innerHTML=`<div class="modal-hdr">
    <div><div class="modal-class-name">${title}</div><div class="modal-meta">${rows.length} matching classes in current filters</div></div>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body">
    <table class="hist-modal-table">
      <thead><tr><th>Class</th><th>Day</th><th>Time</th><th>Location</th><th>Trainer</th><th>Status</th><th>Score</th><th>Selection Reason</th></tr></thead>
      <tbody>${rows.map(s=>`<tr><td>${rvEscapeHtml(displayClass(s.class_name))}</td><td>${rvEscapeHtml(s.day_of_week||"—")}</td><td>${rvEscapeHtml(s.time||"—")}</td><td>${rvEscapeHtml(s.location||"—")}</td><td>${rvEscapeHtml(s.trainer_1||"—")}</td><td>${rvEscapeHtml(recLabel(s.recommendation||""))}</td><td>${Math.round(s.score||0)}</td><td>${rvEscapeHtml(getCanonicalSelectionReason(s))}</td></tr>`).join("")||`<tr><td colspan="8">No classes match this card in the current filters.</td></tr>`}</tbody>
    </table>
  </div>`;
  document.getElementById("modal-overlay").classList.add("open");
}

function renderTrainerWorkloadOverview(area,slots){
  const map={};
  slots.filter(s=>!s.is_discontinued).forEach(s=>{
    const t=s.trainer_1||"Unknown";
    if(!map[t])map[t]={classes:0,hours:0,fill:0};
    map[t].classes++;
    map[t].hours+=(Number(s.duration_min||60)/60);
    map[t].fill+=(s.predicted_fill_rate||0);
  });
  const trainers=Object.entries(map).sort((a,b)=>b[1].hours-a[1].hours);
  if(!trainers.length)return;
  const html=`<div class="workload-card">
    <div class="workload-head"><div class="workload-title">👥 Trainer Workload Overview</div><span style="font-size:11px;color:#64748B;font-weight:700">${trainers.length} Trainers</span></div>
    <div class="workload-grid">
      ${trainers.map(([name,d])=>{
        const hours=Math.round(d.hours*10)/10;
        const cls=hours<=5||hours>=15?"bad":(hours<10?"warn":"");
        const img=trainerImage(name);
        return`<button class="workload-trainer" data-trainer="${rvEscapeAttr(name)}" onclick="toggleTrainerFilter('${String(name).replace(/'/g,"\\'")}',event)">
          <div class="workload-avatar ${cls}">${img?`<img src="${img}" alt="${rvEscapeAttr(name)}">`:trainerInitials(name)}</div>
          <div class="workload-name">${rvEscapeHtml(name)}</div>
          <div class="workload-hours ${cls}">${hours} hrs</div>
          <div class="workload-classes">${d.classes} classes</div>
        </button>`;
      }).join("")}
    </div>
  </div>`;
  area.insertAdjacentHTML("beforeend",html);
  applyTrainerThumbnailState(area);
}

function plannerViewHeader(title,active){
  const pills=[
    ["grid","Standard"],
    ["cross","Multi-Location"],
    ["city","Intra-City"],
    ["heatmap","Heatmap"],
    ["rooms","Rooms"],
    ["timeline","Timeline"],
    ["analytics","Analytical"],
    ["list","Compact"]
  ];
  return`<div class="planner-card-head">
    <div class="planner-card-title">${title}</div>
    <div class="planner-view-pills">${pills.map(([v,l])=>`<button class="planner-view-pill ${active===v?"active":""}" onclick="setView('${v}')">${l}</button>`).join("")}</div>
  </div>`;
}

// ============================================================
// VIEW ROUTER
// ============================================================
function setView(v){
  _view=v;
  document.querySelectorAll(".vbtn").forEach(b=>b.classList.remove("active"));
  const el=document.getElementById("vbtn-"+v);
  if(el)el.classList.add("active");
  const hideBar=v==="rules"||v==="history"||v==="settings";
  document.getElementById("loc-bar").style.display=hideBar?"none":"";
  document.getElementById("filter-panel").style.display=hideBar?"none":"";
  document.getElementById("planner-shell").classList.toggle("full-width-shell",hideBar);
  document.querySelector(".ctrl-right").style.display=hideBar?"none":"";
  if(!hideBar)populateDropdowns(getFilterScopeSlots());
  if(!hideBar&&!_filterPinned&&_filtersOpen)setFiltersOpen(false);
  renderView();
}

function renderView(){
  const area=document.getElementById("main-area");
  area.innerHTML="";
  const slots=_loc?getSlots(_loc):[];
  const filtered=filterSlots(slots);
  const scopedFiltered=filterSlots(getFilterScopeSlots());
  if(_view==="grid")          renderGrid(area,filtered,slots);
  else if(_view==="timeline") renderTimeline(area,filtered);
  else if(_view==="list")     renderList(area,filtered);
  else if(_view==="trainer")  renderTrainer(area,scopedFiltered);
  else if(_view==="cross")    renderCrossLocation(area);
  else if(_view==="city")     renderIntraCity(area);
  else if(_view==="heatmap")  renderHeatmap(area,scopedFiltered);
  else if(_view==="rooms")    renderRoomView(area,filtered);
  else if(_view==="analytics")renderAnalytics(area,slots);
  else if(_view==="history")  renderHistoryView(area);
  else if(_view==="settings") renderSettingsView(area);
  applyTrainerThumbnailState(area);
}

// ============================================================
// GRID VIEW
// ============================================================
function renderGrid(area,filtered,allSlots){
  renderStatsRow(area,allSlots);
  renderTrainerWorkloadOverview(area,allSlots);
  if(!_historicSlotsCache){
    ensureHistoricSlotsLoaded().then(()=>{if(_view==="grid")renderView();});
  }
  // Build lookup: day → time → [slots]
  const byDayTime={};
  DAY_ORDER.forEach(d=>{byDayTime[d]={}});
  filtered.forEach(s=>{
    const t=s.time||"00:00";
    if(!byDayTime[s.day_of_week])byDayTime[s.day_of_week]={};
    if(!byDayTime[s.day_of_week][t])byDayTime[s.day_of_week][t]=[];
    byDayTime[s.day_of_week][t].push(s);
  });
  const times=[...new Set(filtered.map(s=>s.time||"00:00"))].sort();
  const dayDates=SCHEDULE_DATA.day_dates||{};

  const card=document.createElement("div");
  card.className="planner-card";
  card.innerHTML=plannerViewHeader("Weekly Schedule","grid");
  const grid=document.createElement("div");
  grid.className="sched-grid";

  // Count classes per day (from filtered)
  const dayCount={};DAY_ORDER.forEach(d=>dayCount[d]=0);
  filtered.forEach(s=>dayCount[s.day_of_week]=(dayCount[s.day_of_week]||0)+1);

  // header row
  grid.insertAdjacentHTML("beforeend",`<div class="sg-corner"></div>`);
  DAY_ORDER.forEach(d=>{
    const dt=dayDates[d]?new Date(dayDates[d]).toLocaleDateString("en-IN",{day:"numeric",month:"short"}):"";
    const cnt=dayCount[d]||0;
    const cntColor=cnt>=10?"var(--green)":cnt>=7?"var(--primary)":"var(--text-muted)";
    // Compute class mix for this day
    const daySlotsForMix=(byDayTime[d]||{});
    const allDaySlots=Object.values(daySlotsForMix).flat();
    const dayMix={};allDaySlots.forEach(s=>{const f=getFamily(s.class_name);dayMix[f]=(dayMix[f]||0)+1});
    const mixTip=Object.entries(dayMix).sort((a,b)=>b[1]-a[1]).map(([f,c])=>`${f.replace(/_/g," ")}: ${c}`).join(" | ");
    const dayEl=document.createElement("div");
    dayEl.className="sg-day";
    dayEl.style.cursor="pointer";
    dayEl.title=`Click for ${d} format breakdown`;
    dayEl.innerHTML=`
      <div class="sg-day-name">${d.slice(0,3)}</div>
      <div class="sg-day-date">${dt}</div>
      <div style="font-size:10px;font-weight:700;color:${cntColor};margin-top:2px;font-family:'Plus Jakarta Sans',sans-serif">${cnt} classes</div>
      <div style="font-size:8px;color:var(--text-light);margin-top:2px;font-style:italic;opacity:0">↓ breakdown</div>`;
    dayEl.addEventListener("mouseenter",()=>{dayEl.querySelector("div:last-child").style.opacity="1"});
    dayEl.addEventListener("mouseleave",()=>{dayEl.querySelector("div:last-child").style.opacity="0"});
    dayEl.onclick=()=>openDayBreakdownModal(d,allDaySlots);
    grid.appendChild(dayEl);
  });

  // body rows
  times.forEach(t=>{
    const primeCls=isPrime(t)?" prime":"";
    const tip=timeBadgeTooltip(_loc,t);
    grid.insertAdjacentHTML("beforeend",`<div class="sg-time${primeCls}"><span class="sg-time-badge" data-tip="${rvEscapeAttr(tip)}">${t}</span></div>`);
    DAY_ORDER.forEach(d=>{
      const cell=document.createElement("div");
      cell.className="sg-cell addable";
      cell.title=`Add class at ${_loc||""} · ${d} ${t}`;
      cell.dataset.location=_loc||"";
      cell.dataset.day=d;
      cell.dataset.time=t;
      cell.dataset.date=dayDates[d]||"";
      const slotsHere=(byDayTime[d]||{})[t]||[];
      slotsHere.sort((a,b)=>(b.score||0)-(a.score||0)).forEach(s=>cell.appendChild(makeClassCard(s)));
      if(!slotsHere.length){
        const slotIntel=historicSlotIntel(_loc,d,t);
        const timeIntel=historicTimeIntel(_loc,t);
        const intel=slotIntel||timeIntel;
        cell.insertAdjacentHTML("beforeend",emptySlotHoverHtml(intel,slotIntel,d,t));
      }
      cell.ondragover=(e)=>{e.preventDefault();cell.classList.add("drag-over")};
      cell.ondragleave=()=>cell.classList.remove("drag-over");
      cell.ondrop=(e)=>{
        e.preventDefault();cell.classList.remove("drag-over");
        const raw=e.dataTransfer.getData("application/json");
        if(!raw)return;
        applyManualClassMove(JSON.parse(raw),{location:_loc,day_of_week:d,time:t,date:dayDates[d]||""});
      };
      cell.onclick=(e)=>{
        if(e.target.closest(".cc"))return;
        if(_copiedClassSlot){
          pasteCopiedClass({location:_loc,day_of_week:d,time:t,date:dayDates[d]||""});
          return;
        }
        openAddClassModal({location:_loc,day_of_week:d,time:t,date:dayDates[d]||""});
      };
      grid.appendChild(cell);
    });
  });

  card.appendChild(grid);
  area.appendChild(card);
}

// Compact card for multi-location grid — same visual language as makeClassCard
function makeClassCardMini(s, locOverride){
  const fam=getFamily(s.class_name);
  const div=document.createElement("div");
  div.className=`cc cc-mini cc-${fam}`;
  const fill=classSlotFill(s);
  const fc=fillColor(fill);
  const violCount=(s.constraint_violations||[]).length;
  const badgeCls=recBadgeCls(s.recommendation);
  const avatar=trainerImage(s.trainer_1);
  const initials=trainerInitials(s.trainer_1||s.class_name);
  const avg=classSlotAvgCheckin(s);
  const loc=locOverride||s.location||_loc;
  const locColor=LOC_COLOR[loc]||"#6B7280";
  const locAbbr=LOC_ABBR[loc]||"??";
  div.innerHTML=`
    ${aiOptimizedIcon(s)}
    <div class="cc-top">
      <div class="cc-title-stack">
        <div class="cc-card-kicker">${locOverride?rvEscapeHtml(locAbbr):"Scheduled"}</div>
        <div class="cc-name" style="font-size:11px;font-weight:800;line-height:1.2;margin-bottom:3px">${rvEscapeHtml(displayClass(s.class_name))}</div>
      </div>
      <button class="score-click cc-score-ring" style="width:24px;height:24px;font-size:10px" title="Show score calculation">${scoreRing(s.score,20)}</button>
    </div>
    <div class="cc-trainer" style="margin-bottom:6px">
      <button class="cc-avatar cc-avatar-btn" type="button" title="Toggle trainer filter" data-trainer="${rvEscapeAttr(s.trainer_1||"")}" style="width:24px;height:24px;overflow:hidden;flex-shrink:0">${avatar?`<img src="${avatar}" alt="${rvEscapeAttr(s.trainer_1||"Trainer")}" style="width:24px;height:24px;object-fit:cover;display:block">`:initials}</button>
      <span class="cc-tr-name" style="font-size:10px;color:var(--text-2)">${rvEscapeHtml(s.trainer_1||"—")}</span>
    </div>
    ${scheduleReasonBadges(s)}
    <div class="cc-bottom" style="padding:6px 8px;gap:12px;background:var(--surface2);border-top:1px solid var(--border);margin:-8px -8px -8px -8px;margin-top:4px">
      <div style="flex:1">
      <div style="display:flex;justify-content:space-between;font-size:8px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px"><span>Fill</span><span style="color:${fc}">${pct(fill)}</span></div>
        <div class="cc-bar-bg" style="height:3px"><div class="cc-bar-fill" style="width:${Math.round(fill*100)}%;background:${fc}"></div></div>
      </div>
      <div style="text-align:right">
        <div style="font-size:8px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:1px">Avg</div>
        <div style="font-size:11px;font-weight:800;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif;line-height:1">${round1(avg)}</div>
      </div>
    </div>`;
  const scoreBtn=div.querySelector(".score-click");
  if(scoreBtn)scoreBtn.onclick=(e)=>{e.stopPropagation();openScoreModal(s)};
  const avatarBtn=div.querySelector(".cc-avatar-btn");
  if(avatarBtn)avatarBtn.onclick=(e)=>{toggleTrainerFilter(s.trainer_1||"",e)};
  div.onclick=()=>openModal(s);
  return div;
}

function makeClassCard(s){
  const fam=getFamily(s.class_name);
  const div=document.createElement("div");
  div.className=`cc cc-${fam}`;
  div.draggable=true;
  div.dataset.slot=JSON.stringify(s);
  const fill=classSlotFill(s);
  const fc=fillColor(fill);
  const violCount=(s.constraint_violations||[]).length;
  const viols=violCount?`<span class="cc-viol" title="Constraint issues">${violCount}</span>`:"";
  const exp=s.is_experimental?`<span class="cc-exp-mark">EXP</span>`:"";
  const badgeCls=recBadgeCls(s.recommendation);
  const avatar=trainerImage(s.trainer_1);
  const initials=trainerInitials(s.trainer_1||s.class_name);
  const avg=classSlotAvgCheckin(s);
  const histRows=(s.slot_historic_detail&&s.slot_historic_detail.session_rows)||(s.historic_detail&&s.historic_detail.session_rows)||s.historical_session_count||0;
  const histCount=Array.isArray(histRows)?histRows.length:Number(histRows||0);
  const scoreVal=Math.round(s.score||0);
  const roomName=rvEscapeHtml(s.room?String(s.room).replace(/_/g," "):"Auto room");
  const dataSource=s.slot_avg_checkin?"slot":(s.historical_avg_checkin>0?"hist":(s.trainer_overall_checkin?"trainer":"none"));
  const quality=s.score>=80?`<span class="cc-chip">80+ score</span>`:"";
  div.innerHTML=`
    ${aiOptimizedIcon(s)}
    <div class="cc-top">
      <div class="cc-title-stack">
        <div class="cc-card-kicker" style="font-size:7.5px;opacity:0.7">${roomName}</div>
        <div class="cc-name" style="font-size:11.5px;font-weight:800;letter-spacing:-0.01em;line-height:1.2;margin-bottom:3px">${rvEscapeHtml(displayClass(s.class_name))}</div>
      </div>
      <button class="score-click cc-score-ring" style="width:26px;height:26px;font-size:10px" title="Show score calculation">${scoreRing(s.score,30)}</button>
    </div>
    <div class="cc-info-row">
      <div class="cc-trainer">
        <button class="cc-avatar cc-avatar-btn" type="button" title="Toggle trainer filter" data-trainer="${rvEscapeAttr(s.trainer_1||"")}" style="width:28px;height:28px;overflow:hidden;flex-shrink:0">${avatar?`<img src="${avatar}" alt="${rvEscapeAttr(s.trainer_1||"Trainer")}" style="width:28px;height:28px;object-fit:cover;display:block">`:initials}</button>
        <span class="cc-tr-name" title="${rvEscapeAttr(s.trainer_1||"—")}">${rvEscapeHtml(s.trainer_1||"—")}</span>
        <span class="cc-meta"><span>◷</span> ${rvEscapeHtml(s.time||"—")}</span>
      </div>
    </div>
    ${scheduleReasonBadges(s)}
    <div class="cc-bottom">
      <div class="cc-fill-main">
        <div class="cc-fill-head"><span style="font-size:8px;font-weight:800;color:var(--text-muted);text-transform:uppercase">Fill</span><span style="font-size:9px;font-weight:900;color:${fc}">${pct(fill)}</span></div>
        <div class="cc-bar-bg" style="height:4px"><div class="cc-bar-fill" style="width:${Math.round(fill*100)}%;background:${fc}"></div></div>
      </div>
      <div style="text-align:right;flex-shrink:0;padding-left:4px;border-left:1px solid var(--border);margin-left:4px">
        <div style="font-size:7.5px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Avg</div>
        <div style="font-size:12px;font-weight:900;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif;line-height:1">${round1(avg)}</div>
      </div>
    </div>
    <div class="cc-hover-body">
      <div class="cc-hover-tools">
        <button class="cc-tool" type="button" data-action="similar"><span class="cc-tool-icon">≈</span> Similar</button>
        <button class="cc-tool secondary" type="button" data-action="replace"><span class="cc-tool-icon">↕</span> Trainer</button>
        <button class="cc-tool secondary" type="button" data-action="copy"><span class="cc-tool-icon">⧉</span> Copy</button>
        <button class="cc-tool danger" type="button" data-action="remove"><span class="cc-tool-icon">×</span> Remove</button>
      </div>
    </div>`;
  div.ondragstart=(e)=>{
    e.stopPropagation();
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("application/json",JSON.stringify(s));
  };
  const scoreBtn=div.querySelector(".score-click");
  if(scoreBtn)scoreBtn.onclick=(e)=>{e.stopPropagation();openScoreModal(s)};
  const avatarBtn=div.querySelector(".cc-avatar-btn");
  if(avatarBtn)avatarBtn.onclick=(e)=>{toggleTrainerFilter(s.trainer_1||"",e)};
  div.querySelector('[data-action="similar"]').onclick=(e)=>{e.stopPropagation();openSimilarModal(s)};
  div.querySelector('[data-action="replace"]').onclick=(e)=>{e.stopPropagation();openReplaceTrainerModal(s)};
  div.querySelector('[data-action="copy"]').onclick=(e)=>{e.stopPropagation();copyClassCard(s)};
  div.querySelector('[data-action="remove"]').onclick=(e)=>{e.stopPropagation();confirmManualClassRemove(s)};
  div.onclick=()=>openModal(s);
  return div;
}

// ============================================================
// TIMELINE VIEW
// ============================================================
function renderTimeline(area,filtered){
  const TL_START=7*60, TL_END=21.5*60, TL_SPAN=TL_END-TL_START;
  renderStatsRow(area,filtered);

  const outerWrap=document.createElement("div");
  outerWrap.className="tl-wrap";
  outerWrap.style.overflowX="auto";

  const totalClasses=filtered.length;
  const avgFill=totalClasses?filtered.reduce((sum,s)=>sum+(s.predicted_fill_rate||0),0)/totalClasses:0;
  const primeCount=filtered.filter(s=>PRIME_TIMES.has(s.time)).length;
  const trainerCount=new Set(filtered.map(s=>s.trainer_1).filter(Boolean)).size;
  const manualCount=filtered.filter(s=>recGroup(s.recommendation)==="MANUAL"||s.manual_added||s.manual_moved).length;
  outerWrap.insertAdjacentHTML("beforeend",`<div class="tl-hero">
    <div class="tl-hero-title"><strong>Schedule Timeline</strong><span>Class-format ribbons by day, time, projected fill, prime coverage, and manual edits.</span></div>
    <div class="tl-kpi"><span>Classes</span><strong>${totalClasses}</strong></div>
    <div class="tl-kpi"><span>Avg Fill</span><strong style="color:${fillColor(avgFill)}">${pct(avgFill,1)}</strong></div>
    <div class="tl-kpi"><span>Prime Slots</span><strong>${primeCount}</strong></div>
    <div class="tl-kpi"><span>Trainers</span><strong>${trainerCount}</strong></div>
  </div>`);
  outerWrap.insertAdjacentHTML("beforeend",`<div class="tl-mode-row">
    ${[["format","Format"],["level","Level"],["class","Class"],["fill","Fill"],["trainer","Trainer"],["density","Density"]].map(([k,l])=>`<button class="tl-mode-btn ${_timelineMode===k?"active":""}" onclick="setTimelineMode('${k}')">${l}</button>`).join("")}
  </div>`);

  const visibleGroups=[...new Set(filtered.map(s=>timelineGroup(s.class_name)).filter(Boolean))].sort();
  const visibleLevels=[...new Set(filtered.map(s=>classLevel(s.class_name)))].sort();
  const visibleClasses=[...new Set(filtered.map(s=>s.class_name).filter(Boolean))].sort();
  const legEl=document.createElement("div");
  legEl.className="tl-legend";
  legEl.insertAdjacentHTML("beforeend",`<span class="tl-legend-label">${_timelineMode==="fill"?"Fill Bands":_timelineMode==="trainer"?"Trainer Load":_timelineMode==="level"?"Class Level":_timelineMode==="class"?"Class Name":"Format Groups"}</span>`);
  const legendItems=_timelineMode==="fill"
    ? [["High Fill","#15803D"],["Medium Fill","#D97706"],["Low Fill","#DC2626"]]
    : _timelineMode==="level"
    ? visibleLevels.map(l=>[LEVEL_LABEL[l],LEVEL_COLOR[l]])
    : _timelineMode==="class"
    ? visibleClasses.map(c=>[shortClass(c),timelineColor({class_name:c})])
    : visibleGroups.map(g=>[timelineGroupLabel(g),TIMELINE_GROUP_COLOR[g]||TIMELINE_GROUP_COLOR.full]);
  legendItems.forEach(([label,col])=>{
    legEl.insertAdjacentHTML("beforeend",`<div class="tl-leg-chip" style="background:${col}"><span class="tl-leg-dot"></span><span>${label}</span></div>`);
  });
  if(manualCount)legEl.insertAdjacentHTML("beforeend",`<div class="tl-leg-chip" style="background:var(--text-muted)"><span class="tl-leg-dot"></span><span>${manualCount} Manual edits</span></div>`);
  outerWrap.appendChild(legEl);

  const innerWrap=document.createElement("div");
  innerWrap.className="tl-container";

  const byDay={};
  DAY_ORDER.forEach(d=>byDay[d]=[]);
  filtered.forEach(s=>{if(byDay[s.day_of_week])byDay[s.day_of_week].push(s)});

  DAY_ORDER.forEach((day,di)=>{
    const daySlots=byDay[day];
    const row=document.createElement("div");
    row.className="tl-day-row";

    const dayLbl=document.createElement("div");
    dayLbl.className="tl-day-lbl";
    dayLbl.innerHTML=`${DAY_SHORT[di]}<span class="tl-day-count">${daySlots.length}cls</span>`;
    row.appendChild(dayLbl);

    const track=document.createElement("div");
    track.className="tl-track";

    daySlots.forEach(s=>{
      const start=tmins(s.time||"00:00");
      const dur=s.duration_min||57;
      const left=Math.max(0,(start-TL_START)/TL_SPAN*100);
      const width=Math.max(0.8,dur/TL_SPAN*100);

      const rec=s.recommendation||"CONSIDER";
      const recNorm=recGroup(rec);
      const clsCol=_timelineMode==="fill"?fillColor(s.predicted_fill_rate||0):_timelineMode==="level"?LEVEL_COLOR[classLevel(s.class_name)]:_timelineMode==="class"?timelineColor({class_name:s.class_name}):timelineColor(s);
      const fill=s.predicted_fill_rate||0;
      const fillBarW=Math.round(fill*100);
      const isPrime2=PRIME_TIMES.has(s.time);
      const alpha=s.is_experimental?0.6:1;

      const block=document.createElement("div");
      block.className="tl-block";
      const modeOpacity=_timelineMode==="density"?Math.max(.35,Math.min(1,(s.predicted_fill_rate||0)+.2)):alpha;
      block.style.cssText=`left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;background:${clsCol};opacity:${modeOpacity};${isPrime2?"box-shadow:0 0 0 2px rgba(255,255,255,.48);":""}`;
      block.title=`${s.time} ${displayClass(s.class_name)} — ${s.trainer_1||"—"} · Fill: ${pct(fill)} · ${rec}`;

      let inner=`<div class="tl-b-top"></div>`;
      if(width>3.5){
        const label=_timelineMode==="trainer"?(s.trainer_1||"—").split(" ").pop():_timelineMode==="level"?LEVEL_LABEL[classLevel(s.class_name)]:shortClass(s.class_name);
        inner+=`<div class="tl-b-name">${label}</div>`;
        if(width>5){inner+=`<div class="tl-b-fill">${pct(fill)}</div>`;}
        if(width>9){
          const lastName=(s.trainer_1||"").split(" ").pop();
          inner+=`<div class="tl-b-sub">${lastName}</div>`;
        }
      }
      inner+=`<div class="tl-b-bar" style="width:${fillBarW}%"></div>`;
      block.innerHTML=inner;
      block.onclick=()=>openModal(s);
      track.appendChild(block);
    });
    row.appendChild(track);
    innerWrap.appendChild(row);
  });
  outerWrap.appendChild(innerWrap);

  // Axis
  const axisTimes=[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
  const axisWrap=document.createElement("div");
  axisWrap.className="tl-axis-wrap";
  axisTimes.forEach(h=>{
    const pos=((h*60-TL_START)/TL_SPAN*100).toFixed(1);
    const isPr=[8,9,10,11,17,18,19].includes(h);
    axisWrap.insertAdjacentHTML("beforeend",
      `<span class="tl-axis-tick" style="left:${pos}%;color:${isPr?"var(--prime)":"var(--text-light)"};font-weight:${isPr?700:500}">${h}:00</span>
       <div class="tl-axis-line" style="left:${pos}%;background:${isPr?"rgba(217,119,6,0.18)":"rgba(226,232,240,0.6)"}"></div>`
    );
  });
  outerWrap.appendChild(axisWrap);
  area.appendChild(outerWrap);
}
function setTimelineMode(mode){
  _timelineMode=mode;
  renderView();
}

function renderHeatmap(area,filtered){
  renderStatsRow(area,filtered);
  const byTimeDay={};
  filtered.forEach(s=>{
    const t=s.time||"00:00";
    const d=s.day_of_week||"";
    if(!byTimeDay[t])byTimeDay[t]={};
    if(!byTimeDay[t][d])byTimeDay[t][d]=[];
    byTimeDay[t][d].push(s);
  });
  const times=[...new Set(filtered.map(s=>s.time||"00:00"))].sort();
  const html=`<div class="view-surface">
    <div class="view-surface-head"><div class="view-surface-title">Schedule Heatmap</div><div style="font-size:11px;color:var(--text-muted);font-weight:800">Fill intensity by day and slot</div></div>
    <div class="heatmap-grid">
      <div></div>
      ${DAY_ORDER.map(d=>`<div class="heatmap-head">${d.slice(0,3)}</div>`).join("")}
      ${times.map(t=>`<div class="heatmap-time">${t}</div>${DAY_ORDER.map(d=>{
        const rows=(byTimeDay[t]||{})[d]||[];
        const avg=rows.length?rows.reduce((sum,s)=>sum+(s.predicted_fill_rate||0),0)/rows.length:0;
        const cls=avg>=.7?"hot":avg>=.45?"warm":rows.length?"cold":"";
        const label=rows.length?`${rows.length} class${rows.length===1?"":"es"}`:"Open";
        const classSummary = rows.map(r => `${r.location.split(",")[0]}: ${displayClass(r.class_name)} (${trainerInitials(r.trainer)})`).join("\n");
        return`<button class="heatmap-cell ${cls}" title="${rvEscapeAttr(classSummary)}" onclick="${rows.length?`openSlotList(${rvEscapeAttr(JSON.stringify(rows))})`:""}"><strong>${rows.length?pct(avg,0):"+"}</strong><span>${label}</span></button>`;
      }).join("")}`).join("")}
    </div>
  </div>`;
  area.insertAdjacentHTML("beforeend",html);
}

function renderRoomView(area,filtered){
  renderStatsRow(area,filtered);
  if(!filtered||!filtered.length){
    const empty=document.createElement("div");
    empty.style.cssText="padding:48px;text-align:center;color:#94A3B8;font-size:13px;font-weight:600";
    empty.innerHTML=`<div style="font-size:32px;margin-bottom:12px">🏛</div><div>No classes to display.</div><div style="font-size:11px;margin-top:6px">Generate a schedule or adjust filters.</div>`;
    area.appendChild(empty);
    return;
  }
  const map={};
  filtered.forEach(s=>{
    const room=s.room?String(s.room).replace(/_/g," "):"Auto room";
    if(!map[room])map[room]=[];
    map[room].push(s);
  });
  const rooms=Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]));
  const activeLocation=_loc||filtered[0]?.location||"";
  
  const startTime = 7 * 60; // 7 AM
  const endTime = 22 * 60; // 10 PM
  const totalMinutes = endTime - startTime;
  const pixelsPerMinute = 1.8; // Reduced slightly for vertical space

  const wrap = document.createElement("div");
  wrap.className = "view-surface";
  wrap.innerHTML = `
    <div class="view-surface-head">
      <div class="view-surface-title">Room Utilization Timeline</div>
      <div style="font-size:11px;color:var(--text-muted);font-weight:800">${rvEscapeHtml(activeLocation||"Current location")} only · precision space management view</div>
    </div>
    <div class="room-timeline-outer">
      <div class="room-timeline-container" style="display:flex;position:relative;height:700px;overflow-y:auto">
        <!-- Time Bar -->
        <div class="time-axis" style="width:64px;background:var(--surface2);border-right:1px solid var(--border);position:sticky;left:0;z-index:20">
          <div style="height:48px;background:var(--surface2);border-bottom:1px solid var(--border)"></div>
          ${Array.from({length: 16}).map((_, i) => {
            const hour = 7 + i;
            return `<div style="height:${60 * pixelsPerMinute}px;border-bottom:1px dashed var(--border);font-size:9px;color:var(--text-light);padding:4px;font-weight:900;display:flex;justify-content:flex-end;align-items:flex-start">${hour}:00</div>`;
          }).join("")}
        </div>
        
        <!-- Room Columns -->
        <div class="room-columns-wrap" style="display:flex;flex:1;overflow-x:auto">
          ${rooms.map(([room, rows]) => {
            const utilizedMinutes=rows.reduce((sum,s)=>sum+Number(getDuration(s.class_name)||s.duration_min||57),0);
            const utilizationPct=Math.max(0,Math.min(100,Math.round((utilizedMinutes/totalMinutes)*100)));
            return `
              <div class="room-column" style="min-width:200px;flex:1;border-right:1px solid var(--border);position:relative;background:repeating-linear-gradient(180deg, transparent, transparent ${60*pixelsPerMinute-1}px, color-mix(in srgb, var(--border) 55%, transparent) ${60*pixelsPerMinute-1}px, color-mix(in srgb, var(--border) 55%, transparent) ${60*pixelsPerMinute}px)">
                <div style="height:48px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;font-size:12px;font-weight:900;color:var(--text);position:sticky;top:0;z-index:15;box-shadow:0 2px 4px rgba(0,0,0,0.02)">
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${rvEscapeHtml(room)}</span>
                  <span style="font-size:10px;font-weight:900;color:${utilizationPct>=70?'var(--green)':utilizationPct>=45?'var(--prime)':'var(--text-muted)'}">${utilizationPct}% util</span>
                </div>
                <div style="height:${totalMinutes * pixelsPerMinute}px;position:relative;padding:0 4px">
                  ${rows.map(s => {
                    const startM = tmins(s.time) - startTime;
                    const dur = getDuration(s.class_name);
                    const top = startM * pixelsPerMinute;
                    const height = dur * pixelsPerMinute;
                    return `
                      <div class="room-class-slot"
                           style="position:absolute;left:8px;right:8px;top:${top}px;height:${height}px;background:${classColor(s.class_name)};overflow:hidden;cursor:pointer;border-left:4px solid rgba(0,0,0,0.3);z-index:10"
                           onmouseover="this.style.transform='scale(1.02)';this.style.zIndex='25'"
                           onmouseout="this.style.transform='scale(1)';this.style.zIndex='10'"
                           onclick='openModal(JSON.parse(this.dataset.slot))'
                           data-slot='${rvEscapeAttr(JSON.stringify(s))}'>
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px">
                           <span style="font-size:9px;font-weight:900;color:rgba(255,255,255,0.9)">${s.time}</span>
                           <span style="font-size:8px;font-weight:800;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.1);padding:1px 4px;border-radius:4px">${s.day_of_week.slice(0,3)}</span>
                        </div>
                        <div style="font-size:11px;font-weight:900;color:var(--bg);line-height:1.2;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${displayClass(s.class_name)}</div>
                        <div style="display:flex;align-items:center;gap:6px">
                           <span class="trainer-mgr-avatar" style="width:18px;height:18px;font-size:7px;background:rgba(255,255,255,0.2);color:var(--bg);border:none">${trainerInitials(s.trainer_1||"")}</span>
                           <span style="font-size:9px;color:rgba(255,255,255,0.9);font-weight:800">${rvEscapeHtml((s.trainer_1||"—").split(" ")[0])}</span>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;
  area.appendChild(wrap);
}

// ============================================================
// LIST VIEW
// ============================================================
function renderList(area,filtered){
  renderStatsRow(area,filtered);
  const cols=[
    {k:"day_of_week",l:"Day",sort:s=>DAY_ORDER.indexOf(s.day_of_week)},
    {k:"time",l:"Time",sort:s=>tmins(s.time)},
    {k:"class_name",l:"Class",sort:s=>s.class_name||""},
    {k:"trainer_1",l:"Trainer",sort:s=>s.trainer_1||""},
    {k:"room",l:"Room",sort:s=>s.room||""},
    {k:"score",l:"Score",sort:s=>s.score||0},
    {k:"predicted_fill_rate",l:"Fill %",sort:s=>s.predicted_fill_rate||0},
    {k:"historical_avg_checkin",l:"Avg CheckIn",sort:s=>s.historical_avg_checkin||0},
    {k:"historical_session_count",l:"Sessions",sort:s=>s.historical_session_count||0},
    {k:"historical_late_cancel_rate",l:"Late Cancel",sort:s=>s.historical_late_cancel_rate||0},
    {k:"historical_no_show_rate",l:"No Show",sort:s=>s.historical_no_show_rate||0},
    {k:"trainer_overall_fill",l:"Trainer Fill",sort:s=>s.trainer_overall_fill||0},
    {k:"recommendation",l:"Rec",sort:s=>s.recommendation||""},
    {k:"constraint_violations",l:"Violations",sort:s=>(s.constraint_violations||[]).length},
  ];

  let data=[...filtered];
  if(_sortCol!==null){
    const col=cols[_sortCol];
    data.sort((a,b)=>{const va=col.sort(a),vb=col.sort(b);return typeof va==="string"?va.localeCompare(vb)*_sortDir:(va-vb)*_sortDir});
  }

  const wrap=document.createElement("div");wrap.style.overflowX="auto";
  const tbl=document.createElement("table");tbl.className="list-tbl";

  const thead=document.createElement("thead");
  thead.innerHTML=`<tr>${cols.map((c,i)=>`<th onclick="sortList(${i})">${c.l}</th>`).join("")}</tr>`;
  tbl.appendChild(thead);

  const tbody=document.createElement("tbody");
  data.forEach(s=>{
    const tr=document.createElement("tr");
    if(isPrime(s.time))tr.classList.add("prime-row");
    tr.onclick=()=>openModal(s);
    const fill=s.predicted_fill_rate||0;
    const fc=fillColor(fill);
    const viols=s.constraint_violations||[];
    const fam=getFamily(s.class_name);
    tr.innerHTML=`
      <td class="td-m">${s.day_of_week||""}</td>
      <td><span style="font-weight:700;color:${isPrime(s.time)?"var(--prime)":"var(--text)"}">${s.time||""}</span></td>
      <td><span style="color:${classColor(s.class_name)};font-weight:600">${displayClass(s.class_name)}</span></td>
      <td>${s.trainer_1||"—"}</td>
      <td class="td-m">${s.room||"—"}</td>
      <td class="td-c">${scoreRing(s.score,22)}</td>
      <td><div class="fill-cell"><div class="fill-mini"><div class="fill-mini-fill" style="width:${Math.round(fill*100)}%;background:${fc}"></div></div><span style="font-weight:700;color:${fc}">${pct(fill)}</span></div></td>
      <td class="td-c">${round1(s.historical_avg_checkin)}</td>
      <td class="td-c">${s.historical_session_count||0}</td>
      <td class="td-c" style="color:${(s.historical_late_cancel_rate||0)>0.15?"var(--red)":"var(--text-muted)"}">${pct(s.historical_late_cancel_rate)}</td>
      <td class="td-c" style="color:${(s.historical_no_show_rate||0)>0.2?"var(--red)":"var(--text-muted)"}">${pct(s.historical_no_show_rate)}</td>
      <td class="td-c" style="color:${fillColor(s.trainer_overall_fill)}">${pct(s.trainer_overall_fill)}</td>
      <td><span class="cc-badge ${recBadgeCls(s.recommendation)}">${recLabel(s.recommendation)}</span>${s.is_experimental?`<span class="exp-mark" style="margin-left:3px">EXP</span>`:""}</td>
      <td class="td-c">${viols.length?`<span class="viol-dot">${viols.length}</span>`:""}</td>`;
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  area.appendChild(wrap);
}
function sortList(i){
  if(_sortCol===i)_sortDir*=-1;else{_sortCol=i;_sortDir=-1}
  document.querySelectorAll(".list-tbl thead th").forEach((th,j)=>{th.classList.remove("sort-asc","sort-desc");if(j===i)th.classList.add(_sortDir===1?"sort-asc":"sort-desc")});
  renderList(document.getElementById("main-area"),filterSlots(getSlots(_loc)));
  document.getElementById("main-area").scrollTop=0;
}

// ============================================================
// TRAINER VIEW — location columns side by side
// ============================================================
const LOC_COLORS={
  "Kwality House, Kemps Corner":{bg:"#EFF6FF",fg:"#1D4ED8",border:"#BFDBFE",tag:"KW"},
  "Supreme HQ, Bandra":         {bg:"#EDE9FE",fg:"#6D28D9",border:"#DDD6FE",tag:"SU"},
  "Kenkere House":              {bg:"#F0FDF4",fg:"#15803D",border:"#BBF7D0",tag:"KE"},
};

function makeTrainerDayChips(daySlots){
  return daySlots.sort((a,b)=>tmins(a.time)-tmins(b.time)).map(s=>{
    const col=classColor(s.class_name);
    const sq=JSON.stringify(s).replace(/"/g,"&quot;");
    const isAM=tmins(s.time)<13*60;
    return`<span class="tc-chip" style="background:${col}15;border:1px solid ${col}44;color:${col}" title="${s.time} · ${displayClass(s.class_name)} · ${pct(s.predicted_fill_rate)} fill · ${s.recommendation}" onclick="event.stopPropagation();openModal(${sq})"><span style="font-size:9px;opacity:0.7">${isAM?"AM":"PM"}</span> ${s.time} <span class="tc-chip-cls" style="color:${col}">${shortClass(s.class_name)}</span><span style="font-size:9px;color:var(--text-muted);margin-left:3px">${pct(s.predicted_fill_rate)}</span></span>`;
  }).join("");
}

function renderTrainer(area,filtered){
  const locs=getActiveLocations();
  const allSlots=filterSlots(locs.flatMap(loc=>getSlots(loc)));

  const byTrainer={};
  allSlots.forEach(s=>{
    const t=s.trainer_1||"Unknown";
    if(!byTrainer[t])byTrainer[t]={
      byLoc:{},overallFill:s.trainer_overall_fill||0,overallCheckin:s.trainer_overall_checkin||0,
      totalSessions:s.trainer_total_sessions||0,classes:0,hours:0,score:0,predFill:0,protected:0,prime:0,
      violations:0,formats:{},locations:new Set(),am:0,pm:0
    };
    const d=byTrainer[t];
    const loc=s.location||locs[0]||"";
    if(!d.byLoc[loc])d.byLoc[loc]=[];
    d.byLoc[loc].push(s);
    d.classes++;
    d.hours+=(Number(s.duration_min||57)/60);
    d.score+=(s.score||0);
    d.predFill+=(s.predicted_fill_rate||0);
    d.protected+=["PINNED","PROTECT_EXACT","PROTECT","PROTECT_SLOT"].includes(s.recommendation)?1:0;
    d.prime+=isPrime(s.time)?1:0;
    d.violations+=(s.constraint_violations&&s.constraint_violations.length)?1:0;
    const fmtKey=canonicalMixClass(s.class_name);
    d.formats[fmtKey] = (d.formats[fmtKey]||0)+1;
    d.locations.add(loc);
    if(tmins(s.time)<13*60)d.am++;else d.pm++;
  });

  const sorted=Object.entries(byTrainer).sort((a,b)=>{
    const af=a[1].classes? a[1].predFill/a[1].classes : 0;
    const bf=b[1].classes? b[1].predFill/b[1].classes : 0;
    return (b[1].score/Math.max(b[1].classes,1)+bf*25+b[1].hours)-(a[1].score/Math.max(a[1].classes,1)+af*25+a[1].hours);
  });
  const totalClasses=allSlots.length;
  const trainerCount=sorted.length;
  const totalHours=sorted.reduce((s,[,d])=>s+d.hours,0);
  const avgFill=totalClasses?allSlots.reduce((s,x)=>s+(x.predicted_fill_rate||0),0)/totalClasses:0;
  const avgScore=totalClasses?allSlots.reduce((s,x)=>s+(x.score||0),0)/totalClasses:0;
  const protectedCount=allSlots.filter(s=>["PINNED","PROTECT_EXACT","PROTECT","PROTECT_SLOT"].includes(s.recommendation)).length;
  const multiLocCount=sorted.filter(([,d])=>d.locations.size>1).length;
  const topByFill=[...sorted].sort((a,b)=>(b[1].classes?b[1].predFill/b[1].classes:0)-(a[1].classes?a[1].predFill/a[1].classes:0)).slice(0,3);

  area.insertAdjacentHTML("beforeend",`<section class="trainer-command">
    <div class="trainer-command-head">
      <div>
        <div class="trainer-command-title">Trainer Command Board</div>
        <div class="trainer-command-sub">Weekly load, projected performance, studio split, class mix, and day-level teaching pattern for the selected schedule.</div>
      </div>
      <div class="trainer-command-meta">
        <span class="trainer-pill">${_loc||"All Studios"}</span>
        <span class="trainer-pill">${_iter||"Main"} View</span>
      </div>
    </div>
    <div class="trainer-kpi-grid">
      <div class="trainer-kpi"><span>Active Trainers</span><strong>${trainerCount}</strong><small>${multiLocCount} across multiple studios</small></div>
      <div class="trainer-kpi"><span>Scheduled Classes</span><strong>${totalClasses}</strong><small>${round1(totalHours)} teaching hours</small></div>
      <div class="trainer-kpi"><span>Avg Fill</span><strong style="color:${fillColor(avgFill)}">${pct(avgFill,1)}</strong><small>Projected schedule fill</small></div>
      <div class="trainer-kpi"><span>Avg Score</span><strong>${Math.round(avgScore)}</strong><small>Mean optimizer score</small></div>
      <div class="trainer-kpi"><span>Protected Slots</span><strong>${protectedCount}</strong><small>Pinned or protected classes</small></div>
      <div class="trainer-kpi"><span>Peak Coverage</span><strong>${allSlots.filter(s=>isPrime(s.time)).length}</strong><small>Prime-time trainer assignments</small></div>
    </div>
    <div class="trainer-spotlight">
      ${topByFill.map(([name,d],i)=>{
        const fill=d.classes?d.predFill/d.classes:0;
        return`<button class="trainer-spot-card" type="button" data-trainer="${rvEscapeAttr(name)}" onclick="toggleTrainerFilter('${String(name).replace(/'/g,"\\'")}',event)">
          <span class="trainer-spot-rank">${i+1}</span>
          <span class="cc-avatar" style="width:34px;height:34px;font-size:10px">${trainerImage(name)?`<img src="${trainerImage(name)}" alt="${rvEscapeAttr(name)}">`:trainerInitials(name)}</span>
          <span style="min-width:0;flex:1">
            <span class="trainer-spot-name">${rvEscapeHtml(name)}</span>
            <span class="trainer-spot-meta">${pct(fill,1)} fill · ${d.classes} classes · ${round1(d.hours)}h</span>
          </span>
        </button>`;
      }).join("")}
    </div>
  </section>`);

  const grid=document.createElement("div");
  grid.className="trainer-board";

  if(!sorted.length){
    grid.innerHTML=`<div class="trainer-empty">No trainer assignments match the current filters.</div>`;
    area.appendChild(grid);
    return;
  }

  sorted.forEach(([trainer,d])=>{
    const overallFill=d.overallFill||0;
    const fc=fillColor(overallFill);
    const initials=trainerInitials(trainer);
    const allSlotsFT=Object.values(d.byLoc).flat();
    const hasPinned=allSlotsFT.some(s=>["PINNED","PROTECT_EXACT","PROTECT"].includes(s.recommendation));
    const tierNum=hasPinned?1:overallFill>=0.4?2:3;
    const tierCls=`t${tierNum}`;
    const weekClasses=allSlotsFT.length;
    const weekHours=allSlotsFT.reduce((s,x)=>s+(x.duration_min||57),0)/60;
    const avgPredFill=weekClasses?d.predFill/weekClasses:0;
    const avgScoreT=weekClasses?d.score/weekClasses:0;
    const workloadPct=Math.min(100,Math.round(weekHours/15*100));
    const workloadCls=weekHours<6||weekHours>14.5?"bad":(weekHours<9||weekHours>13?"warn":"");
    const formatTop=Object.entries(d.formats).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const riskLabel=d.violations?`${d.violations} review`:(d.am&&d.pm?"Split days":"Clean load");
    const protectedSlots=allSlotsFT.filter(s=>["PINNED","PROTECT_EXACT","PROTECT","PROTECT_SLOT"].includes(s.recommendation)).length;
    const primeShare=weekClasses?d.prime/weekClasses:0;
    const bestLoc=Object.entries(d.byLoc).sort((a,b)=>{
      const af=a[1].reduce((sum,x)=>sum+(x.predicted_fill_rate||0),0)/a[1].length;
      const bf=b[1].reduce((sum,x)=>sum+(x.predicted_fill_rate||0),0)/b[1].length;
      return bf-af;
    })[0];
    const bestLocName=bestLoc?bestLoc[0].split(",")[0]:"—";

    // Keep every location column on the same seven day rows so Mon/Tue/etc. align horizontally.
    const activeLocs=locs.filter(loc=>d.byLoc[loc]?.length);

    const card=document.createElement("div");
    card.className="tc tc-premium";
    card.style.cssText="overflow:visible";

    // Header row
    card.innerHTML=`
      <aside class="tc-profile">
        <div class="tc-profile-top">
          <div class="tc-avatar">${trainerImage(trainer)?`<img src="${trainerImage(trainer)}" alt="${rvEscapeAttr(trainer)}">`:initials}</div>
          <div style="min-width:0">
            <div class="tc-name">${rvEscapeHtml(trainer)}</div>
            <div class="tc-meta">${d.totalSessions||0} historic sessions · ${activeLocs.length} studio${activeLocs.length===1?"":"s"}</div>
            <span class="tier-badge ${tierCls}">Tier ${tierNum}</span>
          </div>
        </div>
        <div class="tc-profile-metrics">
          <div class="tc-profile-metric"><span>Week Load</span><strong>${round1(weekHours)}h</strong></div>
          <div class="tc-profile-metric"><span>Classes</span><strong>${weekClasses}</strong></div>
          <div class="tc-profile-metric"><span>Historic Fill</span><strong style="color:${fc}">${pct(overallFill,1)}</strong></div>
          <div class="tc-profile-metric"><span>Avg Check-in</span><strong>${round1(d.overallCheckin)}</strong></div>
        </div>
        <div class="tc-workload">
          <div class="tc-workload-top"><span>15h target utilization</span><span>${workloadPct}%</span></div>
          <div class="tc-workload-track"><div class="tc-workload-fill ${workloadCls}" style="width:${workloadPct}%"></div></div>
        </div>
      </aside>
      <main class="tc-main">
        <div class="tc-main-top">
          <div class="tc-signal-row">
            <div class="tc-signal"><span>Projected Fill</span><strong style="color:${fillColor(avgPredFill)}">${pct(avgPredFill,1)}</strong></div>
            <div class="tc-signal"><span>Avg Score</span><strong>${Math.round(avgScoreT)}</strong></div>
            <div class="tc-signal"><span>Prime Slots</span><strong>${d.prime}</strong></div>
            <div class="tc-signal"><span>Status</span><strong>${riskLabel}</strong></div>
          </div>
          <div class="tc-format-row">
            ${formatTop.map(([cls,count])=>`<span class="tc-format-pill" style="color:${classColor(cls)}">${shortClass(cls)} · ${count}</span>`).join("")}
          </div>
        </div>
        <div class="tc-insight-row">
          <div class="tc-insight"><span>Protected</span><strong>${protectedSlots} slots</strong></div>
          <div class="tc-insight"><span>AM / PM</span><strong>${d.am} / ${d.pm}</strong></div>
          <div class="tc-insight"><span>Prime Share</span><strong>${pct(primeShare,0)}</strong></div>
          <div class="tc-insight"><span>Best Studio</span><strong>${rvEscapeHtml(bestLocName)}</strong></div>
        </div>
        <div class="tv-loc-cols" style="grid-template-columns:${activeLocs.map(()=>"minmax(250px,1fr)").join(" ")}">
          ${activeLocs.map(loc=>{
            const lc=LOC_COLORS[loc]||{bg:"#F9FAFB",fg:"#374151",border:"#E5E7EB",tag:loc.slice(0,2)};
            const locSlots=d.byLoc[loc];
            const avgFill=locSlots.reduce((s,x)=>s+(x.predicted_fill_rate||0),0)/locSlots.length;
            const locHours=locSlots.reduce((s,x)=>s+(x.duration_min||57),0)/60;
            const byDay3={};DAY_ORDER.forEach(day=>byDay3[day]=[]);
            locSlots.forEach(s=>{if(byDay3[s.day_of_week])byDay3[s.day_of_week].push(s)});
            const dayRows=DAY_ORDER.map(day=>{
              const dayS=byDay3[day];
              if(!dayS.length){
                return`<div class="tv-day-row">
                  <div class="tv-day-label">${day.slice(0,3)}</div>
                  <div class="tv-day-empty">—</div>
                </div>`;
              }
              const hasAM=dayS.some(s=>tmins(s.time)<13*60);
              const hasPM=dayS.some(s=>tmins(s.time)>=13*60);
              const shiftTag=hasAM&&hasPM?`<span class="tv-shift-tag conflict">AM+PM</span>`:(hasAM?`<span class="tv-shift-tag">AM</span>`:`<span class="tv-shift-tag">PM</span>`);
              return`<div class="tv-day-row">
                <div class="tv-day-label">${day.slice(0,3)}${shiftTag}</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px">${makeTrainerDayChips(dayS)}</div>
              </div>`;
            }).join("");
            return`<div class="tv-loc-panel">
              <div class="tv-loc-head">
                <div class="tv-loc-title">${lc.tag} · ${loc.split(",")[0]}</div>
                <div class="tv-loc-meta">
                  <span style="font-size:10px;font-weight:900;color:${fillColor(avgFill)}">${pct(avgFill,1)}</span>
                  <span>${locSlots.length} classes</span>
                  <span>${round1(locHours)}h</span>
                </div>
              </div>
              <div class="tv-loc-body">${dayRows}</div>
            </div>`;
          }).join("")}
          ${activeLocs.length===0?`<div style="color:var(--text-muted);font-size:12px;padding:12px">No classes scheduled this week</div>`:""}
        </div>
      </main>`;
    grid.appendChild(card);
  });

  area.appendChild(grid);
}

// ============================================================
// CROSS-LOCATION VIEW
// ============================================================
function renderCrossLocation(area, locOverride=null, title="Multi-Location Schedule", activeView="cross", includeSummary=true){
  const cityMap = {
    "Kwality House, Kemps Corner": "Mumbai",
    "Supreme HQ, Bandra": "Mumbai",
    "Kenkere House": "Bengaluru",
    "Courtside": "Bengaluru",
    "Copper & Cloves": "Bengaluru"
  };
  let locs=locOverride||getActiveLocations();
  if(locs.length===0){area.textContent="No location data.";return}
  locs = locs.sort((a,b)=>{
    const cA = cityMap[a]||"Z";
    const cB = cityMap[b]||"Z";
    if (cA !== cB) return cA.localeCompare(cB);
    return a.localeCompare(b);
  });

  const filteredByLoc={};
  locs.forEach(loc=>{filteredByLoc[loc]=filterSlots(getSlots(loc));});
  const allFiltered=locs.flatMap(loc=>filteredByLoc[loc]);
  if(includeSummary){
    renderStatsRow(area,allFiltered);
    renderTrainerWorkloadOverview(area,allFiltered);
  }

  // Build lookup: loc -> day -> time -> [slots]
  const lookup={};
  locs.forEach(loc=>{
    lookup[loc]={};
    DAY_ORDER.forEach(day=>{lookup[loc][day]={};});
    filteredByLoc[loc].forEach(s=>{
      const t=s.time||"00:00";
      if(!lookup[loc][s.day_of_week])lookup[loc][s.day_of_week]={};
      if(!lookup[loc][s.day_of_week][t])lookup[loc][s.day_of_week][t]=[];
      lookup[loc][s.day_of_week][t].push(s);
    });
  });

  // Day + loc counts
  const dayCnt={};
  DAY_ORDER.forEach(d=>{dayCnt[d]=0;});
  allFiltered.forEach(s=>{dayCnt[s.day_of_week]=(dayCnt[s.day_of_week]||0)+1;});

  // All times sorted
  const allTimes=[...new Set(allFiltered.map(s=>s.time||"00:00"))].sort();

  const locCls={"Kwality House, Kemps Corner":"kw","Supreme HQ, Bandra":"su","Kenkere House":"ke","Courtside":"kw","Copper & Cloves":"ke"};
  const locShort={"Kwality House, Kemps Corner":"KW","Supreme HQ, Bandra":"SU","Kenkere House":"KE","Courtside":"CS","Copper & Cloves":"CC"};
  const mlLocColWidth=132;
  const mlDayMinWidth=Math.max(mlLocColWidth,locs.length*mlLocColWidth);
  const matrixId=String(title||"matrix").toLowerCase().replace(/[^a-z0-9]+/g,"-");

  // Track expanded day format panels
  const expandedDays=new Set();

  const card=document.createElement("div");
  card.className="planner-card";
  card.innerHTML=plannerViewHeader(title,activeView);

  const outer=document.createElement("div");
  outer.className="ml-outer";
  const inner=document.createElement("div");
  inner.className="ml-inner";

  // ─── STICKY HEADER ────────────────────────────────────────
  const hdr=document.createElement("div");
  hdr.className="ml-hdr";

  // Row 1: Time corner + Day headers
  const row1=document.createElement("div");
  row1.className="ml-hdr-row1";
  const cornerCell=document.createElement("div");
  cornerCell.className="ml-time-col";
  cornerCell.style.cssText="display:flex;align-items:center;justify-content:center;padding:8px 4px;border-bottom:1px solid #E2E8F0";
  cornerCell.innerHTML=`<span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94A3B8">Time</span>`;
  row1.appendChild(cornerCell);

  DAY_ORDER.forEach(day=>{
    const cnt=dayCnt[day]||0;
    const th=document.createElement("div");
    th.className="ml-day-th";
    th.style.minWidth=`${mlDayMinWidth}px`;
    th.id=`ml-day-th-${matrixId}-${day}`;
    th.innerHTML=`<div class="ml-day-th-inner">
      <span class="ml-day-th-name">${day.slice(0,3).toUpperCase()}</span>
      <span style="font-size:10px;color:#475569;margin-left:4px">${day}</span>
      <span class="ml-day-th-count">${cnt}</span>
      <span style="font-size:9px;color:#93C5FD;margin-left:4px">▾</span>
    </div>
    <div class="ml-day-fmt" id="ml-fmt-${matrixId}-${day}"></div>`;
    th.querySelector(".ml-day-th-inner").onclick=()=>{
      const fmtEl=document.getElementById(`ml-fmt-${matrixId}-${day}`);
      if(!fmtEl)return;
      if(fmtEl.classList.contains("open")){
        fmtEl.classList.remove("open");
        expandedDays.delete(day);
      } else {
        // Build format breakdown
        const daySlots=allFiltered.filter(s=>s.day_of_week===day);
        const fmtCounts={};
        daySlots.forEach(s=>{fmtCounts[s.class_name||"Unknown"]=(fmtCounts[s.class_name||"Unknown"]||0)+1;});
        const sorted=Object.entries(fmtCounts).sort((a,b)=>b[1]-a[1]);
        fmtEl.innerHTML=`<div class="ml-day-fmt-title">Format Mix (${sorted.length} classes)</div>`+
          sorted.map(([cls,cnt])=>{
            const bg=FAM_BG[getFamily(cls)]||"#F8FAFC";
            const col=FAM_COLOR[getFamily(cls)]||"#6B7280";
            return`<div class="ml-day-fmt-item" style="background:${bg}">
              <span style="font-size:10px;color:#334155;font-weight:600">${displayClass(cls)}</span>
              <span class="ml-day-fmt-count" style="background:${col};color:var(--bg)">${cnt}</span>
            </div>`;
          }).join("");
        fmtEl.classList.add("open");
        expandedDays.add(day);
      }
    };
    row1.appendChild(th);
  });
  hdr.appendChild(row1);

  // Row 2: Empty time col + location sub-headers per day
  const row2=document.createElement("div");
  row2.className="ml-hdr-row2";
  const corner2=document.createElement("div");
  corner2.className="ml-time-col";
  corner2.style.cssText="padding:4px;border-bottom:0";
  row2.appendChild(corner2);
  DAY_ORDER.forEach(day=>{
    const daySection=document.createElement("div");
    daySection.style.cssText=`flex:1;min-width:${mlDayMinWidth}px;border-right:1px solid #E2E8F0;display:flex`;
    locs.forEach((loc,i)=>{
      const sub=document.createElement("div");
      sub.className=`ml-loc-subhdr ${locCls[loc]||""}`;
      sub.style.cssText=`flex:1;text-align:center;font-size:11px;font-weight:900;padding:6px;border-right:1px solid #F1F5F9;display:flex;flex-direction:column;gap:2px`;
      const city = cityMap[loc]||"";
      const locDayCnt=(filteredByLoc[loc]||[]).filter(s=>s.day_of_week===day).length;
      sub.innerHTML=`<div style="font-size:7.5px;color:#94A3B8;letter-spacing:0.04em;text-transform:uppercase">${city}</div><div title="${loc}">${locShort[loc]||loc.slice(0,2)} <span style="font-weight:500;opacity:.8;font-size:9px">(${locDayCnt})</span></div>`;
      daySection.appendChild(sub);
    });
    row2.appendChild(daySection);
  });
  hdr.appendChild(row2);
  inner.appendChild(hdr);

  // ─── BODY ROWS ────────────────────────────────────────────
  allTimes.forEach(t=>{
    const slotsAtTime=allFiltered.filter(s=>s.time===t);
    const hasClasses=slotsAtTime.length>0;
    const isPr=isPrime(t);

    const row=document.createElement("div");
    row.className=`ml-body-row ${hasClasses?"has-classes":"no-classes"}`;

    // Time label cell
    const timeCell=document.createElement("div");
    timeCell.className=`ml-time-cell ${hasClasses?"has-classes":"no-classes"}`;
    if(isPr)timeCell.style.background="linear-gradient(135deg,#FFFBEB,#FEF3C7)";
    timeCell.innerHTML=`<div>
      <div class="ml-time-label${hasClasses?"":" no-classes"}" style="${isPr?"color:#D97706":""}">
        ${t}${isPr?`<span style="display:block;font-size:7px;color:#D97706;font-weight:700">PRIME</span>`:""}
      </div>
      ${hasClasses?`<div class="ml-time-count">${slotsAtTime.length}</div>`:""}
    </div>`;
    row.appendChild(timeCell);

    // Day sections
    DAY_ORDER.forEach(day=>{
      const daySection=document.createElement("div");
      daySection.className="ml-day-section";
      daySection.style.minWidth=`${mlDayMinWidth}px`;
      locs.forEach(loc=>{
        const slotsHere=(lookup[loc][day]||{})[t]||[];
        const lc=locCls[loc]||"";
        const cell=document.createElement("div");
        cell.className=`ml-loc-cell ${lc}`;
        if(slotsHere.length===0){
          cell.classList.add("empty");
          cell.textContent="+";
        } else {
          slotsHere.forEach(s=>{
            const mini=makeClassCardMini(s,loc);
            cell.appendChild(mini);
          });
        }
        daySection.appendChild(cell);
      });
      row.appendChild(daySection);
    });

    inner.appendChild(row);
  });

  // Legend
  const leg=document.createElement("div");
  leg.className="legend";leg.style.cssText="padding:12px 16px;border-top:1px solid #E2E8F0";
  locs.forEach(loc=>{
    const lc=locCls[loc]||"";
    const colors={"kw":"#1D4ED8","su":"#6D28D9","ke":"#15803D"};
    leg.insertAdjacentHTML("beforeend",`<div class="li"><div class="ld" style="background:${colors[lc]||'#6B7280'}"></div>${locShort[loc]||loc}</div>`);
  });
  leg.insertAdjacentHTML("beforeend",`
    <div class="li"><div class="ld" style="background:#FEF3C7;border:1px solid #FDE68A"></div><span style="font-size:9px;color:#D97706;font-weight:700">PRIME</span></div>
    <div class="li"><div class="ld" style="background:#15803D"></div>≥60% fill</div>
    <div class="li"><div class="ld" style="background:#D97706"></div>40–60%</div>
    <div class="li"><div class="ld" style="background:#DC2626"></div>&lt;40%</div>
  `);

  outer.appendChild(inner);
  card.appendChild(outer);
  card.appendChild(leg);
  area.appendChild(card);
}

function renderIntraCity(area){
  const active=new Set(getActiveLocations());
  const groups=[
    {key:"mumbai",title:"Mumbai",locs:["Kwality House, Kemps Corner","Supreme HQ, Bandra","Courtside"],color:"#0F766E"},
    {key:"bengaluru",title:"Bengaluru",locs:["Kenkere House","Copper & Cloves"],color:"#7C3AED"},
  ].map(g=>({...g,locs:g.locs.filter(l=>active.has(l))})).filter(g=>g.locs.length);
  if(!groups.length){
    area.insertAdjacentHTML("beforeend",`<div class="planner-card" style="padding:20px;color:#64748B">No city studios selected.</div>`);
    return;
  }

  const citySlots={};
  groups.forEach(g=>{
    citySlots[g.key]=g.locs.flatMap(loc=>filterSlots(getSlots(loc)).map(s=>({...s,city:g.title,city_key:g.key})));
  });
  const all=groups.flatMap(g=>citySlots[g.key]);
  renderStatsRow(area,all);
  renderTrainerWorkloadOverview(area,all);

  const lookup={};
  groups.forEach(g=>{
    lookup[g.key]={};
    DAY_ORDER.forEach(day=>{lookup[g.key][day]={};});
    citySlots[g.key].forEach(s=>{
      const t=s.time||"00:00";
      if(!lookup[g.key][s.day_of_week])lookup[g.key][s.day_of_week]={};
      if(!lookup[g.key][s.day_of_week][t])lookup[g.key][s.day_of_week][t]=[];
      lookup[g.key][s.day_of_week][t].push(s);
    });
  });

  const dayCnt={};
  DAY_ORDER.forEach(d=>{dayCnt[d]=0;});
  all.forEach(s=>{dayCnt[s.day_of_week]=(dayCnt[s.day_of_week]||0)+1;});
  const allTimes=[...new Set(all.map(s=>s.time||"00:00"))].sort();
  const cityColWidth=260;
  const dayMinWidth=groups.length*cityColWidth;
  const matrixId="intra-city";

  const card=document.createElement("div");
  card.className="planner-card";
  card.innerHTML=plannerViewHeader("Intra-City Schedule","city");

  const outer=document.createElement("div");
  outer.className="ml-outer";
  const inner=document.createElement("div");
  inner.className="ml-inner";
  const hdr=document.createElement("div");
  hdr.className="ml-hdr";

  const row1=document.createElement("div");
  row1.className="ml-hdr-row1";
  const cornerCell=document.createElement("div");
  cornerCell.className="ml-time-col";
  cornerCell.style.cssText="display:flex;align-items:center;justify-content:center;padding:8px 4px;border-bottom:1px solid #E2E8F0";
  cornerCell.innerHTML=`<span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94A3B8">Time</span>`;
  row1.appendChild(cornerCell);

  DAY_ORDER.forEach(day=>{
    const th=document.createElement("div");
    th.className="ml-day-th";
    th.style.minWidth=`${dayMinWidth}px`;
    th.innerHTML=`<div class="ml-day-th-inner">
      <span class="ml-day-th-name">${day.slice(0,3).toUpperCase()}</span>
      <span style="font-size:10px;color:#475569;margin-left:4px">${day}</span>
      <span class="ml-day-th-count">${dayCnt[day]||0}</span>
      <span style="font-size:9px;color:#93C5FD;margin-left:4px">▾</span>
    </div>
    <div class="ml-day-fmt" id="ml-fmt-${matrixId}-${day}"></div>`;
    th.querySelector(".ml-day-th-inner").onclick=()=>{
      const fmtEl=document.getElementById(`ml-fmt-${matrixId}-${day}`);
      if(!fmtEl)return;
      if(fmtEl.classList.contains("open")){fmtEl.classList.remove("open");return;}
      const daySlots=all.filter(s=>s.day_of_week===day);
      const cityCounts=groups.map(g=>`${g.title}: ${daySlots.filter(s=>s.city_key===g.key).length}`).join(" · ");
      const fmtCounts={};
      daySlots.forEach(s=>{fmtCounts[s.class_name||"Unknown"]=(fmtCounts[s.class_name||"Unknown"]||0)+1;});
      const sorted=Object.entries(fmtCounts).sort((a,b)=>b[1]-a[1]);
      fmtEl.innerHTML=`<div class="ml-day-fmt-title">${cityCounts}</div>`+
        sorted.map(([cls,cnt])=>{
          const bg=FAM_BG[getFamily(cls)]||"#F8FAFC";
          const col=FAM_COLOR[getFamily(cls)]||"#6B7280";
          return`<div class="ml-day-fmt-item" style="background:${bg}">
            <span style="font-size:10px;color:#334155;font-weight:600">${displayClass(cls)}</span>
            <span class="ml-day-fmt-count" style="background:${col};color:var(--bg)">${cnt}</span>
          </div>`;
        }).join("");
      fmtEl.classList.add("open");
    };
    row1.appendChild(th);
  });
  hdr.appendChild(row1);

  const row2=document.createElement("div");
  row2.className="ml-hdr-row2";
  const corner2=document.createElement("div");
  corner2.className="ml-time-col";
  corner2.style.cssText="padding:4px;border-bottom:0";
  row2.appendChild(corner2);
  DAY_ORDER.forEach(day=>{
    const daySection=document.createElement("div");
    daySection.style.cssText=`flex:1;min-width:${dayMinWidth}px;border-right:2px solid #CBD5E1;display:flex`;
    groups.forEach(g=>{
      const cnt=(citySlots[g.key]||[]).filter(s=>s.day_of_week===day).length;
      const sub=document.createElement("div");
      sub.className="ml-loc-subhdr";
      sub.style.cssText=`min-width:${cityColWidth}px;max-width:${cityColWidth}px;background:#fff;color:${g.color};border-bottom:2px solid ${g.color}33`;
      sub.innerHTML=`${g.title}<br><span style="font-weight:500;color:#64748B">${cnt} classes</span>`;
      daySection.appendChild(sub);
    });
    row2.appendChild(daySection);
  });
  hdr.appendChild(row2);
  inner.appendChild(hdr);

  allTimes.forEach(t=>{
    const slotsAtTime=all.filter(s=>s.time===t);
    const isPr=isPrime(t);
    const row=document.createElement("div");
    row.className="ml-body-row has-classes";
    const timeCell=document.createElement("div");
    timeCell.className="ml-time-cell has-classes";
    timeCell.innerHTML=`<div>
      <div class="ml-time-label" style="${isPr?"color:#D97706":""}">${t}${isPr?`<span style="display:block;font-size:7px;color:#D97706;font-weight:700">PRIME</span>`:""}</div>
      <div class="ml-time-count">${slotsAtTime.length}</div>
    </div>`;
    row.appendChild(timeCell);

    DAY_ORDER.forEach(day=>{
      const daySection=document.createElement("div");
      daySection.className="ml-day-section";
      daySection.style.minWidth=`${dayMinWidth}px`;
      groups.forEach(g=>{
        const slotsHere=(lookup[g.key][day]||{})[t]||[];
        const cell=document.createElement("div");
        cell.className="ml-loc-cell";
        cell.style.cssText=`min-width:${cityColWidth}px;max-width:${cityColWidth}px;background:#fff`;
        if(slotsHere.length===0){
          cell.classList.add("empty");
          cell.textContent="+";
        }else{
          slotsHere.sort((a,b)=>(a.location||"").localeCompare(b.location||"") || (b.score||0)-(a.score||0)).forEach(s=>{
            cell.appendChild(makeClassCardMini(s,s.location));
          });
        }
        daySection.appendChild(cell);
      });
      row.appendChild(daySection);
    });
    inner.appendChild(row);
  });

  const leg=document.createElement("div");
  leg.className="legend";
  leg.style.cssText="padding:12px 16px;border-top:1px solid #E2E8F0";
  groups.forEach(g=>{
    leg.insertAdjacentHTML("beforeend",`<div class="li"><div class="ld" style="background:${g.color}"></div>${g.title}: ${g.locs.map(l=>LOC_ABBR[l]||l).join(", ")}</div>`);
  });
  leg.insertAdjacentHTML("beforeend",`<div class="li"><div class="ld" style="background:#FEF3C7;border:1px solid #FDE68A"></div><span style="font-size:9px;color:#D97706;font-weight:700">PRIME</span></div>`);

  outer.appendChild(inner);
  card.appendChild(outer);
  card.appendChild(leg);
  area.appendChild(card);
}

// ============================================================
// ANALYTICS VIEW
// ============================================================
function buildActionableInsights(locs,filtered){
  const insights=[];
  const low=filtered.filter(s=>(s.predicted_fill_rate||0)<0.28).sort((a,b)=>(a.predicted_fill_rate||0)-(b.predicted_fill_rate||0))[0];
  if(low)insights.push({
    id:`remove-low-${low.location}-${low.day_of_week}-${low.time}-${low.class_name}-${low.trainer_1}`,
    type:"remove",
    slot:slotIdentity(low),
    tone:"warn",
    title:"Remove weakest fill slot",
    body:`${displayClass(low.class_name)} at ${LOC_SHORT[low.location]||low.location} ${low.day_of_week} ${low.time} is projected at ${pct(low.predicted_fill_rate||0)} fill. Removing it reduces low-confidence inventory.`,
    cta:"Remove class"
  });

  const bySameSlot={};
  filtered.forEach(s=>{
    const key=[s.location,s.day_of_week,s.time,canonicalMixClass(s.class_name)].join("|");
    (bySameSlot[key]||(bySameSlot[key]=[])).push(s);
  });
  const duplicate=Object.values(bySameSlot).find(rows=>rows.length>1);
  if(duplicate){
    const weakest=duplicate.slice().sort((a,b)=>(a.score||0)-(b.score||0))[0];
    insights.push({
      id:`remove-duplicate-${weakest.location}-${weakest.day_of_week}-${weakest.time}-${weakest.class_name}-${weakest.trainer_1}`,
      type:"remove",
      slot:slotIdentity(weakest),
      tone:"warn",
      title:"Reduce duplicate format pressure",
      body:`${duplicate.length} similar ${displayClass(weakest.class_name)} classes sit at ${LOC_SHORT[weakest.location]||weakest.location} ${weakest.day_of_week} ${weakest.time}. Remove the lowest-scoring duplicate to clean the slot.`,
      cta:"Remove duplicate"
    });
  }

  const movable=filtered.filter(s=>(s.score||0)<45).sort((a,b)=>(a.score||0)-(b.score||0))[0];
  if(movable){
    const locSlots=getSlots(movable.location);
    const occupied=new Set(locSlots.map(s=>`${s.day_of_week}|${s.time}`));
    const candidateTimes=[...new Set(locSlots.map(s=>s.time).filter(Boolean))].sort();
    let target=null;
    for(const day of DAY_ORDER){
      for(const time of candidateTimes){
        if(!occupied.has(`${day}|${time}`)){
          target={location:movable.location,day_of_week:day,time,date:(SCHEDULE_DATA.day_dates||{})[day]||movable.date||""};
          break;
        }
      }
      if(target)break;
    }
    if(target)insights.push({
      id:`move-low-${movable.location}-${movable.day_of_week}-${movable.time}-${movable.class_name}-${movable.trainer_1}`,
      type:"move",
      slot:slotIdentity(movable),
      target,
      title:"Move low-score class to open slot",
      body:`${displayClass(movable.class_name)} scores ${Math.round(movable.score||0)}/100 at ${movable.day_of_week} ${movable.time}. Move it to the first open slot in ${LOC_SHORT[movable.location]||movable.location}.`,
      cta:`Move to ${target.day_of_week} ${target.time}`
    });
  }

  const trainerLoad={};
  filtered.forEach(s=>{if(s.trainer_1)trainerLoad[s.trainer_1]=(trainerLoad[s.trainer_1]||0)+1;});
  const overloaded=Object.entries(trainerLoad).sort((a,b)=>b[1]-a[1])[0];
  if(overloaded&&overloaded[1]>=12){
    const slot=filtered.filter(s=>s.trainer_1===overloaded[0]).sort((a,b)=>(a.score||0)-(b.score||0))[0];
    if(slot)insights.push({
      id:`remove-load-${slot.location}-${slot.day_of_week}-${slot.time}-${slot.class_name}-${slot.trainer_1}`,
      type:"remove",
      slot:slotIdentity(slot),
      title:"Reduce trainer overload",
      body:`${overloaded[0]} has ${overloaded[1]} classes in the active view. Remove their lowest-scoring class to rebalance load.`,
      cta:"Remove lowest class"
    });
  }

  return insights.filter(i=>!_dismissedInsightIds.has(i.id)).slice(0,6);
}

async function applyAnalyticsInsight(encoded,btn){
  const insight=JSON.parse(decodeURIComponent(encoded));
  const original=btn?btn.textContent:"";
  if(btn){btn.disabled=true;btn.textContent="Applying…";}
  try{
    if(insight.type==="remove"){
      const resp=await schedulerFetch("/api/remove-class",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({iteration:_iter,slot:insight.slot})});
      const data=await resp.json();
      if(!resp.ok||data.error)throw new Error(data.error||"Could not apply insight");
      updateClientScheduleRemove(insight.slot);
    }else if(insight.type==="move"){
      const resp=await schedulerFetch("/api/move-class",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({iteration:_iter,slot:insight.slot,target:insight.target})});
      const data=await resp.json();
      if(!resp.ok||data.error)throw new Error(data.error||"Could not apply insight");
      updateClientScheduleMove(insight.slot,insight.target,data.slot);
    }
    _dismissedInsightIds.add(insight.id);
    renderView();
  }catch(err){
    if(btn){btn.disabled=false;btn.textContent=original;}
    alert(err.message||"Could not apply insight");
  }
}

function renderAnalytics(area,allLocSlots){
  const locs=getActiveLocations();
  const slots=locs.flatMap(loc=>getSlots(loc));
  const filtered=filterSlots(slots);
  renderStatsRow(area,filtered);

  const grid=document.createElement("div");
  grid.className="analytics-grid";

  // Opportunities card (full width)
  const opp=document.createElement("div");
  opp.className="ac span2";
  const insightData=buildActionableInsights(locs,filtered);
  opp.innerHTML=`<div class="ac-title">Actionable Schedule Insights</div>
    <div class="analytics-action-grid">
      ${insightData.map((o,i)=>{
        const payload=encodeURIComponent(JSON.stringify(o));
        return`<div class="opp-item${o.tone==="warn"||i%2===1?" warn":""}">
          <div class="opp-kicker">${o.type==="move"?"Move recommendation":"Schedule cleanup"}</div>
          <div style="font-size:13px;font-weight:900;color:#0F172A;margin-bottom:5px">${rvEscapeHtml(o.title)}</div>
          <div class="opp-text">${rvEscapeHtml(o.body)}</div>
          <button class="opp-action-btn" onclick="applyAnalyticsInsight('${payload}',this)">${rvEscapeHtml(o.cta)}</button>
        </div>`;
      }).join("")}
    </div>
    ${insightData.length===0?"<div style='font-size:12px;color:var(--text-muted)'>No actionable issues found for the active filters.</div>":""}`;
  grid.appendChild(opp);

  // Class mix per location
  locs.forEach(loc=>{
    const locSlots=filterSlots(getSlots(loc));
    const mixCounts={};
    locSlots.forEach(s=>{const cn=canonicalMixClass(s.class_name||"Unknown");mixCounts[cn]=(mixCounts[cn]||0)+1});
    const total=locSlots.length;
    const sorted=Object.entries(mixCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));

    const card=document.createElement("div");
    card.className="ac";
    card.innerHTML=`<div class="ac-title">📊 ${LOC_SHORT[loc]||loc} — Class Mix</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:10px">${total} classes · Week of ${WEEK_LABEL||""}</div>
      ${sorted.map(([cn,cnt])=>{
        const pctV=total?(cnt/total):0;
        const fam=getFamily(cn);
        const col=FAM_COLOR[fam]||FAM_COLOR.default;
        return`<div class="mix-row">
          <div class="mix-name">${displayClass(cn)}</div>
          <div class="mix-bar-bg"><div class="mix-bar-fill" style="width:${Math.round(pctV*100)}%;background:${col}"></div></div>
          <div class="mix-pct">${Math.round(pctV*100)}%</div>
          <div class="mix-cnt">${cnt}</div>
        </div>`;
      }).join("")}`;
    grid.appendChild(card);
  });

  // Day-of-week fill rate chart (full width)
  const dayCard=document.createElement("div");
  dayCard.className="ac span2";
  const dayFills={};const dayCounts={};
  DAY_ORDER.forEach(d=>{dayFills[d]=0;dayCounts[d]=0});
  filtered.forEach(s=>{if(s.day_of_week){dayFills[s.day_of_week]+=(s.predicted_fill_rate||0);dayCounts[s.day_of_week]++}});
  const maxFill=Math.max(...DAY_ORDER.map(d=>dayCounts[d]?dayFills[d]/dayCounts[d]:0));
  dayCard.innerHTML=`<div class="ac-title">📅 Fill Rate by Day of Week (All Locations)</div>
    <div class="day-bars">
      ${DAY_ORDER.map((d,i)=>{
        const avg=dayCounts[d]?dayFills[d]/dayCounts[d]:0;
        const h=maxFill>0?Math.round(avg/maxFill*80):0;
        const col=fillColor(avg);
        return`<div class="day-bar-col">
          <div class="day-bar-val" style="font-size:9px;color:${col};font-weight:700">${pct(avg)}</div>
          <div class="day-bar-fill" style="height:${h}px;background:${col};border-radius:var(--r4) var(--r4) 0 0;width:100%"></div>
          <div class="day-bar-lbl">${DAY_SHORT[i]}</div>
        </div>`;
      }).join("")}
    </div>`;
  grid.appendChild(dayCard);

  // Trainer utilization card
  const trainersMap={};
  filtered.forEach(s=>{
    const t=s.trainer_1;if(!t)return;
    if(!trainersMap[t])trainersMap[t]={classes:0,fill:0,checkin:0,sessions:s.trainer_overall_fill||0,overallFill:s.trainer_overall_fill||0};
    trainersMap[t].classes++;trainersMap[t].fill+=(s.predicted_fill_rate||0);
  });
  const trainerList=Object.entries(trainersMap).sort((a,b)=>b[1].overallFill-a[1].overallFill).slice(0,15);
  const maxTrainerFill=Math.max(...trainerList.map(([,d])=>d.overallFill));

  const utilCard=document.createElement("div");
  utilCard.className="ac span2";
  utilCard.innerHTML=`<div class="ac-title">👤 Trainer Performance Overview (Top 15)</div>
    <div style="display:grid;grid-template-columns:130px 40px 40px 50px 1fr;gap:8px;padding:6px 0;border-bottom:2px solid var(--border);font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em">
      <span>Trainer</span><span style="text-align:center">Classes</span><span style="text-align:center">Avg Fill</span><span></span><span>Utilization</span>
    </div>
    ${trainerList.map(([name,d])=>{
      const avgF=d.classes?d.fill/d.classes:0;
      const fc=fillColor(d.overallFill);
      const barW=maxTrainerFill>0?Math.round(d.overallFill/maxTrainerFill*100):0;
      return`<div class="util-row">
        <span style="font-size:12px;font-weight:600;color:var(--text)">${name}</span>
        <span style="text-align:center;font-size:12px;font-weight:600">${d.classes}</span>
        <span style="text-align:center;font-size:12px;font-weight:700;color:${fc}">${pct(d.overallFill)}</span>
        <span></span>
        <div class="util-bar-bg"><div class="util-bar-fill" style="width:${barW}%;background:${fc}"></div></div>
      </div>`;
    }).join("")}`;
  grid.appendChild(utilCard);

  // Score distribution histogram
  const scoreCard=document.createElement("div");
  scoreCard.className="ac";
  const buckets=new Array(10).fill(0);
  const allScores=filtered.map(s=>s.score||0);
  allScores.forEach(sc=>{const b=Math.min(9,Math.floor(sc/10));buckets[b]++});
  const maxBucket=Math.max(...buckets);
  const bucketColors=["#DC2626","#DC2626","#D97706","#D97706","#D97706","#1D4ED8","#1D4ED8","#15803D","#15803D","#15803D"];
  scoreCard.innerHTML=`<div class="ac-title">📈 Score Distribution</div>
    <div class="score-hist">
      ${buckets.map((cnt,i)=>{
        const h=maxBucket>0?Math.round(cnt/maxBucket*60):0;
        return`<div class="sh-col">
          <span style="font-size:9px;color:var(--text-muted)">${cnt}</span>
          <div class="sh-bar" style="height:${h}px;background:${bucketColors[i]};border-radius:var(--r4) var(--r4) 0 0;width:100%;min-height:2px"></div>
          <span class="sh-lbl">${i*10}–${i*10+9}</span>
        </div>`;
      }).join("")}
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px">
      Median: <strong>${allScores.length?Math.round(allScores.sort((a,b)=>a-b)[Math.floor(allScores.length/2)]):0}</strong> ·
      Mean: <strong>${allScores.length?Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length):0}</strong> ·
      Protected: <strong>${filtered.filter(s=>s.recommendation==="PROTECT_EXACT"||s.recommendation==="PINNED").length}</strong>
    </div>`;
  grid.appendChild(scoreCard);

  // Constraint violations card
  const violSlots=filtered.filter(s=>s.constraint_violations&&s.constraint_violations.length>0);
  const violCard=document.createElement("div");
  violCard.className="ac";
  if(violSlots.length===0){
    violCard.innerHTML=`<div class="ac-title">✅ Constraint Violations</div><div style="color:var(--green);font-size:13px;font-weight:600;padding:10px 0">No violations detected</div>`;
  } else {
    const violMap={};
    violSlots.forEach(s=>(s.constraint_violations||[]).forEach(v=>{violMap[v]=(violMap[v]||0)+1}));
    violCard.innerHTML=`<div class="ac-title">⚠️ Constraint Violations (${violSlots.length} slots)</div>`+
      Object.entries(violMap).sort((a,b)=>b[1]-a[1]).map(([v,cnt])=>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-size:11px">
           <span style="color:var(--red)">${v}</span><strong style="color:var(--red)">${cnt}×</strong>
         </div>`).join("");
  }
  grid.appendChild(violCard);

  area.appendChild(grid);
}

// ============================================================
// MODAL
// ============================================================
const TRAINER_IMAGE_MAP={
  "anisha":"/images/001-1_Anisha-1-e1590837044475.jpg",
  "atulan":"/images/002-Atulan-Image-1.jpg",
  "cauveri":"/images/003-Cauveri-1.jpg",
  "kajol":"/images/004-Kajol-Kanchan-1.jpg",
  "kanchan":"/images/004-Kajol-Kanchan-1.jpg",
  "karan bhatia":"/images/005-Karan-Bhatia-1-1.jpeg",
  "karanvir":"/images/Karanvir.jpg",
  "karanvir bhatia":"/images/Karanvir.jpg",
  "mrigakshi":"/images/007-Mrigakshi-Image-2.jpg",
  "pranjali":"/images/008-Pranjali-Image-1.jpg",
  "pushyank":"/images/009-Pushyank-Nahar-1.jpeg",
  "reshma":"/images/010-Reshma-Image-3.jpg",
  "richard":"/images/011-Richard-Image-3.jpg",
  "rohan":"/images/012-Rohan-Image-3.jpg",
  "saniya":"/images/013-Saniya-Image-1.jpg",
  "shruti":"/images/014-Shruti-Kulkarni.jpeg",
  "vivaran":"/images/015-Vivaran-Image-4.jpg",
  "anmol":"/images/Anmol.jpeg",
  "bret":"/images/Bret.jpeg",
  "raunak":"/images/Raunak.jpeg",
  "simonelle":"/images/Simonelle.jpeg",
  "simran":"/images/Simran.jpeg",
  "sovena":"/images/Sovena.jpeg",
  "veena":"/images/Veena.jpeg",
  "chaitanya":"/images/Chaitanya.jpg",
  "chaitanya nahar":"/images/Chaitanya.jpg",
  "siddhartha":"/images/Siddhartha.jpg",
  "siddhartha kusuma":"/images/Siddhartha.jpg"
};
const MISSING_TRAINER_IMAGES=new Set([]);

function trainerImage(name){
  const lower=String(name||"").toLowerCase().trim();
  if(!lower)return null;
  if(TRAINER_IMAGE_MAP[lower]&&!MISSING_TRAINER_IMAGES.has(TRAINER_IMAGE_MAP[lower]))return TRAINER_IMAGE_MAP[lower];
  const words=lower.split(/\s+/);
  for(const w of words){if(w.length>2&&TRAINER_IMAGE_MAP[w]&&!MISSING_TRAINER_IMAGES.has(TRAINER_IMAGE_MAP[w]))return TRAINER_IMAGE_MAP[w];}
  for(const [key,src] of Object.entries(TRAINER_IMAGE_MAP)){if(lower.includes(key)&&!MISSING_TRAINER_IMAGES.has(src))return src;}
  return null;
}

function inr(n,max=0){
  const v=Number(n||0);
  return "₹"+v.toLocaleString("en-IN",{maximumFractionDigits:max});
}
function inrShort(n){
  const v=Number(n||0);
  if(Math.abs(v)>=100000)return "₹"+(v/100000).toFixed(v>=1000000?1:1)+"L";
  if(Math.abs(v)>=1000)return "₹"+(v/1000).toFixed(v>=10000?0:1)+"K";
  return inr(v,0);
}
function n1(n){return Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:1});}
function classSlotAvgCheckin(s){
  const slot=s?.slot_avg_checkin;
  const hist=s?.historical_avg_checkin;
  const detail=s?.slot_historic_detail||s?.historic_detail||{};
  return Number(
    (slot!=null&&slot>0?slot:null) ??
    (hist!=null&&hist>0?hist:null) ??
    detail.avg_checked_in ??
    detail.avg_attendance ??
    0
  );
}
function classSlotFill(s){
  try{
    const modalFill=drillMetrics(s).fill;
    if(Number.isFinite(modalFill)&&modalFill>0)return Number(modalFill);
  }catch(e){}
  const slot=s?.slot_avg_fill_rate;
  const hist=s?.historical_avg_fill;
  const detail=s?.slot_historic_detail||s?.historic_detail||{};
  return Number(
    (slot!=null&&slot>0?slot:null) ??
    (hist!=null&&hist>0?hist:null) ??
    detail.avg_fill_rate ??
    s?.predicted_fill_rate ??
    0
  );
}

function variantClassKey(name){
  return String(name||"").toLowerCase().replace(/^studio\s+/,"").replace(/\s+/g," ").trim();
}

function drillFallbackRowsFromHistoricCache(s){
  const targetClass=variantClassKey(s?.class_name||s?.class||"");
  const targetLocation=String(s?.location||"").trim();
  const targetDay=String(s?.day_of_week||s?.day||"").trim();
  const targetTime=String(s?.time||"").slice(0,5);
  const rankings=Array.isArray(_historicSlotsCache?.class_slot_ranking)?_historicSlotsCache.class_slot_ranking:[];
  const match=rankings.find(r=>
    variantClassKey(r.class||r.class_name)===targetClass &&
    String(r.location||"").trim()===targetLocation &&
    String(r.day_name||r.day||"").trim()===targetDay &&
    String(r.time||"").slice(0,5)===targetTime
  );
  return historicCompletedRows(((match||{}).historic_detail||{}).individual_sessions||[]);
}

function historicCompletedRows(rows){
  const today=new Date();
  today.setHours(0,0,0,0);
  return (Array.isArray(rows)?rows:[]).filter(r=>{
    const d=new Date(String(r?.date||"").slice(0,10)+"T00:00:00");
    return !Number.isNaN(d.getTime()) && d < today;
  });
}

function drillSessionRows(s){
  const slotRows=historicCompletedRows(((s.slot_historic_detail||{}).individual_sessions)||[]);
  const exactRows=historicCompletedRows(((s.historic_detail||{}).individual_sessions)||[]);
  const fallbackRows=drillFallbackRowsFromHistoricCache(s);
  const rows=(slotRows.length?slotRows:(exactRows.length?exactRows:fallbackRows));
  return rows.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
}

function drillMetrics(s){
  const rows=drillSessionRows(s);
  const slotH=s.slot_historic_detail||{};
  const exactH=s.historic_detail||{};
  // Pick best available historic object; prefer slot-level, fall to exact, fall to empty
  let h=(slotH.session_rows||slotH.avg_checked_in!=null)?slotH:(exactH.session_rows||exactH.avg_checked_in!=null)?exactH:{};
  if(Array.isArray(h.individual_sessions)&&!rows.length){
    h={...h,session_rows:0,avg_checked_in:0,avg_booked:0,avg_capacity:0,avg_fill_rate:0,avg_revenue:0,total_revenue:0,avg_late_cancel_rate:0,avg_no_show_rate:0};
  }
  const isSynthetic=!!(h&&h._synthetic);

  const sessions=rows.length || Number(h.session_rows||0) || Number(s.slot_sessions||s.historical_session_count||0);
  // Prefer exact field order: slot-level > hist object > slot top-level > historical top-level > trainer overall
  const avgChecked=Number(
    h.avg_checked_in ?? h.avg_attendance ??
    s.slot_avg_checkin ??
    (s.historical_avg_checkin>0?s.historical_avg_checkin:null) ??
    0
  );
  const avgBooked=Number(h.avg_booked ?? 0);
  const avgCapacity=Number(h.avg_capacity ?? s.capacity ?? 0);
  const avgRevenue=Number(h.avg_revenue ?? 0);

  // Aggregate metrics
  const checked=rows.length?rows.reduce((a,r)=>a+Number(r.checked_in||0),0):Math.round(avgChecked*Math.max(sessions,1));
  const booked=rows.length?rows.reduce((a,r)=>a+Number(r.booked||0),0):Math.round(avgBooked*Math.max(sessions,1));
  const cap=rows.length?rows.reduce((a,r)=>a+Number(r.capacity||0),0):Math.round(avgCapacity*Math.max(sessions,1));
  const cancels=rows.length?rows.reduce((a,r)=>a+Number(r.late_cancelled||0),0):Math.round(Number(h.avg_late_cancel_rate||0)*(booked||Math.max(sessions,1)));
  const revenue=rows.length?rows.reduce((a,r)=>a+Number(r.revenue||0),0):(Number(h.total_revenue||0)||Math.round(avgRevenue*Math.max(sessions,1)));

  const useTrainerFallback = false;
  const displayCheckin = sessions?checked/Math.max(sessions,1):avgChecked;
  const displayFill = cap>0?checked/cap:Number(h.avg_fill_rate ?? s.slot_avg_fill_rate ?? s.historical_avg_fill ?? s.predicted_fill_rate ?? 0);

  const nonEmpty=rows.length?rows.filter(r=>Number(r.checked_in||0)>0).length:(avgChecked>0?sessions:0);
  const avgAttend=useTrainerFallback?displayCheckin:(sessions?checked/Math.max(sessions,1):avgChecked);
  const avgNoEmpty=nonEmpty?checked/nonEmpty:avgAttend;
  const fill=displayFill;
  const cancelRate=booked>0?cancels/booked:Number(h.avg_late_cancel_rate ?? s.historical_late_cancel_rate ?? 0);
  const revSeat=checked>0?revenue/checked:0;
  const waitlisted=rows.reduce((a,r)=>a+Number(r.waitlisted||0),0);

  const source=rows.length&&((s.slot_historic_detail||{}).individual_sessions||[]).length?"Unique ID 1 slot history":
    rows.length?"Unique ID 2 exact history":
    isSynthetic?"Synthesized from slot-level fields":
    useTrainerFallback?"Trainer-level aggregate (no slot history)":"Grouped history fallback";

  return{rows,sessions:useTrainerFallback?s.trainer_total_sessions||0:sessions,nonEmpty,empty:Math.max(0,sessions-nonEmpty),checked,booked,cap,cancels,revenue,avgAttend,avgNoEmpty,fill,cancelRate,revSeat,waitlisted,source,useTrainerFallback,isSynthetic};
}

async function ensureReplacementConfigLoaded(){
  const tasks=[];
  if(!_settTrainerProfiles){
    tasks.push(schedulerFetch("/api/trainer-profiles").then(r=>r.json()).then(d=>{
      _settTrainerProfiles=Array.isArray(d)?d:(Array.isArray(d?.data)?d.data:[]);
    }).catch(()=>{_settTrainerProfiles=[];}));
  }
  if(!_settSchedConfig){
    tasks.push(schedulerFetch("/api/schedule-config").then(r=>r.json()).then(d=>{
      _settSchedConfig=(d&&!d.error)?d:{targets:{},manual_protected:[],manual_excluded:[],leave_periods:[],off_days:[],class_mix:{},inactive_trainers:[]};
    }).catch(()=>{_settSchedConfig={targets:{},manual_protected:[],manual_excluded:[],leave_periods:[],off_days:[],class_mix:{},inactive_trainers:[]};}));
  }
  if(tasks.length)await Promise.all(tasks);
}

function scoreFallbackHtml(s,m){
  const components=[
    ["Average Attendance",n1(m.avgAttend),"75 point component · grouped attendance context"],
    ["Capacity Fill Rate",pct(m.fill,1),"15 point component · checked-in divided by capacity"],
    ["Revenue / Session",inr(m.sessions?m.revenue/m.sessions:0,0),"7 point component · normalized within studio scoring"],
    ["Historical Sessions",m.sessions,"3 point component · sample-depth context"]
  ];
  return`<div class="score-component-grid drill-score-grid">
    ${components.map(([label,value,meta])=>`<div class="score-component">
      <div class="score-component-top"><span class="score-component-label">${label}</span><span class="score-component-points">${value}</span></div>
      <div class="score-component-meta">${meta}<br>Source: ${rvEscapeHtml(m.source||"available schedule context")}</div>
    </div>`).join("")}
  </div>`;
}

function trainerRankingFromRows(rows){
  const map={};
  rows.forEach(r=>{
    const t=r.trainer||"Unknown";
    if(!map[t])map[t]={trainer:t,sessions:0,checked:0,booked:0,cap:0,revenue:0,cancels:0};
    map[t].sessions++;map[t].checked+=Number(r.checked_in||0);map[t].booked+=Number(r.booked||0);
    map[t].cap+=Number(r.capacity||0);map[t].revenue+=Number(r.revenue||0);map[t].cancels+=Number(r.late_cancelled||0);
  });
  return Object.values(map).map(t=>({
    ...t,
    avg:t.sessions?t.checked/t.sessions:0,
    fill:t.cap?t.checked/t.cap:0,
    revSession:t.sessions?t.revenue/t.sessions:0,
    score:(t.avg*0.45)+(t.fill*20)+(Math.min(t.sessions,20)*0.6)+(t.revSession/1000)
  })).sort((a,b)=>b.score-a.score);
}

function drillRecommendations(s,m){
  const recs=[];
  const rows=m.rows;
  if(rows.length>=4){
    const mid=Math.floor(rows.length/2);
    const first=rows.slice(mid);
    const second=rows.slice(0,mid);
    const favg=first.length?first.reduce((a,r)=>a+Number(r.checked_in||0),0)/first.length:0;
    const savg=second.length?second.reduce((a,r)=>a+Number(r.checked_in||0),0)/second.length:0;
    if(favg>0&&savg<favg*0.9){
      recs.push({priority:"high",title:"Declining Attendance Trend",body:`Attendance has declined by ${Math.abs((savg-favg)/favg*100).toFixed(1)}% between older and recent sessions. Investigate trainer fit, class fatigue, timing, and competing classes.`,data:`First half avg: ${favg.toFixed(1)} | Recent avg: ${savg.toFixed(1)}`});
    }
  }
  if(m.fill<0.5)recs.push({priority:"high",title:"Very Low Fill Rate",body:`Fill rate is ${pct(m.fill,1)}. Consider moving this class, testing a stronger trainer, reducing capacity, or replacing with a higher-ranked class family.`,data:`Checked-in: ${m.checked} | Capacity: ${m.cap || s.capacity || "n/a"}`});
  else if(m.fill>0.8)recs.push({priority:"low",title:"Protect High-Demand Slot",body:`Fill rate is ${pct(m.fill,1)}. Keep the class/time protected and prioritize the highest-ranked trainer who can teach within the rules.`,data:`Sessions: ${m.sessions} | Avg attendance: ${m.avgAttend.toFixed(1)}`});
  if(m.cancelRate>0.12)recs.push({priority:"medium",title:"Cancellation Friction",body:`Cancel rate is ${pct(m.cancelRate,1)}. Review reminders, package mix, weather/timing friction, and whether this slot attracts unreliable bookings.`,data:`Late cancels: ${m.cancels} | Booked: ${m.booked}`});
  if(m.revSeat>0&&m.revSeat<900)recs.push({priority:"medium",title:"Low Revenue Per Seat",body:`Revenue per attended seat is ${inr(m.revSeat,0)}. Review discounts, package mix, intro offers, and whether a premium class can improve yield.`,data:`Total revenue: ${inr(m.revenue,0)} | Check-ins: ${m.checked}`});
  if(!recs.length)recs.push({priority:"low",title:"Stable Slot",body:"Historical metrics do not show a major attendance, fill, cancellation, or revenue warning. Continue monitoring after the next generated schedule.",data:`Score: ${Math.round(s.score||0)}/100 | Sessions: ${m.sessions}`});
  return recs.slice(0,4);
}

function openSlotList(slots){
  if(!slots||!slots.length)return;
  if(slots.length===1){openModal(slots[0]);return;}
  const backdrop=document.createElement("div");
  backdrop.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.6);z-index:10000;backdrop-filter:blur(4px)";
  const el=document.createElement("div");
  el.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10001;background:var(--surface);box-shadow:0 24px 64px rgba(0,0,0,0.4);border-radius:24px;min-width:320px;padding:24px;border:1px solid var(--border)";
  el.innerHTML=`
    <h2 style="font-size:16px;font-weight:900;margin-bottom:16px;color:var(--text);display:flex;justify-content:space-between;align-items:center">
       <span>Slot Selection</span>
       <span style="font-size:10px;color:var(--text-muted);background:var(--surface2);padding:2px 8px;border-radius:999px">${slots.length} Classes</span>
    </h2>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${slots.map(s=>`
        <div style="padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:all 0.2s" 
             onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--surface)'" 
             onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'"
             onclick='backdrop.click();openModal(${rvEscapeAttr(JSON.stringify(s))})'>
          <div>
            <div style="font-size:13px;font-weight:800;color:var(--text)">${displayClass(s.class_name)}</div>
            <div style="font-size:10px;color:var(--text-muted);font-weight:700;margin-top:2px">${s.location.split(",")[0]} <span style="color:var(--text-light);margin:0 4px">•</span> ${s.trainer}</div>
          </div>
          <div style="color:#3B82F6;font-size:18px;font-weight:300">→</div>
        </div>
      `).join("")}
    </div>
  `;
  backdrop.onclick=()=>{el.remove();backdrop.remove();};
  document.body.appendChild(backdrop);
  document.body.appendChild(el);
}

function openModal(s){
  const m=drillMetrics(s);
  const rows=m.rows;
  const trainers=trainerRankingFromRows(rows);
  const recs=drillRecommendations(s,m);
  const rec=s.recommendation||"CONSIDER";
  const statusCls=(rec==="DROP"||m.fill<0.35)?"bad":(rec==="PINNED"||rec==="PROTECT"||rec==="PROTECT_EXACT"||m.fill>=0.75)?"good":"warn";
  const statusLabel=recLabel(rec);
  const titleKey=`${displayClass(s.class_name)}|${s.day_of_week||""}|${s.time||""}|${s.location||""}`;
  const heroImg=trainerImage(s.trainer_1);
  const heroFallback=trainerInitials(s.trainer_1||s.class_name);
  const activeTrainer=heroImg?`<img src="${heroImg}" alt="${rvEscapeAttr(s.trainer_1||"Trainer")}">`:`<div class="drill-photo-fallback">${heroFallback}</div>`;
  const score=Math.round(s.score||0);
  const slotTop=(Array.isArray(s.slot_top_trainers)?s.slot_top_trainers:[]).map(t=>({
    trainer:t.trainer||"Unknown",
    sessions:t.session_count||0,
    checked:Math.round((t.avg_attendance||0)*(t.session_count||0)),
    avg:t.avg_attendance||0,
    fill:t.avg_fill_rate||0,
    revenue:(t.avg_revenue||0)*(t.session_count||0),
    revSession:t.avg_revenue||0,
    score:t.score||0
  }));
  // When no slot-specific history, use trainer-level aggregate as fallback trainer row
  const fallbackTrainerRow={
    trainer:s.trainer_1||"Unknown",
    sessions:s.historical_session_count||0,
    checked:Math.round((s.historical_avg_checkin||0)*(s.historical_session_count||1)),
    avg:s.historical_avg_checkin||0,
    fill:s.historical_avg_fill||0,
    revenue:(s.historic_detail||{}).total_revenue||0,
    revSession:(s.historic_detail||{}).avg_revenue||0,
    score:s.score||0,
    _isFallback:true
  };
  const topTrainerRows=(trainers.length?trainers:(slotTop.length?slotTop:[fallbackTrainerRow])).slice(0,3);
  const scoreGrid=scoreBreakdownHtml(s.score_breakdown).replace("score-component-grid","score-component-grid drill-score-grid");
  const kpiCards=[
    {label:"Sessions",value:m.sessions,always:true},
    {label:"Non-Empty",value:m.nonEmpty,show:m.nonEmpty>0},
    {label:"Empty",value:m.empty,show:m.empty>0},
    {label:"Total Capacity",value:m.cap||((s.capacity||0)*m.sessions)||"—",always:true},
    {label:"Booked",value:m.booked||"—",show:m.booked>0},
    {label:"Checked In",value:m.checked||Math.round(m.avgAttend*m.sessions),always:true},
    {label:"Late Cancels",value:m.cancels,show:m.cancels>0},
    {label:"Avg Attend",value:n1(m.avgAttend),always:true},
    {label:"Avg (No Empty)",value:n1(m.avgNoEmpty),show:m.nonEmpty>0&&Math.abs(m.avgNoEmpty-m.avgAttend)>.1},
    {label:"Waitlisted",value:m.waitlisted,show:m.waitlisted>0},
    {label:"Fill Rate",value:pct(m.fill,1),always:true},
    {label:"Cancel Rate",value:pct(m.cancelRate,1),show:m.cancelRate>0},
    {label:"Predicted Fill",value:pct(s.predicted_fill_rate||0,1),always:true},
    {label:"Revenue",value:inr(m.revenue,0),show:m.revenue>0},
    {label:"Rev / Seat",value:inr(m.revSeat,0),show:m.revSeat>0}
  ].filter(k=>k.always||k.show);
  const box=document.getElementById("modal-box");
  box.className="modal-box drill-modal";
  box.innerHTML=`
    <div class="drill-layout">
      <aside class="drill-rail">
        <button class="drill-close" onclick="closeModal()">×</button>
        <div class="drill-kicker">Class Profile</div>
        <div class="drill-rail-title">${displayClass(s.class_name)}</div>
        <div class="drill-photo">
          ${activeTrainer}
          <div class="drill-photo-caption"><span>Primary Trainer</span><strong>${s.trainer_1||"Multiple Trainers"}</strong></div>
        </div>
        <div class="drill-rail-kpis">
          <div class="drill-rail-kpi"><span>Sessions</span><strong>${m.sessions}</strong></div>
          <div class="drill-rail-kpi"><span>Avg Check-In</span><strong>${n1(m.avgAttend)}</strong></div>
          <div class="drill-rail-kpi"><span>Fill Rate</span><strong>${pct(m.fill,1)}</strong></div>
          <div class="drill-rail-kpi"><span>Cancel Rate</span><strong style="color:${m.cancelRate>.12?"#FCA5A5":"var(--text)"}">${pct(m.cancelRate,1)}</strong></div>
          <div class="drill-rail-kpi wide"><span>Total Revenue</span><strong style="color:var(--green)">${inrShort(m.revenue)}</strong></div>
        </div>
        <div class="drill-side-card">
          <h3>Class Details</h3>
          <div class="drill-detail-row"><span>Class</span><strong>${displayClass(s.class_name)}</strong></div>
          <div class="drill-detail-row"><span>Primary Trainer</span><strong>${s.trainer_1||"—"}</strong></div>
          <div class="drill-detail-row"><span>Location</span><strong>${s.location||"—"}</strong></div>
          <div class="drill-detail-row"><span>Day / Time</span><strong>${s.day_of_week||"—"} ${s.time||""}</strong></div>
          <div class="drill-detail-row"><span>Room</span><strong>${s.room||"—"}</strong></div>
          <div class="drill-detail-row"><span>Rev / Session</span><strong>${inr(m.sessions?m.revenue/m.sessions:0,0)}</strong></div>
          <div class="drill-detail-row"><span>Rev / Seat</span><strong>${inr(m.revSeat,0)}</strong></div>
          <div class="drill-detail-row"><span>Score</span><strong>${score}/100</strong></div>
        </div>
      </aside>
      <main class="drill-main">
        <div class="drill-main-head">
          <div>
            <div class="drill-dash-label">Analytics Dashboard</div>
            <h2>${rvEscapeHtml(titleKey)}</h2>
            <div class="drill-sub">Advanced profile & performance analytics</div>
          </div>
          <div class="drill-status-stack">
            <span class="drill-pill ${statusCls}">${statusLabel}</span>
            ${isPrime(s.time)?`<span class="drill-pill warn">Prime Slot</span>`:""}
            ${s.above_studio_avg?`<span class="drill-pill good">Above Studio Avg</span>`:""}
            ${s.trainer_1?`<button id="drill-trainer-toggle" style="padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface2);color:var(--text-2);font-size:10px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer" onclick="drillToggleTrainer(${JSON.stringify(s).replace(/"/g,'&quot;')})" title="Toggle between all historical data and data for ${rvEscapeAttr(s.trainer_1)} only">All data</button>`:""}
          </div>
        </div>
        <section style="background:var(--surface2);border:1px solid var(--border-strong);border-radius:14px;padding:14px 18px;margin-bottom:14px">
          <div style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.09em;color:var(--primary);margin-bottom:5px;display:flex;align-items:center;gap:6px">
            <span style="font-size:12px">ⓘ</span> Selection Reason & Rule Compliance
          </div>
          <div style="font-size:13.5px;font-weight:800;color:var(--text);line-height:1.45;font-family:'Plus Jakarta Sans',sans-serif">
            ${rvEscapeHtml(scheduleReasonPlain(s))}
          </div>
        </section>

        ${m.isSynthetic?`<div style="background:var(--primary-light);border:1px solid var(--primary-mid);border-radius:var(--r8);padding:8px 14px;margin-bottom:12px;font-size:11px;color:var(--primary)">
          ℹ No trainer-specific history found. Metrics use same class, location, day and time history across other trainers.
        </div>`:""}
        <div class="drill-kpi-grid">
          ${kpiCards.map(k=>`<div class="drill-kpi"><span>${k.label}</span><strong>${k.value}</strong>${m.useTrainerFallback&&k.label==="Sessions"?`<small>trainer total</small>`:""}</div>`).join("")}
        </div>

        <section class="drill-section">
          <div class="drill-section-head"><div class="drill-section-title">Top ${Math.min(3,topTrainerRows.length)} Trainers for this Class Slot</div><span class="drill-insight-count">${trainers.length||slotTop.length||1} ranked</span></div>
          <div class="drill-top-list">
            ${topTrainerRows.map((t,i)=>`<div class="drill-trainer-card">
              <div class="drill-trainer-rank"><div class="drill-rank-dot">${i+1}</div><div><div class="drill-trainer-name">${rvEscapeHtml(t.trainer)}</div><div class="drill-trainer-sub">${t._isFallback?"trainer-level aggregate":t.sessions+" sessions"}</div></div></div>
              <div class="drill-trainer-row"><span>${t._isFallback?"All-location Check-ins":"Total Check-ins"}</span><strong>${Math.round(t.checked||0)}</strong></div>
              <div class="drill-trainer-row"><span>Class Avg</span><strong>${n1(t.avg)}</strong></div>
              <div class="drill-trainer-row"><span>Avg Fill Rate</span><strong>${pct(t.fill,1)}</strong></div>
              <div class="drill-trainer-row"><span>Revenue / Session</span><strong>${inr(t.revSession,0)}</strong></div>
            </div>`).join("")}
          </div>
        </section>

        <section class="drill-section">
          <div class="drill-section-head"><div class="drill-section-title">AI-Powered Recommendations</div><span class="drill-insight-count">${recs.length} insights</span></div>
          <div class="drill-rec-list">
            ${recs.map(r=>`<div class="drill-rec ${r.priority}">
              <div class="drill-rec-top"><h4>${rvEscapeHtml(r.title)}</h4><span class="drill-priority ${r.priority}">${r.priority}</span></div>
              <p>${rvEscapeHtml(r.body)}</p>
              <div class="drill-rec-data">${rvEscapeHtml(r.data)}</div>
            </div>`).join("")}
          </div>
        </section>

        <section class="drill-section">
          <div class="drill-section-head"><div class="drill-section-title">Score Calculation</div><span class="drill-insight-count">${score}/100</span></div>
          ${scoreGrid||scoreFallbackHtml(s,m)}
        </section>

        <section class="drill-table-card">
          <div class="drill-table-head"><h3>Individual Class Sessions</h3><span class="drill-session-count">${rows.length} rows across trainers · totals always shown</span></div>
          <div class="drill-session-wrap">
            ${drillSessionTableHtml(rows)}
          </div>
        </section>
      </main>
    </div>`;

  document.getElementById("modal-overlay").classList.add("open");
}

// ============================================================
// ADD MANUAL CLASS MODAL
// ============================================================
async function ensureHistoricSlotsLoaded(){
  if(_historicSlotsCache)return _historicSlotsCache;
  try{
    const d=await schedulerFetch("/api/historic-slots").then(r=>r.json());
    _historicSlotsCache=d||{};
  }catch(e){
    _historicSlotsCache={class_slot_ranking:[],slot_group_ranking:[],trainer_metrics:[],class_metrics:[]};
  }
  return _historicSlotsCache;
}

const MANUAL_CLASS_FORMATS=[
  "Studio Barre 57","Studio Barre 57 Express","Studio Cardio Barre","Studio Cardio Barre Express","Studio Cardio Barre Plus",
  "Studio Mat 57","Studio Mat 57 Express","Studio Back Body Blaze","Studio Back Body Blaze Express","Studio FIT","Studio FIT Express",
  "Studio PowerCycle","Studio PowerCycle Express","Studio Strength Lab","Studio Strength Lab (Push)","Studio Strength Lab (Pull)",
  "Studio Strength Lab (Full Body)","Studio Recovery","Studio Amped Up!","Studio HIIT","Studio Foundations","Private Session"
];
const MANUAL_CLASS_LOCATION_LIMITS={
  "Studio PowerCycle":["Kwality House, Kemps Corner","Supreme HQ, Bandra"],
  "Studio PowerCycle Express":["Kwality House, Kemps Corner","Supreme HQ, Bandra"],
  "Studio Strength Lab":["Kwality House, Kemps Corner"],
  "Studio Strength Lab (Push)":["Kwality House, Kemps Corner"],
  "Studio Strength Lab (Pull)":["Kwality House, Kemps Corner"],
  "Studio Strength Lab (Full Body)":["Kwality House, Kemps Corner"]
};
function manualNormName(name){return String(name||"").replace(/\s+/g," ").trim();}
function manualSameTrainerName(a,b){return manualNormName(a).toLowerCase()===manualNormName(b).toLowerCase();}
function manualClassMixHardBlocked(loc,cls){
  const entry=(_settSchedConfig?.class_mix||{})[loc]?.[cls];
  if(!entry)return false;
  return Number(entry.min||0)===0&&Number(entry.max||0)===0;
}
function manualClassAllowedAtLocation(loc,cls){
  if(!cls)return false;
  if(cls==="Private Session")return true;
  const allowed=MANUAL_CLASS_LOCATION_LIMITS[cls];
  if(allowed&&!allowed.includes(loc))return false;
  if(loc==="Kenkere House"&&(cls.includes("PowerCycle")||cls.includes("Strength Lab")))return false;
  if(loc==="Copper & Cloves"&&(cls.includes("PowerCycle")||cls.includes("Strength Lab")))return false;
  if(cls.includes("Strength Lab")&&loc!=="Kwality House, Kemps Corner")return false;
  return !manualClassMixHardBlocked(loc,cls);
}
function manualClassOptions(loc){
  const slots=getAllLocSlots().filter(s=>!loc||s.location===loc).map(s=>s.class_name).filter(Boolean);
  return [...new Set([...MANUAL_CLASS_FORMATS,...slots])]
    .sort((a,b)=>displayClass(a).localeCompare(displayClass(b)));
}
function manualClassCountAtLocation(loc,cls){
  return getAllLocSlots().filter(s=>(s.location||"")===loc&&canonicalMixClass(s.class_name)===canonicalMixClass(cls)).length;
}
function manualRoomOptions(loc){
  const rooms=getAllLocSlots().filter(s=>!loc||s.location===loc).map(s=>s.room).filter(Boolean);
  const fallback=["Studio 1","Studio 2","PowerCycle Studio","Strength Lab"];
  return [...new Set([...rooms,...fallback])].filter(Boolean).sort();
}
function profileLocationData(profile,loc){
  const locations=profile?.locations||{};
  if(locations[loc])return locations[loc];
  const fallback=loc==="Courtside"
    ?["Kwality House, Kemps Corner","Supreme HQ, Bandra"]
    :loc==="Copper & Cloves"
      ?["Copper & Cloves","Kenkere House"]
      :[];
  const candidates=fallback.map(l=>locations[l]).filter(Boolean);
  if(!candidates.length)return null;
  return candidates.sort((a,b)=>(b.session_count||0)-(a.session_count||0))[0];
}
function manualQualKeyForClass(cn){
  const lower=String(cn||"").toLowerCase();
  if(lower.includes("powercycle")||lower.includes("power cycle"))return"powercycle";
  if(lower.includes("strength lab"))return"strength_lab";
  if(lower.includes("fit"))return"fit";
  if(lower.includes("mat 57"))return"mat_57";
  if(lower.includes("foundations"))return"foundations";
  if(lower.includes("pre/post")||lower.includes("pre post")||lower.includes("natal"))return"pre_post_natal";
  if(lower.includes("amped"))return"amped_up";
  if(lower.includes("hiit"))return"hiit";
  if(lower.includes("recovery"))return"recovery";
  if(lower.includes("back body blaze"))return"back_body_blaze";
  if(lower.includes("cardio barre"))return"cardio_barre";
  return"all_barre";
}
function manualHasExplicitQualifications(profile){
  const q=profile?.qualifications||{};
  return Object.values(q).some(Boolean);
}
function manualHasClassQualification(profile,cn){
  if(!profile)return false;
  const q=profile.qualifications||{};
  const key=manualQualKeyForClass(cn);
  if(q[key])return true;
  if(key==="powercycle"&&String(cn||"").toLowerCase().includes("express")&&q.express_cycle)return true;
  if(["all_barre","cardio_barre","mat_57"].includes(key)&&String(cn||"").toLowerCase().includes("express")&&q.express_barre)return true;
  return false;
}
function manualTrainerProfileFor(name){
  const target=manualNormName(name).toLowerCase();
  return (_settTrainerProfiles||[]).find(p=>manualNormName(p.name).toLowerCase()===target)||null;
}
function manualWindowsOverlap(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&bStart<aEnd;}
function manualSlotDuration(slot){return Number(slot?.duration_min||57);}
function manualLocationRegion(location){
  if(["Kwality House, Kemps Corner","Supreme HQ, Bandra"].includes(location))return"mumbai";
  if(["Kenkere House","Copper & Cloves"].includes(location))return"bengaluru";
  return location||"";
}
function manualViolatesLocationShiftLock(slot,trainerRows){
  const loc=slot.location||"";
  const day=slot.day_of_week||"";
  const slotMin=tmins(slot.time||"00:00");
  const shift=slotMin<13*60?"AM":"PM";
  const sameShift=trainerRows
    .filter(r=>(r.day_of_week||"")===day&&((tmins(r.time||"00:00")<13*60?"AM":"PM")===shift))
    .map(r=>({min:tmins(r.time||"00:00"),loc:r.location||""}));
  if(!sameShift.length)return"";
  if(sameShift.some(r=>manualLocationRegion(r.loc)!==manualLocationRegion(loc)))return"Already has a class in another city for this shift";
  const mainStudios=["Kwality House, Kemps Corner","Supreme HQ, Bandra"];
  const derivedStudios=["Courtside","Copper & Cloves"];
  const existingMain=sameShift.filter(r=>mainStudios.includes(r.loc)).map(r=>r.loc);
  if(mainStudios.includes(loc)){
    if(existingMain.length&&existingMain.some(x=>x!==loc))return"Already assigned to another main studio in this shift";
    if(sameShift.some(r=>derivedStudios.includes(r.loc)))return"Cannot return to a main studio after a pop-up studio";
  }else if(derivedStudios.includes(loc)){
    if(sameShift.some(r=>derivedStudios.includes(r.loc)))return"Already has a pop-up studio assignment in this shift";
    if(sameShift.some(r=>r.min>slotMin))return`${loc} must be the final stop in this shift`;
  }
  return"";
}
function manualClassMetric(loc,cls){
  return (_historicSlotsCache?.class_metrics||[]).find(c=>c.location===loc&&c.class===cls)||{};
}
function manualTrainerMetric(loc,trainer){
  const target=manualNormName(trainer).toLowerCase();
  return (_historicSlotsCache?.trainer_metrics||[]).find(t=>t.location===loc&&manualNormName(t.trainer).toLowerCase()===target)||{};
}
function manualClassTrainerMetric(loc,day,time,cls,trainer){
  const target=manualNormName(trainer).toLowerCase();
  const exact=(_historicSlotsCache?.class_slot_ranking||[]).find(r=>
    r.location===loc&&r.day_name===day&&r.time===time&&r.class===cls&&manualNormName(r.trainer).toLowerCase()===target
  );
  if(exact)return{...exact,source:"exact"};
  const slot=(_historicSlotsCache?.class_slot_ranking||[]).find(r=>r.location===loc&&r.day_name===day&&r.time===time&&r.class===cls);
  if(slot)return{...slot,source:"class-slot"};
  const cm=manualClassMetric(loc,cls);
  if(Object.keys(cm).length)return{avg_fill_rate:cm.avg_fill_rate,avg_checkin:cm.avg_checkin,session_count:cm.session_count,source:"class"};
  const tm=manualTrainerMetric(loc,trainer);
  return{avg_fill_rate:tm.trainer_fill_rate||0,avg_checkin:tm.trainer_avg_checkin||0,session_count:tm.trainer_session_count||0,source:tm.trainer_session_count?"trainer":"none"};
}
function manualTrainerWeeklyMinutes(trainer){
  return getAllLocSlots()
    .filter(r=>manualSameTrainerName(r.trainer_1,trainer))
    .reduce((sum,r)=>sum+manualSlotDuration(r),0);
}
function manualTrainerWarnings(ctx,cls,trainer){
  const loc=ctx.location||_loc||allLocations()[0]||"";
  const day=ctx.day_of_week||ctx.day||"";
  const time=ctx.time||"09:00";
  const duration=Number(document.getElementById("manual-duration")?.value||classDefaultDuration(cls));
  const start=tmins(time);
  const end=start+duration;
  const inactive=new Set(((_settSchedConfig||{}).inactive_trainers||[]).map(n=>manualNormName(n).toLowerCase()));
  const rows=getAllLocSlots();
  const profile=manualTrainerProfileFor(trainer);
  const profileLoc=profileLocationData(profile,loc);
  const warnings=[];
  if(!manualClassAllowedAtLocation(loc,cls))warnings.push(`${displayClass(cls)} is normally blocked by this location/class mix.`);
  if(!profile)warnings.push("No trainer profile found.");
  if(profile?.active===false||inactive.has(manualNormName(trainer).toLowerCase()))warnings.push("Trainer is marked inactive.");
  if(!profileLoc)warnings.push(`Trainer is not enabled for ${loc}.`);
  if(profile&&cls!=="Private Session"&&manualHasExplicitQualifications(profile)&&!manualHasClassQualification(profile,cls))warnings.push(`Trainer is not marked qualified for ${displayClass(cls)}.`);
  const days=profileLoc?.available_days||[];
  if(days.length&&!days.includes(day))warnings.push(`Trainer is not normally available on ${day}.`);
  const tw=profileLoc?.time_window||{};
  const winStart=tw.start||"06:00";
  const winEnd=tw.end||"22:00";
  if(start<tmins(winStart)||start>=tmins(winEnd))warnings.push(`Outside trainer time window ${winStart}-${winEnd}.`);
  const trainerRows=rows.filter(r=>manualSameTrainerName(r.trainer_1,trainer));
  const sameDayLoc=trainerRows.filter(r=>(r.location||"")===loc&&(r.day_of_week||"")===day);
  const maxDay=Number(profileLoc?.max_classes_per_day||4);
  if(sameDayLoc.length>=maxDay)warnings.push(`Trainer already has ${sameDayLoc.length}/${maxDay} classes at this location that day.`);
  if(trainerRows.some(r=>(r.day_of_week||"")===day&&manualWindowsOverlap(start,end,tmins(r.time||"00:00"),tmins(r.time||"00:00")+manualSlotDuration(r))))warnings.push("Trainer has an overlapping class.");
  const shift=start<13*60?"AM":"PM";
  const opposite=shift==="AM"?"PM":"AM";
  if(trainerRows.some(r=>(r.day_of_week||"")===day&&((tmins(r.time||"00:00")<13*60?"AM":"PM")===opposite)))warnings.push(`Trainer already has a ${opposite} class that day.`);
  const locationShift=manualViolatesLocationShiftLock({location:loc,day_of_week:day,time},trainerRows);
  if(locationShift)warnings.push(locationShift);
  const dailyMinutes=trainerRows.filter(r=>(r.day_of_week||"")===day).reduce((sum,r)=>sum+manualSlotDuration(r),0);
  if(dailyMinutes+duration>4*60)warnings.push("Would exceed the recommended 4h daily teaching cap.");
  const weeklyMinutes=manualTrainerWeeklyMinutes(trainer);
  if(weeklyMinutes+duration>15*60)warnings.push("Would exceed the recommended 15h weekly teaching cap.");
  return warnings;
}
function manualTrainerOptions(ctx,cls){
  const loc=ctx.location||_loc||allLocations()[0]||"";
  const day=ctx.day_of_week||ctx.day||"";
  const time=ctx.time||"09:00";
  const names=new Set([
    ...(_settTrainerProfiles||[]).map(p=>p.name).filter(Boolean),
    ...getAllLocSlots().map(s=>s.trainer_1).filter(Boolean)
  ]);
  return [...names].map(trainer=>{
    const metric=manualClassTrainerMetric(loc,day,time,cls,trainer);
    const warnings=manualTrainerWarnings(ctx,cls,trainer);
    const weeklyMinutes=manualTrainerWeeklyMinutes(trainer);
    const score=(Number(metric.avg_fill_rate||0)*55)+(Number(metric.avg_checkin||0)*3)+Math.min(20,Number(metric.session_count||0));
    return{trainer,metric,warnings,weeklyMinutes,score};
  }).sort((a,b)=>a.warnings.length-b.warnings.length||b.score-a.score||a.trainer.localeCompare(b.trainer));
}
function manualEligibleTrainerOptions(ctx,cls){
  const loc=ctx.location||_loc||allLocations()[0]||"";
  const day=ctx.day_of_week||ctx.day||"";
  const time=ctx.time||"09:00";
  const duration=Number(document.getElementById("manual-duration")?.value||classDefaultDuration(cls));
  const start=tmins(time);
  const end=start+duration;
  const inactive=new Set(((_settSchedConfig||{}).inactive_trainers||[]).map(n=>manualNormName(n).toLowerCase()));
  const rows=getAllLocSlots();
  const candidates=(_settTrainerProfiles||[])
    .map(profile=>{
      const trainer=profile.name||"";
      const profileLoc=profileLocationData(profile,loc);
      const reasons=[];
      if(!trainer)return null;
      if(profile.active===false||inactive.has(manualNormName(trainer).toLowerCase()))return null;
      if(!profileLoc)return null;
      if(cls!=="Private Session"&&manualHasExplicitQualifications(profile)&&!manualHasClassQualification(profile,cls))return null;
      const days=profileLoc.available_days||[];
      if(days.length&&!days.includes(day))return null;
      const tw=profileLoc.time_window||{};
      const winStart=tw.start||"06:00";
      const winEnd=tw.end||"22:00";
      if(start<tmins(winStart)||start>=tmins(winEnd))return null;
      const trainerRows=rows.filter(r=>manualSameTrainerName(r.trainer_1,trainer));
      const sameDayLoc=trainerRows.filter(r=>(r.location||"")===loc&&(r.day_of_week||"")===day);
      const maxDay=Number(profileLoc.max_classes_per_day||4);
      if(sameDayLoc.length>=maxDay)return null;
      if(trainerRows.some(r=>(r.day_of_week||"")===day&&manualWindowsOverlap(start,end,tmins(r.time||"00:00"),tmins(r.time||"00:00")+manualSlotDuration(r))))return null;
      const shift=start<13*60?"AM":"PM";
      const opposite=shift==="AM"?"PM":"AM";
      if(trainerRows.some(r=>(r.day_of_week||"")===day&&((tmins(r.time||"00:00")<13*60?"AM":"PM")===opposite)))return null;
      if(manualViolatesLocationShiftLock({location:loc,day_of_week:day,time},trainerRows))return null;
      const weeklyMinutes=trainerRows.reduce((sum,r)=>sum+manualSlotDuration(r),0);
      if(weeklyMinutes+duration>15*60)return null;
      const metric=manualClassTrainerMetric(loc,day,time,cls,trainer);
      if(metric.source==="exact")reasons.push("exact trainer-slot history");
      else if(metric.source==="class-slot")reasons.push("class-slot history");
      else if(metric.source==="class")reasons.push("class average");
      else if(metric.source==="trainer")reasons.push("trainer location average");
      const score=(Number(metric.avg_fill_rate||0)*55)+(Number(metric.avg_checkin||0)*3)+Math.min(20,Number(metric.session_count||0));
      return{trainer,metric,reasons,score};
    })
    .filter(Boolean)
    .sort((a,b)=>b.score-a.score||a.trainer.localeCompare(b.trainer));
  return candidates;
}
function classDefaultDuration(cls){
  const lower=String(cls||"").toLowerCase();
  if(lower.includes("powercycle express")||lower.includes("express")||lower.includes("sweat in 30"))return 30;
  if(lower.includes("powercycle"))return 45;
  if(lower.includes("hiit"))return 45;
  return 57;
}
function manualRoomAvailable(loc,day,time,room,duration){
  const start=tmins(time||"00:00");
  const end=start+Number(duration||57);
  return !getAllLocSlots().some(s=>
    (s.location||"")===loc&&(s.day_of_week||"")===day&&(s.room||"")===room&&
    manualWindowsOverlap(start,end,tmins(s.time||"00:00"),tmins(s.time||"00:00")+manualSlotDuration(s))
  );
}
function manualRecurringDays(ctx){
  const checked=[...document.querySelectorAll("[data-manual-repeat-day]:checked")].map(el=>el.value);
  return checked.length?checked:[ctx.day_of_week||ctx.day||""].filter(Boolean);
}
function historicSlotIntel(loc,day,time){
  const rows=(_historicSlotsCache?.slot_group_ranking||[]).filter(r=>r.location===loc&&r.day_name===day&&r.time===time);
  if(!rows.length)return null;
  return rows.sort((a,b)=>(b.score||0)-(a.score||0))[0];
}
function historicTimeIntel(loc,time){
  const rows=(_historicSlotsCache?.slot_group_ranking||[]).filter(r=>r.location===loc&&r.time===time);
  if(!rows.length)return null;
  const total=rows.reduce((a,r)=>a+(Number(r.session_count)||1),0)||rows.length;
  const weighted=(field)=>rows.reduce((a,r)=>a+(Number(r[field])||0)*(Number(r.session_count)||1),0)/total;
  const best=rows.slice().sort((a,b)=>(b.score||0)-(a.score||0))[0]||{};
  const days=[...new Set(rows.map(r=>r.day_name).filter(Boolean))].slice(0,4).join(", ");
  return{
    avg_attendance:weighted("avg_checkin")||weighted("avg_attendance"),
    avg_fill_rate:weighted("avg_fill_rate"),
    session_count:total,
    best_class:best.class||"",
    days
  };
}
function timeBadgeTooltip(loc,time){
  const intel=historicTimeIntel(loc,time);
  if(!intel)return`Historic data loading\n${time}`;
  return[
    `${time} historic slot average`,
    `Avg attendance: ${round1(intel.avg_attendance||0)}`,
    `Avg fill rate: ${pct(intel.avg_fill_rate||0,0)}`,
    `Sample: ${Math.round(intel.session_count||0)} classes${intel.days?` · ${intel.days}`:""}`,
    intel.best_class?`Best match: ${displayClass(intel.best_class)}`:""
  ].filter(Boolean).join("\n");
}
function emptySlotIntelHtml(r){
  const fill=r.avg_fill_rate||0;
  return`<div class="sg-empty-intel" title="Historic best: ${rvEscapeAttr(displayClass(r.class||''))}">
    <div class="sg-empty-intel-top">
      <div class="sg-empty-intel-title">Historic Slot</div>
      <div class="sg-empty-intel-score">${Math.round(r.score||0)}</div>
    </div>
    <div class="sg-empty-intel-metrics">
      <div class="sg-empty-intel-metric"><span>Avg In</span><strong>${round1(r.avg_checkin||r.avg_attendance||0)}</strong></div>
      <div class="sg-empty-intel-metric"><span>Fill</span><strong>${pct(fill,0)}</strong></div>
    </div>
    <div class="sg-empty-intel-class">${rvEscapeHtml(displayClass(r.class||""))} · ${r.session_count||0} hist</div>
  </div>`;
}
function emptySlotHoverHtml(intel,slotIntel,day,time){
  if(!intel){
    // No data at all — show a minimal placeholder so hover still shows something
    return`<div class="sg-empty-intel sg-empty-no-data"><div class="sg-empty-intel-title" style="text-align:center;padding:8px 0">No historic data</div></div>`;
  }
  const fill=intel.avg_fill_rate||0;
  const avgIn=round1(intel.avg_checkin||intel.avg_attendance||0);
  const sessions=Math.round(intel.session_count||0);
  const bestClass=intel.class||intel.best_class||"";
  const isSlot=!!slotIntel;
  const fillColor=fill>=0.6?"#15803D":fill>=0.4?"#D97706":fill>0?"#DC2626":"#94A3B8";
  const scope=isSlot?`${day} ${time}`:(intel.days||time||"this time");
  return`<div class="sg-empty-intel${isSlot?" sg-empty-slot-specific":""}">
    <div class="sg-empty-intel-top">
      <div class="sg-empty-intel-title">${isSlot?"Slot history":"Time avg"}</div>
      ${isSlot&&intel.score!=null?`<div class="sg-empty-intel-score">${Math.round(intel.score||0)}</div>`:""}
    </div>
    <div class="sg-empty-intel-metrics">
      <div class="sg-empty-intel-metric">
        <span>Avg Attend</span>
        <strong>${avgIn||"—"}</strong>
      </div>
      <div class="sg-empty-intel-metric">
        <span>Fill Rate</span>
        <strong style="color:${fillColor}">${fill>0?pct(fill,0):"—"}</strong>
      </div>
    </div>
    <div class="sg-empty-intel-class">${bestClass?rvEscapeHtml(displayClass(bestClass))+" · ":""}<span style="opacity:.7">${sessions} hist sessions</span></div>
  </div>`;
}
function manualSlotTemplate(ctx,cls,trainer,source,overrides={}){
  const loc=ctx.location||_loc||allLocations()[0]||"";
  const customClass=(document.getElementById("manual-custom-class")?.value||"").trim();
  const isPrivate=!!document.getElementById("manual-private-session")?.checked || !!overrides.is_private_session;
  const baseClass=cls||document.getElementById("manual-class")?.value||"Studio Mat 57";
  const className=isPrivate?`Private Session (${displayClass(baseClass)})`:(customClass||baseClass);
  const hist=source||{};
  const warnings=manualTrainerWarnings({...ctx,...overrides},baseClass,trainer);
  if(!manualClassAllowedAtLocation(loc,baseClass))warnings.unshift(`${displayClass(baseClass)} is normally blocked by location or class mix rules.`);
  const trainerMetric=(_historicSlotsCache?.trainer_metrics||[]).find(t=>t.location===loc&&String(t.trainer||"").trim().toLowerCase()===String(trainer||"").trim().toLowerCase())||{};
  const classMetric=(_historicSlotsCache?.class_metrics||[]).find(c=>c.location===loc&&c.class===baseClass)||{};
  return{
    location:loc,
    date:overrides.date??ctx.date??"",
    day_of_week:overrides.day_of_week??ctx.day_of_week??ctx.day??"",
    time:ctx.time||"09:00",
    class_name:className,
    private_session_format:isPrivate?baseClass:"",
    is_private_session:isPrivate,
    trainer_1:trainer||"",
    trainer_2:"",
    cover:"",
    room:document.getElementById("manual-room")?.value||manualRoomOptions(loc)[0]||"Studio 1",
    capacity:isPrivate?1:Number(document.getElementById("manual-capacity")?.value||22),
    duration_min:Number(document.getElementById("manual-duration")?.value||classDefaultDuration(baseClass)),
    predicted_fill_rate:hist.blended_fill||hist.avg_fill_rate||classMetric.avg_fill_rate||0.2,
    score:hist.score||58,
    recommendation:"MANUAL",
    is_experimental:false,
    scheduling_reason:[
      isPrivate?"Manual private session added from calendar":"Manual class added from calendar",
      warnings.length?`Manual override warnings: ${warnings.join("; ")}`:""
    ].filter(Boolean).join(" · "),
    historical_avg_fill:hist.avg_fill_rate||classMetric.avg_fill_rate||0,
    historical_avg_checkin:hist.avg_checkin||hist.avg_attendance||classMetric.avg_checkin||0,
    historical_session_count:hist.session_count||classMetric.session_count||0,
    historical_late_cancel_rate:0,
    historical_no_show_rate:0,
    score_breakdown:hist.score_breakdown||null,
    constraint_violations:[],
    trainer_overall_fill:trainerMetric.trainer_fill_rate||0,
    trainer_overall_checkin:trainerMetric.trainer_avg_checkin||0,
    trainer_total_sessions:trainerMetric.trainer_session_count||0,
    historic_detail:hist.historic_detail||null,
    slot_top_trainers:[],
    manual_added:true,
    manual_allow_rule_override:true,
    manual_override_warnings:warnings
  };
}
async function openAddClassModal(ctx){
  const box=document.getElementById("modal-box");
  box.className="modal-box";
  box.innerHTML=`<div class="modal-body" style="padding:28px;color:var(--text-muted);font-size:13px">Loading historic slot options…</div>`;
  document.getElementById("modal-overlay").classList.add("open");
  await ensureReplacementConfigLoaded();
  const hist=await ensureHistoricSlotsLoaded();
  const loc=ctx.location||_loc||allLocations()[0]||"";
  const day=ctx.day_of_week||ctx.day||"";
  const time=ctx.time||"";
  const exact=(hist.class_slot_ranking||[])
    .filter(r=>r.location===loc&&r.day_name===day&&r.time===time)
    .sort((a,b)=>(b.score||0)-(a.score||0))
    .slice(0,8);
  const classes=manualClassOptions(loc);
  const rooms=manualRoomOptions(loc);
  const defaultClass=classes.includes("Studio Barre 57")?"Studio Barre 57":(classes[0]||"Studio Mat 57");
  const dateText=ctx.date?new Date(ctx.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"";
  const dayOptions=(SCHEDULE_DATA.days||DAYS_ALL||["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]);
  const repeatHtml=dayOptions.map(d=>`<label style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:#475569"><input type="checkbox" data-manual-repeat-day value="${rvEscapeAttr(d)}" ${d===day?"checked":""}>${rvEscapeHtml(d.slice(0,3))}</label>`).join("");
  box.innerHTML=`
    <div class="modal-hdr">
      <div>
        <div class="modal-class-name">Add Class — ${day} ${time}</div>
        <div class="modal-meta">${rvEscapeHtml(loc)}${dateText?` · ${dateText}`:""}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
        <div class="manual-add-panel">
        <div class="manual-add-kicker">Schedule Fresh Class</div>
        <div class="manual-add-grid">
          <label class="manual-field manual-field-wide">Class<select class="sett-select" id="manual-class">${classes.map(c=>{
            const count=manualClassCountAtLocation(loc,c);
            return`<option value="${rvEscapeAttr(c)}" ${c===defaultClass?"selected":""}>${rvEscapeHtml(displayClass(c))} (${count} scheduled)</option>`;
          }).join("")}</select></label>
          <label class="manual-field manual-field-wide">Trainer<select class="sett-select" id="manual-trainer"></select></label>
          <label class="manual-field">Room<select class="sett-select" id="manual-room">${rooms.map(r=>`<option value="${rvEscapeAttr(r)}">${rvEscapeHtml(r)}</option>`).join("")}</select></label>
          <label class="manual-field">Capacity<input class="sett-input" id="manual-capacity" type="number" value="22" min="1"></label>
          <label class="manual-field">Duration<input class="sett-input" id="manual-duration" type="number" value="${classDefaultDuration(defaultClass)}" min="15"></label>
        </div>
        <div id="manual-trainer-help" class="manual-warning-box"></div>
        <label class="manual-field manual-custom-field">Custom Class Name<input class="sett-input" id="manual-custom-class" placeholder="Optional: enter a custom class name"></label>
        <div class="manual-muted">If custom class name is filled, it overrides the class dropdown and is saved into the schedule.</div>
        <div class="manual-toggle-row">
          <label><input type="checkbox" id="manual-private-session">Private session</label>
          <label><input type="checkbox" id="manual-recurring-session">Recurring</label>
          <div id="manual-repeat-days" class="manual-repeat-days">${repeatHtml}</div>
        </div>
        <button class="sett-save-btn manual-add-submit" id="manual-add-fresh">Add Fresh Class Anyway</button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Historic options for this exact studio/day/time. Click Add to schedule that class and trainer immediately.</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${exact.length?exact.map((r,i)=>{
          const fc=fillColor(r.blended_fill||r.avg_fill_rate||0);
          const payload=manualSlotTemplate(ctx,r.class,r.trainer,r);
          return`<div style="border:1px solid ${i===0?"#86EFAC":"var(--border)"};background:${i===0?"#F0FDF4":"var(--surface)"};border-radius:12px;padding:12px;display:flex;gap:12px;align-items:center">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:900;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif">${rvEscapeHtml(displayClass(r.class))}</div>
              <div style="font-size:11px;color:var(--text-2);margin-top:2px">${rvEscapeHtml(r.trainer||"—")}</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:7px;font-size:11px;color:var(--text-muted)">
                <strong style="color:${fc}">${pct(r.blended_fill||r.avg_fill_rate,1)} fill</strong>
                <span>${round1(r.avg_checkin||r.avg_attendance||0)} avg check-in</span>
                <span>${r.session_count||0} sessions</span>
                <span>Score ${Math.round(r.score||0)}</span>
                ${r.avg_revenue?`<span>₹${Math.round(r.avg_revenue).toLocaleString("en-IN")} avg revenue</span>`:""}
              </div>
            </div>
            <button type="button" data-add-class="${rvEscapeAttr(JSON.stringify(payload))}" style="border:0;background:var(--text);color:var(--bg);border-radius:10px;padding:9px 12px;font-size:11px;font-weight:900;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;white-space:nowrap">Add</button>
          </div>`;
        }).join(""):`<div style="padding:18px;border:1px dashed var(--border-strong);border-radius:12px;color:var(--text-muted);text-align:center;font-size:12px">No exact historic class/trainer options found for this slot. Use the fresh class form above.</div>`}
      </div>
    </div>`;
  const refreshManualControls=()=>{
    const classEl=document.getElementById("manual-class");
    const trainerEl=document.getElementById("manual-trainer");
    const durationEl=document.getElementById("manual-duration");
    const capacityEl=document.getElementById("manual-capacity");
    const roomEl=document.getElementById("manual-room");
    const cls=classEl.value;
    const isPrivate=!!document.getElementById("manual-private-session")?.checked;
    if(document.activeElement!==durationEl)durationEl.value=classDefaultDuration(cls);
    if(isPrivate)capacityEl.value=1;
    capacityEl.disabled=isPrivate;
    const candidates=manualTrainerOptions(ctx,cls);
    const previousTrainer=trainerEl.value;
    trainerEl.innerHTML=candidates.length?candidates.map(c=>{
      const m=c.metric||{};
      const label=`${c.trainer} - ${round1(c.weeklyMinutes/60)}h scheduled - ${c.warnings.length?`${c.warnings.length} warning${c.warnings.length===1?"":"s"}`:"OK"} - ${pct(m.avg_fill_rate||0,0)} fill`;
      return`<option value="${rvEscapeAttr(c.trainer)}">${rvEscapeHtml(label)}</option>`;
    }).join(""):`<option value="">No trainers available</option>`;
    if(previousTrainer&&candidates.some(c=>c.trainer===previousTrainer))trainerEl.value=previousTrainer;
    const roomOk=manualRoomAvailable(loc,day,time,roomEl.value,Number(durationEl.value||57));
    const help=document.getElementById("manual-trainer-help");
    const selected=candidates.find(c=>c.trainer===trainerEl.value)||candidates[0]||null;
    const classWarnings=manualClassAllowedAtLocation(loc,cls)?[]:[`${displayClass(cls)} is normally blocked by location or class mix rules.`];
    const warnings=[...classWarnings,...(selected?.warnings||[])];
    if(!roomOk)warnings.push(`${roomEl.value} is already occupied at this time.`);
    help.classList.toggle("has-warning",warnings.length>0);
    help.innerHTML=warnings.length
      ? `<strong>Manual override warnings:</strong><ul>${warnings.map(w=>`<li>${rvEscapeHtml(w)}</li>`).join("")}</ul><div>User can still assign this manually.</div>`
      : `<strong>No scheduler warnings for this selection.</strong><div>All trainers remain selectable for manual override.</div>`;
    document.getElementById("manual-add-fresh").disabled=!candidates.length;
    document.getElementById("manual-repeat-days").style.display=document.getElementById("manual-recurring-session").checked?"flex":"none";
  };
  ["manual-class","manual-trainer","manual-room","manual-duration","manual-private-session","manual-recurring-session"].forEach(id=>{
    box.querySelector("#"+id)?.addEventListener("change",refreshManualControls);
  });
  refreshManualControls();
  box.querySelector("#manual-add-fresh").onclick=()=>{
    const cls=document.getElementById("manual-class").value;
    const trainer=document.getElementById("manual-trainer").value;
    const recurring=!!document.getElementById("manual-recurring-session")?.checked;
    const days=recurring?manualRecurringDays(ctx):[day];
    const dayDates=SCHEDULE_DATA.day_dates||{};
    const slots=days.map(d=>manualSlotTemplate(ctx,cls,trainer,null,{day_of_week:d,date:dayDates[d]||""}));
    applyManualClassAdd(slots.length===1?slots[0]:slots,box.querySelector("#manual-add-fresh"));
  };
  box.querySelectorAll("[data-add-class]").forEach(btn=>{
    btn.onclick=()=>applyManualClassAdd(JSON.parse(btn.getAttribute("data-add-class")),btn);
  });
}

async function applyManualClassAdd(slot,btn){
  const original=btn?btn.textContent:"";
  if(btn){btn.disabled=true;btn.textContent="Adding…";}
  try{
    const slots=Array.isArray(slot)?slot:[slot];
    const endpoint=slots.length>1?"/api/add-classes":"/api/add-class";
    const body=slots.length>1?{iteration:_iter,slots}:{iteration:_iter,slot:slots[0]};
    const resp=await schedulerFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await resp.json();
    if(!resp.ok||data.error)throw new Error(data.error||"Could not add class");
    slots.forEach(s=>{
      if(_iter==="Main"){
        if(!SCHEDULE_DATA.locations[s.location])SCHEDULE_DATA.locations[s.location]=[];
        SCHEDULE_DATA.locations[s.location].push(s);
      }else{
        if(!SCHEDULE_DATA.iterations)SCHEDULE_DATA.iterations={};
        if(!SCHEDULE_DATA.iterations[_iter])SCHEDULE_DATA.iterations[_iter]={};
        if(!SCHEDULE_DATA.iterations[_iter][s.location])SCHEDULE_DATA.iterations[_iter][s.location]=[];
        SCHEDULE_DATA.iterations[_iter][s.location].push(s);
      }
    });
    closeModal();
    renderView();
  }catch(err){
    if(btn){btn.disabled=false;btn.textContent=original;}
    alert(err.message||"Could not add class");
  }
}

// ============================================================
// REPLACE TRAINER MODAL
// ============================================================
async function openReplaceTrainerModal(s){
  const box=document.getElementById("modal-box");
  box.className="modal-box";
  box.innerHTML=`<div class="modal-body" style="padding:28px;color:var(--text-muted);font-size:13px">Loading eligible replacement trainers…</div>`;
  document.getElementById("modal-overlay").classList.add("open");
  await ensureReplacementConfigLoaded();
  const loc=s.location||_loc;
  const className=s.class_name||"";
  const day=s.day_of_week||"";
  const time=s.time||"";
  const fam=getFamily(className);
  const famCol=FAM_COLOR[fam]||FAM_COLOR.default;
  const currentStart=tmins(time||"00:00");
  const currentEnd=currentStart+Number(s.duration_min||57);

  function normName(name){return String(name||"").replace(/\s+/g," ").trim();}
  function sameTrainerName(a,b){return normName(a).toLowerCase()===normName(b).toLowerCase();}
  function qualKeyForClass(cn){
    const lower=String(cn||"").toLowerCase();
    if(lower.includes("powercycle")||lower.includes("power cycle"))return"powercycle";
    if(lower.includes("strength lab"))return"strength_lab";
    if(lower.includes("mat 57"))return"mat_57";
    if(lower.includes("foundations"))return"foundations";
    if(lower.includes("pre/post")||lower.includes("pre post")||lower.includes("natal"))return"pre_post_natal";
    if(lower.includes("amped"))return"amped_up";
    if(lower.includes("hiit"))return"hiit";
    if(lower.includes("recovery"))return"recovery";
    return"all_barre";
  }
  function hasClassQualification(profile,cn){
    if(!profile)return false;
    const q=profile.qualifications||{};
    const key=qualKeyForClass(cn);
    if(q[key])return true;
    if(key==="all_barre"&&q.all_barre)return true;
    return false;
  }
  function hasExplicitQualifications(profile){
    const q=profile?.qualifications||{};
    return Object.values(q).some(Boolean);
  }
  function hasImplicitClassHistory(name,cn){
    const key=qualKeyForClass(cn);
    return locSlots.some(ls=>{
      if(!sameTrainerName(ls.trainer_1,name))return false;
      return qualKeyForClass(ls.class_name)===key;
    }) || slotTop.some(st=>sameTrainerName(st.trainer||st.trainer_1,name));
  }
  function windowsOverlap(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&bStart<aEnd;}
  function isSameSlot(ls){
    return (ls.location||"")===loc&&(ls.day_of_week||"")===day&&(ls.time||"")===time&&(ls.class_name||"")===className&&(ls.trainer_1||"")===s.trainer_1;
  }
  function trainerProfileFor(name){
    const target=normName(name).toLowerCase();
    return (_settTrainerProfiles||[]).find(p=>normName(p.name).toLowerCase()===target)||null;
  }
  const inactiveNames=new Set(((_settSchedConfig||{}).inactive_trainers||[]).map(n=>normName(n).toLowerCase()));

  // Gather candidates from slot_top_trainers and from all slots at this location
  const slotTop=Array.isArray(s.slot_top_trainers)?s.slot_top_trainers:[];

  // Build extended trainer pool from every schedule location. This must ignore
  // UI location filters so cross-studio time conflicts are always blocked.
  const locSlots=getAllLocSlots();
  const trainerPool={};
  // dayShifts[trainer][day] = Set of "AM"|"PM" already used that day
  const trainerDayShifts={};
  locSlots.forEach(ls=>{
    const t=ls.trainer_1;
    if(!t)return;
    if(!trainerPool[t])trainerPool[t]={
      trainer:t,
      avg_fill:ls.trainer_overall_fill||0,
      avg_checkin:ls.trainer_overall_checkin||0,
      total_sessions:ls.trainer_total_sessions||0,
      scheduled_days:new Set(),
      scheduled_times_by_day:{},
      classes_this_week:0,
    };
    trainerPool[t].scheduled_days.add(ls.day_of_week);
    if(!trainerPool[t].scheduled_times_by_day[ls.day_of_week])trainerPool[t].scheduled_times_by_day[ls.day_of_week]=[];
    trainerPool[t].scheduled_times_by_day[ls.day_of_week].push(ls.time);
    trainerPool[t].classes_this_week++;
    // Track shifts used per day
    if(!trainerDayShifts[t])trainerDayShifts[t]={};
    if(!trainerDayShifts[t][ls.day_of_week])trainerDayShifts[t][ls.day_of_week]=new Set();
    trainerDayShifts[t][ls.day_of_week].add(tmins(ls.time)<13*60?"AM":"PM");
  });

  // Merge slotTop metrics
  slotTop.forEach(st=>{
    const t=st.trainer||st.trainer_1||"";
    if(!t)return;
    if(!trainerPool[t])trainerPool[t]={trainer:t,avg_fill:st.avg_fill_rate||0,avg_checkin:st.avg_attendance||0,total_sessions:st.session_count||0,scheduled_days:new Set(),scheduled_times_by_day:{},classes_this_week:0};
    trainerPool[t].slot_score=st.score||0;
    trainerPool[t].slot_sessions=st.session_count||0;
    trainerPool[t].slot_avg_fill=st.avg_fill_rate||0;
    trainerPool[t].slot_avg_checkin=st.avg_attendance||0;
    trainerPool[t].slot_revenue=st.avg_revenue||0;
  });

  // Add every configured trainer profile so a light current schedule or sparse
  // slot history still produces eligible replacements.
  (_settTrainerProfiles||[]).forEach(profile=>{
    const t=profile.name||"";
    if(!t)return;
    if(!trainerPool[t])trainerPool[t]={
      trainer:t,
      avg_fill:0,
      avg_checkin:0,
      total_sessions:0,
      scheduled_days:new Set(),
      scheduled_times_by_day:{},
      classes_this_week:0,
    };
  });

  // Determine slot's shift
  const currentSlotMins=tmins(time);
  const isAMSlot=currentSlotMins<13*60;
  const slotShift=isAMSlot?"AM":"PM";
  const oppositeShift=isAMSlot?"PM":"AM";

  // Score and filter candidates
  const candidates=Object.values(trainerPool)
    .filter(t=>t.trainer!==s.trainer_1)
    .map(t=>{
      const reasons=[];
      const hardBlock=[];
      const profile=trainerProfileFor(t.trainer);
      const profileLoc=profileLocationData(profile,loc);
      const normTrainer=normName(t.trainer).toLowerCase();

      if(!profile){
        hardBlock.push("No trainer profile found");
      } else if(profile.active===false||inactiveNames.has(normTrainer)){
        hardBlock.push("Trainer is inactive");
      }
      if(!profileLoc){
        hardBlock.push(`Trainer is not enabled for ${loc}`);
      }
      if(profile&&hasExplicitQualifications(profile)&&!hasClassQualification(profile,className)){
        hardBlock.push(`Trainer is not qualified for ${displayClass(className)}`);
      } else if(profile&&!hasExplicitQualifications(profile)&&!hasImplicitClassHistory(t.trainer,className)){
        hardBlock.push(`No qualification or teaching history for ${displayClass(className)}`);
      }
      if(profileLoc){
        const days=profileLoc.available_days||[];
        if(days.length&&!days.includes(day))hardBlock.push(`Trainer is not available on ${day}`);
        const tw=profileLoc.time_window||{};
        const start=tw.start||"06:00";
        const end=tw.end||"22:00";
        if(currentStart<tmins(start)||currentStart>=tmins(end))hardBlock.push(`Outside trainer time window ${start}-${end}`);
        const dayCount=locSlots.filter(ls=>sameTrainerName(ls.trainer_1,t.trainer)&&ls.day_of_week===day&&!isSameSlot(ls)).length;
        const maxDay=Number(profileLoc.max_classes_per_day||4);
        if(dayCount>=maxDay)hardBlock.push(`Trainer already has ${dayCount}/${maxDay} classes that day`);
      }

      const overlapping=locSlots.find(ls=>{
        if(!sameTrainerName(ls.trainer_1,t.trainer)||ls.day_of_week!==day||isSameSlot(ls))return false;
        const st=tmins(ls.time||"00:00");
        const en=st+Number(ls.duration_min||57);
        return windowsOverlap(currentStart,currentEnd,st,en);
      });
      if(overlapping){
        hardBlock.push(`Overlaps ${overlapping.location||""} ${overlapping.time} ${displayClass(overlapping.class_name)}`);
      }

      // AM/PM same-day conflict check (per day, not global)
      const shiftsOnTargetDay=(trainerDayShifts[t.trainer]||{})[day]||new Set();
      const hasOppositeShiftOnDay=shiftsOnTargetDay.has(oppositeShift);
      const hasSameShiftOnDay=shiftsOnTargetDay.has(slotShift);

      if(hasOppositeShiftOnDay){
        hardBlock.push(`Already assigned ${oppositeShift} on ${day} — AM/PM split rule`);
      } else if(hasSameShiftOnDay){
        reasons.push(`Already in ${slotShift} shift on ${day} — same shift, no split`);
      } else {
        reasons.push(`No ${day} classes yet — clean day for assignment`);
      }

      // History-based reasons
      if(t.slot_sessions>5)reasons.push(`${t.slot_sessions} sessions at this exact slot`);
      else if(t.total_sessions>20)reasons.push(`${t.total_sessions} total sessions at location`);
      if((t.slot_avg_fill||t.avg_fill)>0.5)reasons.push(`${pct(t.slot_avg_fill||t.avg_fill)} fill rate at this slot`);
      if((t.slot_avg_checkin||t.avg_checkin)>7)reasons.push(`${round1(t.slot_avg_checkin||t.avg_checkin)} avg check-in`);
      if(t.slot_revenue>500)reasons.push(`₹${Math.round(t.slot_revenue)} avg revenue at slot`);

      // Weekly load
      if(t.classes_this_week>0)reasons.push(`${t.classes_this_week} class${t.classes_this_week>1?"es":""} scheduled this week`);

      if(hardBlock.length)return null;

      // Fit score
      const slotScore=t.slot_score||(((t.slot_avg_fill||t.avg_fill)*35)+((t.slot_avg_checkin||t.avg_checkin)/10*20)+((t.slot_sessions||t.total_sessions)/50*10));
      const fitScore=Math.max(0,Math.min(100,slotScore));
      return{...t,reasons,fitScore,isHardBlock:false};
    })
    .filter(Boolean)
    .sort((a,b)=>{
      return b.fitScore-a.fitScore;
    })
    .slice(0,8);

  const currentFill=s.predicted_fill_rate||0;
  box.innerHTML=`
    <div class="modal-hdr">
      <div>
        <div class="modal-class-name">Replace Trainer — ${displayClass(className)}</div>
        <div class="modal-meta">${loc} · ${day} ${time} · Currently: <strong>${rvEscapeHtml(s.trainer_1||"—")}</strong></div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--primary-light);border:1px solid var(--primary-mid);border-radius:var(--r8);padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--primary)">
        <strong>Slot:</strong> ${displayClass(className)} · ${day} at ${time} · ${pct(currentFill)} predicted fill · Score ${Math.round(s.score||0)}/100
      </div>
      ${candidates.length===0?`<div style="color:var(--text-muted);padding:20px;text-align:center">No eligible replacement trainers found. Every shown candidate must match studio access, active status, class qualification, availability, max daily load, AM/PM split, and non-overlapping class time.</div>`:`
      <div style="margin-bottom:10px;font-size:11px;color:var(--text-muted)">Showing only eligible trainers: active profile, enabled studio, qualified class format, available day/time, no AM/PM split, and no overlapping assignment.</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${candidates.map((c,i)=>{
          const fc=fillColor(c.slot_avg_fill||c.avg_fill||0);
          const borderCol=i===0?"#86EFAC":"var(--border)";
          const bgCol=i===0?"#F0FDF4":"var(--surface)";
          const img=trainerImage(c.trainer);
          const initials=trainerInitials(c.trainer);
          const badgeTxt=i===0?"★ Best Fit":i===1?"2nd Choice":"Eligible";
          const badgeBg=i===0?"#D1FAE5":i===1?"#DBEAFE":"var(--surface2)";
          const badgeFg=i===0?"#065F46":i===1?"#1E3A8A":"var(--text-muted)";
          const replacementPayload={
            iteration:_iter,
            slot:{location:loc,date:s.date||"",day_of_week:day,time:time,class_name:className,room:s.room||"",trainer_1:s.trainer_1||""},
            new_trainer:c.trainer
          };
          return`<div style="border:1px solid ${borderCol};background:${bgCol};border-radius:var(--r12);padding:14px;display:flex;gap:12px;align-items:flex-start">
            <div style="width:42px;height:42px;border-radius:50%;overflow:hidden;border:2px solid ${borderCol};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--primary);background:var(--primary-mid)">${img?`<img src="${img}" style="width:100%;height:100%;object-fit:cover" alt="${rvEscapeAttr(c.trainer)}">`:initials}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
                <div style="font-size:14px;font-weight:800;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif">${rvEscapeHtml(c.trainer)}</div>
                <div style="display:flex;align-items:center;gap:5px">
                  <span style="font-size:10px;font-weight:700;background:${badgeBg};color:${badgeFg};border-radius:100px;padding:2px 8px">${badgeTxt}</span>
                  <span style="font-size:10px;font-weight:700;background:var(--surface2);color:var(--text-muted);border-radius:100px;padding:2px 8px">${Math.round(c.fitScore)}/100</span>
                </div>
              </div>
              <div style="display:flex;gap:12px;margin-bottom:6px;flex-wrap:wrap">
                <span style="font-size:11px;color:${fc};font-weight:700">${pct(c.slot_avg_fill||c.avg_fill||0)} fill</span>
                <span style="font-size:11px;color:var(--text-muted)">${round1(c.slot_avg_checkin||c.avg_checkin||0)} avg check-in</span>
                <span style="font-size:11px;color:var(--text-muted)">${c.slot_sessions||c.total_sessions||0} sessions · ${c.classes_this_week||0} this week</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px">
                ${c.reasons.map(r=>`<div style="font-size:11px;color:var(--text-2)">✓ ${rvEscapeHtml(r)}</div>`).join("")}
              </div>
            </div>
            <button type="button" data-replace-payload="${rvEscapeAttr(JSON.stringify(replacementPayload))}" style="border:0;background:var(--text);color:var(--bg);border-radius:10px;padding:9px 12px;font-size:11px;font-weight:900;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 8px 18px rgba(15,23,42,.18)">Replace</button>
          </div>`;
        }).join("")}
      </div>`}
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);font-size:11px;color:var(--text-light)">
        Fit score uses slot history, fill rate, attendance, and current weekly load after hard eligibility filters are applied.
      </div>
    </div>`;
  document.getElementById("modal-overlay").classList.add("open");
  box.querySelectorAll("[data-replace-payload]").forEach(btn=>{
    btn.onclick=(e)=>{
      e.stopPropagation();
      applyTrainerReplacement(JSON.parse(btn.getAttribute("data-replace-payload")),btn);
    };
  });
}

// ============================================================
// SHOW SIMILAR MODAL
// ============================================================
function openSimilarModal(s){
  const box=document.getElementById("modal-box");
  box.className="modal-box";
  const loc=s.location||_loc;
  const className=s.class_name||"";
  const fam=getFamily(className);
  const targetFill=s.predicted_fill_rate||0;
  const targetTime=tmins(s.time||"00:00");
  const targetDay=s.day_of_week||"";

  // Gather similar slots from same location
  const locSlots=getSlots(loc);

  // 1) Same class, different day/time
  const sameClass=locSlots.filter(ls=>
    ls.class_name===className &&
    !(ls.day_of_week===s.day_of_week&&ls.time===s.time&&ls.trainer_1===s.trainer_1)
  );

  // 2) Same time slot, same family, different class
  const sameTimeFamily=locSlots.filter(ls=>
    getFamily(ls.class_name)===fam &&
    ls.class_name!==className &&
    Math.abs(tmins(ls.time||"00:00")-targetTime)<=30
  );

  // 3) Same day, same time band, high-performing
  const sameDayBand=locSlots.filter(ls=>
    ls.day_of_week===targetDay &&
    ls.class_name!==className &&
    timeBand(ls.time||"")===timeBand(s.time||"") &&
    (ls.predicted_fill_rate||0)>targetFill
  ).sort((a,b)=>(b.predicted_fill_rate||0)-(a.predicted_fill_rate||0)).slice(0,5);

  function slotCard(ls,badge){
    const fill=ls.predicted_fill_rate||0;
    const fc=fillColor(fill);
    const badgeCls=recBadgeCls(ls.recommendation);
    const avg=ls.slot_avg_checkin||ls.historical_avg_checkin||0;
    return`<div style="border:1px solid var(--border);border-radius:var(--r8);padding:10px 12px;cursor:pointer;transition:all .14s" onclick="closeModal();setTimeout(()=>openModal(${JSON.stringify(ls).replace(/"/g,'&quot;')}),120)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:12px;font-weight:800;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif">${displayClass(ls.class_name)}</div>
        <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:100px;background:${badge==="same-class"?"var(--primary-mid)":badge==="same-time"?"#F5F3FF":"#F0FDF4"};color:${badge==="same-class"?"var(--primary)":badge==="same-time"?"#6D28D9":"#15803D"}">${badge==="same-class"?"Same Class":badge==="same-time"?"Same Time":"Better Performer"}</span>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${ls.day_of_week||"—"} at ${ls.time||"—"} · ${rvEscapeHtml(ls.trainer_1||"—")}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:13px;font-weight:900;color:${fc}">${pct(fill)}</span>
        <div style="flex:1;height:4px;background:var(--border);border-radius:100px;overflow:hidden"><div style="height:100%;background:${fc};border-radius:100px;width:${Math.round(fill*100)}%"></div></div>
        <span style="font-size:11px;color:#059669;font-weight:700">${round1(avg)} avg</span>
        <span class="cc-badge ${badgeCls}" style="font-size:8px">${recLabel(ls.recommendation)}</span>
      </div>
      <div style="font-size:9px;color:var(--text-light);margin-top:4px;opacity:0;">Click to drill down →</div>
    </div>`;
  }

  const sections=[];
  if(sameClass.length){
    sections.push(`<div class="ms-title">Same Class · Other Days &amp; Times (${sameClass.length})</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${sameClass.sort((a,b)=>(b.predicted_fill_rate||0)-(a.predicted_fill_rate||0)).slice(0,6).map(ls=>slotCard(ls,"same-class")).join("")}
      </div>`);
  }
  if(sameTimeFamily.length){
    sections.push(`<div class="ms-title">Same Time Window · ${fam.replace(/_/g," ")} Family (${sameTimeFamily.length})</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${sameTimeFamily.sort((a,b)=>(b.predicted_fill_rate||0)-(a.predicted_fill_rate||0)).slice(0,4).map(ls=>slotCard(ls,"same-time")).join("")}
      </div>`);
  }
  if(sameDayBand.length){
    sections.push(`<div class="ms-title">Same Day · Same Time Band · Higher Fill (${sameDayBand.length})</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${sameDayBand.slice(0,4).map(ls=>slotCard(ls,"better")).join("")}
      </div>`);
  }

  box.innerHTML=`
    <div class="modal-hdr">
      <div>
        <div class="modal-class-name">Similar Classes — ${displayClass(className)}</div>
        <div class="modal-meta">${loc} · ${targetDay} ${s.time||""} · ${pct(targetFill)} fill</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r8);padding:8px 12px;margin-bottom:14px;display:flex;gap:14px;font-size:11px">
        <span>Current: <strong>${pct(targetFill)} fill</strong></span>
        <span>Score: <strong>${Math.round(s.score||0)}/100</strong></span>
        <span>Recommendation: <strong>${recLabel(s.recommendation)}</strong></span>
      </div>
      ${sections.length?sections.join(""):`<div style="color:var(--text-muted);text-align:center;padding:30px;font-size:13px">No similar classes found at this location.</div>`}
    </div>`;
  document.getElementById("modal-overlay").classList.add("open");
}

function openScoreModal(s){
  const box=document.getElementById("modal-box");
  box.className="modal-box";
  const totalScore=Math.round(s.score||0);
  const m=drillMetrics(s);
  const scoreDetails=scoreBreakdownHtml(s.score_breakdown)||scoreFallbackHtml(s,m);
  box.innerHTML=`
    <div class="modal-hdr">
      <div>
        <div class="modal-class-name">${displayClass(s.class_name)}</div>
        <div class="modal-meta">${s.location||""} · ${s.day_of_week||""} ${s.time||""} · ${s.trainer_1||""}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="hist-modal-tabs">
      <button class="hist-modal-tab active" onclick="histModalTab('schedscore')">Calculation</button>
      <button class="hist-modal-tab" onclick="histModalTab('scheddefs')">Definitions</button>
      <button class="hist-modal-tab" onclick="histModalTab('schedrows')">Class Rows</button>
    </div>
    <div class="modal-body">
      <div class="hist-tab-panel active" id="hist-panel-schedscore">
        <div class="modal-score-panel">
          <div class="modal-score-top">
            <div class="modal-score-ring-wrap">${scoreRing(totalScore,48)}</div>
            <div class="modal-score-details">
              <div class="modal-score-label">Score Formula</div>
              <div class="hist-formula">Score = average attendance × 75 + fill × 15 + revenue × 7 + sessions × 3. PowerCycle: fill × 50. Strength: fill × 70.</div>
            </div>
          </div>
          ${scoreDetails}
        </div>
      </div>
      <div class="hist-tab-panel" id="hist-panel-scheddefs">${metricDefinitionsHtml()}</div>
      <div class="hist-tab-panel" id="hist-panel-schedrows">${sessionRowsTable(drillSessionRows(s))}</div>
    </div>`;
  document.getElementById("modal-overlay").classList.add("open");
}
function closeModal(){
  document.getElementById("modal-overlay").classList.remove("open");
  document.getElementById("modal-box").className="modal-box";
  if(typeof controlCenterStopRotation==="function")controlCenterStopRotation();
}

function slotIdentity(s){
  return{location:s.location||"",date:s.date||"",day_of_week:s.day_of_week||"",time:s.time||"",class_name:s.class_name||"",room:s.room||"",trainer_1:s.trainer_1||""};
}
function sameScheduleSlot(a,b){
  return (a.location||"")===(b.location||"") &&
    (a.date||"")===(b.date||"") &&
    (a.day_of_week||"")===(b.day_of_week||"") &&
    (a.time||"")===(b.time||"") &&
    (a.class_name||"")===(b.class_name||"") &&
    (a.room||"")===(b.room||"") &&
    (a.trainer_1||"")===(b.trainer_1||"");
}

function updateClientScheduleRemove(slot){
  function removeFrom(list){
    if(!Array.isArray(list))return 0;
    const idx=list.findIndex(row=>sameScheduleSlot(row,slot));
    if(idx>=0){list.splice(idx,1);return 1}
    return 0;
  }
  if(_iter==="Main")return removeFrom(SCHEDULE_DATA.locations?.[slot.location]);
  return removeFrom(SCHEDULE_DATA.iterations?.[_iter]?.[slot.location]);
}

function updateClientScheduleMove(slot,target,serverSlot){
  const movedSlot=serverSlot||{...slot,location:target.location||slot.location,date:target.date||slot.date,day_of_week:target.day_of_week,time:target.time,recommendation:"MANUAL",manual_moved:true,scheduling_reason:`Manual drag/drop move: ${slot.day_of_week} ${slot.time} → ${target.day_of_week} ${target.time}`};
  updateClientScheduleRemove(slot);
  if(_iter==="Main"){
    if(!SCHEDULE_DATA.locations[movedSlot.location])SCHEDULE_DATA.locations[movedSlot.location]=[];
    SCHEDULE_DATA.locations[movedSlot.location].push(movedSlot);
  }else{
    if(!SCHEDULE_DATA.iterations)SCHEDULE_DATA.iterations={};
    if(!SCHEDULE_DATA.iterations[_iter])SCHEDULE_DATA.iterations[_iter]={};
    if(!SCHEDULE_DATA.iterations[_iter][movedSlot.location])SCHEDULE_DATA.iterations[_iter][movedSlot.location]=[];
    SCHEDULE_DATA.iterations[_iter][movedSlot.location].push(movedSlot);
  }
}

function updateClientScheduleAdd(slot){
  if(!slot||!slot.location)return;
  if(_iter==="Main"){
    if(!SCHEDULE_DATA.locations)SCHEDULE_DATA.locations={};
    if(!SCHEDULE_DATA.locations[slot.location])SCHEDULE_DATA.locations[slot.location]=[];
    SCHEDULE_DATA.locations[slot.location].push(slot);
  }else{
    if(!SCHEDULE_DATA.iterations)SCHEDULE_DATA.iterations={};
    if(!SCHEDULE_DATA.iterations[_iter])SCHEDULE_DATA.iterations[_iter]={};
    if(!SCHEDULE_DATA.iterations[_iter][slot.location])SCHEDULE_DATA.iterations[_iter][slot.location]=[];
    SCHEDULE_DATA.iterations[_iter][slot.location].push(slot);
  }
}

function copyClassCard(s){
  _copiedClassSlot={...s};
  const btn=document.getElementById("copy-status-btn");
  if(btn){
    btn.style.display="";
    btn.textContent=`Copied: ${displayClass(s.class_name).slice(0,18)}`;
  }
  showToast("Class copied. Click any calendar slot to paste.","",2600);
}

function clearCopiedClass(){
  _copiedClassSlot=null;
  const btn=document.getElementById("copy-status-btn");
  if(btn){btn.style.display="none";btn.textContent="Clear Copy";}
}

async function pasteCopiedClass(target){
  if(!_copiedClassSlot)return;
  if(!confirm(`Paste ${displayClass(_copiedClassSlot.class_name)} to ${target.day_of_week} ${target.time}?`))return;
  const slot={
    ..._copiedClassSlot,
    location:target.location||_copiedClassSlot.location,
    date:target.date||_copiedClassSlot.date||"",
    day_of_week:target.day_of_week,
    time:target.time,
    recommendation:"MANUAL",
    manual_added:true,
    copied_from:{location:_copiedClassSlot.location,day_of_week:_copiedClassSlot.day_of_week,time:_copiedClassSlot.time},
    scheduling_reason:`Manual copy/paste from ${_copiedClassSlot.day_of_week} ${_copiedClassSlot.time}`
  };
  try{
    const resp=await schedulerFetch("/api/add-class",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({iteration:_iter,slot})});
    const data=await resp.json();
    if(!resp.ok||data.error)throw new Error(data.error||"Could not paste class");
    updateClientScheduleAdd(slot);
    renderView();
    if(data.warning)showToast(data.warning,"warn",5000);
  }catch(err){alert(err.message||"Could not paste class")}
}

async function confirmClearCalendar(){
  if(!confirm("Clear the full active calendar? This removes all scheduled classes for the current schedule view."))return;
  try{
    const resp=await schedulerFetch("/api/clear-schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({iteration:_iter})});
    const data=await resp.json();
    if(!resp.ok||data.error)throw new Error(data.error||"Could not clear calendar");
    if(_iter==="Main"){
      Object.keys(SCHEDULE_DATA.locations||{}).forEach(loc=>SCHEDULE_DATA.locations[loc]=[]);
    }else{
      Object.keys(SCHEDULE_DATA.iterations?.[_iter]||{}).forEach(loc=>SCHEDULE_DATA.iterations[_iter][loc]=[]);
    }
    clearCopiedClass();
    renderView();
  }catch(err){alert(err.message||"Could not clear calendar")}
}

function confirmManualClassRemove(s){
  if(!confirm(`Remove ${displayClass(s.class_name)} with ${s.trainer_1||"—"} from ${s.day_of_week} ${s.time}?`))return;
  applyManualClassRemove(slotIdentity(s));
}

async function applyManualClassRemove(slot){
  try{
    const resp=await schedulerFetch("/api/remove-class",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({iteration:_iter,slot})});
    const data=await resp.json();
    if(!resp.ok||data.error)throw new Error(data.error||"Could not remove class");
    updateClientScheduleRemove(slot);
    renderView();
  }catch(err){alert(err.message||"Could not remove class")}
}

async function applyManualClassMove(slot,target){
  if(!slot||!target||!target.day_of_week||!target.time)return;
  if(slot.location===target.location&&slot.day_of_week===target.day_of_week&&slot.time===target.time)return;
  try{
    const resp=await schedulerFetch("/api/move-class",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({iteration:_iter,slot,target})});
    const data=await resp.json();
    if(!resp.ok||data.error)throw new Error(data.error||"Could not move class");
    updateClientScheduleMove(slot,target,data.slot);
    renderView();
  }catch(err){alert(err.message||"Could not move class")}
}

function updateClientScheduleTrainer(payload){
  const slot=payload.slot||{};
  const nextTrainer=payload.new_trainer||"";
  let updated=0;
  function updateList(list){
    if(!Array.isArray(list))return;
    list.forEach(row=>{
      if(sameScheduleSlot(row,slot)){
        row.replaced_from_trainer=row.trainer_1||"";
        row.trainer_1=nextTrainer;
        row.recommendation="MANUAL";
        row.scheduling_reason=`Manual trainer replacement: ${row.replaced_from_trainer||"—"} → ${nextTrainer}`;
        updated++;
      }
    });
  }
  if(SCHEDULE_DATA.locations){
    Object.values(SCHEDULE_DATA.locations).forEach(updateList);
  }
  if(SCHEDULE_DATA.iterations){
    Object.values(SCHEDULE_DATA.iterations).forEach(iterMap=>{
      Object.values(iterMap||{}).forEach(updateList);
    });
  }
  return updated;
}

async function applyTrainerReplacement(payload,btn){
  if(!payload||!payload.new_trainer)return;
  const originalText=btn?btn.textContent:"";
  if(btn){btn.disabled=true;btn.textContent="Replacing…";}
  try{
    const resp=await schedulerFetch("/api/replace-trainer",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const data=await resp.json();
    if(!resp.ok||data.error)throw new Error(data.error||"Replacement failed");
    updateClientScheduleTrainer(payload);
    closeModal();
    renderView();
    if(data.warning)showToast(data.warning,"warn",5000);
  }catch(err){
    if(btn){btn.disabled=false;btn.textContent=originalText;}
    alert(err.message||"Could not replace trainer");
  }
}

// ============================================================
// DAY BREAKDOWN MODAL
// ============================================================
function openDayBreakdownModal(day,slots){
  const box=document.getElementById("modal-box");
  box.className="modal-box";
  const byFam={};
  slots.forEach(s=>{const f=getFamily(s.class_name);if(!byFam[f])byFam[f]=[];byFam[f].push(s)});
  const sorted=Object.entries(byFam).sort((a,b)=>b[1].length-a[1].length);
  const total=slots.length;
  const avgFill=total?slots.reduce((a,s)=>a+(s.predicted_fill_rate||0),0)/total:0;
  const byTime={};
  slots.forEach(s=>{if(!byTime[s.time])byTime[s.time]=[];byTime[s.time].push(s)});
  const timesSorted=Object.keys(byTime).sort();
  box.innerHTML=`
    <div class="modal-hdr">
      <div><div class="modal-class-name">${day} — Format Breakdown</div><div class="modal-meta">${total} classes · Avg fill ${pct(avgFill,1)}</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
        ${sorted.map(([fam,ss])=>{
          const col=FAM_COLOR[fam]||FAM_COLOR.default;
          const pctV=total?ss.length/total:0;
          const avgF=ss.reduce((a,s)=>a+(s.predicted_fill_rate||0),0)/ss.length;
          return`<div style="border:1px solid var(--border);border-radius:var(--r8);padding:10px 12px;display:flex;align-items:center;gap:10px">
            <div style="width:10px;height:36px;background:${col};border-radius:3px;flex-shrink:0"></div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700;color:var(--text);text-transform:capitalize">${fam.replace(/_/g," ")}</div>
              <div style="font-size:11px;color:var(--text-muted)">${ss.length} classes · ${Math.round(pctV*100)}% of day</div>
              <div style="font-size:10px;color:${fillColor(avgF)};font-weight:700">${pct(avgF)} avg fill</div>
            </div>
          </div>`;
        }).join("")}
      </div>
      <div class="ms-title">Classes by Time Slot</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${timesSorted.map(t=>{
          const ss=byTime[t];
          return ss.map(s=>{
            const fill=s.predicted_fill_rate||0;
            const fc=fillColor(fill);
            const fam=getFamily(s.class_name);
            const col=FAM_COLOR[fam]||FAM_COLOR.default;
            return`<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid var(--border);border-radius:var(--r6);cursor:pointer" onclick="closeModal();setTimeout(()=>openModal(${JSON.stringify(s).replace(/"/g,'&quot;')}),120)">
              <span style="font-size:12px;font-weight:700;color:${isPrime(t)?"var(--prime)":"var(--text-muted)"};min-width:48px">${t}</span>
              <div style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></div>
              <span style="font-size:12px;font-weight:700;color:var(--text);flex:1">${displayClass(s.class_name)}</span>
              <span style="font-size:11px;color:var(--text-muted)">${s.trainer_1||"—"}</span>
              <span style="font-size:12px;font-weight:800;color:${fc}">${pct(fill)}</span>
            </div>`;
          }).join("");
        }).join("")}
      </div>
    </div>`;
  document.getElementById("modal-overlay").classList.add("open");
}

// ============================================================
// INIT
// ============================================================
function renderInitialUi(){
  document.getElementById("week-badge").textContent=`Week of ${WEEK_LABEL||"—"}`;
  initScheduleWeekPicker();
  persistScheduleWeekSelection();
  buildLocTabs();
  buildIterPills();
  buildDayChips();
  buildRecChips();
  setFiltersOpen(false);
  if(_loc){
    populateDropdowns(getFilterScopeSlots());
    renderView();
  }
}

function hasScheduleLocations(){
  const locs=SCHEDULE_DATA&&SCHEDULE_DATA.locations;
  return !!(locs&&Object.keys(locs).length);
}

function _setLdStatus(msg){
  const el=document.getElementById("ld-status");
  if(el){el.textContent=msg;}
}

async function hydrateLatestScheduleIfEmpty(){
  try{
    _setLdStatus("Fetching latest schedule…");
    // Kick off both requests in parallel — resolve file name then fetch data
    const metaP=schedulerFetch("/api/latest-schedule-file").then(r=>r.ok?r.json():{});
    const meta=await metaP;
    const file=meta&&meta.file?meta.file:"schedule_data.json";
    _setLdStatus("Reading schedule data…");
    const latest=await schedulerFetch(`/${file}?ts=${Date.now()}`).then(r=>r.json());
    if(latest&&Object.keys(latest).length){
      Object.keys(SCHEDULE_DATA).forEach(k=>delete SCHEDULE_DATA[k]);
      Object.assign(SCHEDULE_DATA,latest);
      _setLdStatus("Rendering schedule…");
    }
  }catch(_err){}
}

async function init(){
  if(typeof collaborationRequireAuth==="function")await collaborationRequireAuth();
  await hydrateLatestScheduleIfEmpty();
  renderInitialUi();
  const loader=document.getElementById("initial-loader");
  if(loader){
    loader.style.transition="opacity 0.2s ease";
    loader.style.opacity="0";
    setTimeout(()=>loader.style.display="none",220);
  }
  // Auto-show compliance report ONLY after a fresh schedule generation
  const isFreshGeneration = sessionStorage.getItem("new_schedule_generated") === "true";
  if (isFreshGeneration && SCHEDULE_DATA && SCHEDULE_DATA.compliance_report && Object.keys(SCHEDULE_DATA.compliance_report).length) {
    sessionStorage.removeItem("new_schedule_generated");
    if (location.search) {
      try { history.replaceState(null, "", location.pathname); } catch(e) {}
    }
    setTimeout(() => openComplianceReportModal(), 400);
  } else if (location.search && (location.search.includes("ts=") || location.search.includes("fresh="))) {
    try { history.replaceState(null, "", location.pathname); } catch(e) {}
  }
}

document.getElementById("modal-overlay").addEventListener("click",e=>{if(e.target===document.getElementById("modal-overlay"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
window.addEventListener("DOMContentLoaded",init);

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type, duration){
  const t=document.getElementById("toast");
  t.textContent=msg;
  t.className="toast"+(type?" "+type:"");
  requestAnimationFrame(()=>t.classList.add("show"));
  clearTimeout(t._tid);
  t._tid=setTimeout(()=>t.classList.remove("show"), duration||3000);
}

// ============================================================
// PIPELINE — Generate button & status bar
// ============================================================
let _pipelinePoller=null;
let _copiedClassSlot=null;
const _dismissedInsightIds=new Set();
const PIPELINE_MESSAGES=[
  "Reading studio history and normalizing class demand signals…",
  "Scoring prime-time demand, fill patterns, and class format balance…",
  "Checking instructor availability, qualifications, leave, and overlap rules…",
  "Prioritising Tier 1 instructor load before expanding to backup capacity…",
  "Balancing daily studio targets against trainer hours and protected sessions…",
  "Comparing candidate schedules and keeping the strongest trade-offs…",
  "Preparing the publishable schedule and saving the latest draft snapshot…"
];
function pipelineDisplayMessage(raw,elapsedMs=0){
  const clean=String(raw||"").trim();
  if(clean&& !/^Running\s*[—-]\s*Agent\s*\d+/i.test(clean))return clean;
  const idx=Math.min(PIPELINE_MESSAGES.length-1,Math.floor((elapsedMs||0)/8000)%PIPELINE_MESSAGES.length);
  return PIPELINE_MESSAGES[idx];
}

function setGenerateButtonsLoading(isLoading,aiMode=false){
  const standardBtn=document.getElementById("gen-btn");
  const aiBtn=document.getElementById("gen-ai-btn");
  const optimizeBtn=document.getElementById("optimize-ai-btn");
  [standardBtn,aiBtn,optimizeBtn].forEach(btn=>{if(btn){btn.disabled=Boolean(isLoading);btn.classList.remove("loading");}});
  if(isLoading){(aiMode?aiBtn:standardBtn)?.classList.add("loading");}
}

function setOptimizeButtonLoading(isLoading){
  const btn=document.getElementById("optimize-ai-btn");
  const standardBtn=document.getElementById("gen-btn");
  const aiBtn=document.getElementById("gen-ai-btn");
  [standardBtn,aiBtn,btn].forEach(el=>{if(el)el.disabled=Boolean(isLoading);});
  if(btn)btn.classList.toggle("loading",Boolean(isLoading));
}

function dateToInputValue(date){
  const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,"0");const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function mondayForDateValue(value){
  const raw=String(value||"").slice(0,10);const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return "";
  const dt=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));if(Number.isNaN(dt.getTime()))return "";
  const day=dt.getDay();const diff=day===0?-6:1-day;dt.setDate(dt.getDate()+diff);return dateToInputValue(dt);
}
function getSelectedScheduleWeekStart(){
  const picker=document.getElementById("schedule-week-start");
  const stored=localStorage.getItem("schedule_week_start")||"";
  const current=(SCHEDULE_DATA&&SCHEDULE_DATA.generated_for_week)||WEEK_LABEL||"";
  const thisWeek=mondayForDateValue(dateToInputValue(new Date()));
  return mondayForDateValue(picker?.value)||mondayForDateValue(stored)||thisWeek||mondayForDateValue(current)||"";
}
function persistScheduleWeekSelection(){
  const picker=document.getElementById("schedule-week-start");if(!picker)return;
  const weekStart=mondayForDateValue(picker.value);if(!weekStart)return;
  picker.value=weekStart;localStorage.setItem("schedule_week_start",weekStart);
  const badge=document.getElementById("week-badge");if(badge)badge.textContent=`Week of ${weekStart}`;
}
function initScheduleWeekPicker(){
  const picker=document.getElementById("schedule-week-start");if(!picker)return;
  const weekStart=mondayForDateValue(dateToInputValue(new Date()));
  if(weekStart){picker.value=weekStart;localStorage.setItem("schedule_week_start",weekStart);persistScheduleWeekSelection();}
}

let _pendingGenerateUseAi=false;

function scheduleLocationsList(){
  const fromSchedule=Object.keys((SCHEDULE_DATA&&SCHEDULE_DATA.locations)||{});
  const defaults=["Kwality House, Kemps Corner","Supreme HQ, Bandra","Kenkere House","Copper & Cloves"];
  return [...new Set(fromSchedule.length?fromSchedule:defaults)];
}

function openGenerateScheduleModal(useAi=false){
  _pendingGenerateUseAi=Boolean(useAi);
  const box=document.getElementById("modal-box");
  const overlay=document.getElementById("modal-overlay");
  if(!box||!overlay){runPipelineFromHeader(useAi);return;}
  const weekStart=getSelectedScheduleWeekStart()||mondayForDateValue(dateToInputValue(new Date()));
  const locs=scheduleLocationsList();
  box.className="modal-box";
  box.innerHTML=`<div class="modal-hdr">
    <div><div class="modal-class-name">${useAi?"Generate with AI":"Generate Schedule"}</div><div class="modal-meta">Choose week and studio scope</div></div>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body">
    <div class="modal-section">
      <div class="fp-label">Schedule Week Starting Monday</div>
      <input class="fp-select" type="date" id="gen-week-start" value="${rvEscapeAttr(weekStart)}" onchange="this.value=mondayForDateValue(this.value)">
    </div>
    <div class="modal-section">
      <div class="fp-label">Locations To Generate</div>
      <div class="fp-location-list">
        ${locs.map(loc=>`<label class="fp-location-item active" style="cursor:pointer">
          <input type="checkbox" class="gen-location-check" value="${rvEscapeAttr(loc)}" checked onchange="this.closest('.fp-location-item').classList.toggle('active',this.checked)">
          <span>${rvEscapeHtml(loc)}</span>
        </label>`).join("")}
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
      <button class="nle-btn cancel" onclick="closeModal()">Cancel</button>
      <button class="nle-btn apply" onclick="confirmGenerateSchedule()">Generate</button>
    </div>
  </div>`;
  overlay.classList.add("open");
}

function confirmGenerateSchedule(){
  const weekInput=document.getElementById("gen-week-start");
  const weekStart=mondayForDateValue(weekInput?.value)||getSelectedScheduleWeekStart();
  const picker=document.getElementById("schedule-week-start");
  if(picker&&weekStart){picker.value=weekStart;persistScheduleWeekSelection();}
  const selected=[...document.querySelectorAll(".gen-location-check:checked")].map(el=>el.value).filter(Boolean);
  if(!selected.length){showToast("Select at least one location","warn");return;}
  closeModal();
  runPipelineFromHeader(_pendingGenerateUseAi,{locations:selected});
}

function runPipelineFromHeader(useAi=false,opts={}){
  const weekStart=getSelectedScheduleWeekStart();
  if(!weekStart){showToast("Choose a valid schedule week first","warn");return;}
  const buttons=[document.getElementById("gen-btn"),document.getElementById("gen-ai-btn"),document.getElementById("optimize-ai-btn")];
  buttons.forEach(b=>{if(b)b.disabled=true;});
  setGenerateButtonsLoading(true,useAi);
  
  _settSchedConfig=settNormalizeConfig(_settSchedConfig||{});
  const aiOpts = _settSchedConfig.settings_options||{};
  const apiKey = String(aiOpts.ai_api_key||"").trim();
  const payload = {week_start:weekStart,use_ai:Boolean(useAi)};
  if(Array.isArray(opts.locations)&&opts.locations.length) payload.locations=opts.locations;
  if(useAi){
    if(apiKey) payload.api_key = apiKey;
    payload.ai_provider = "openai";
    payload.ai_model = "gpt-5.4-mini";
    payload.ai_generation_model = "gpt-5.4-mini";
    payload.ai_backup_model = "";
    payload.ai_base_url = "https://api.openai.com/v1";
  }
  schedulerFetch("/api/run-pipeline",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
    .then(r=>r.json())
    .then(res=>{
      if(res.ok){
        const bar=document.getElementById("pipeline-bar");
        const msg=document.getElementById("pb-msg");
        if(bar)bar.className="visible";
        if(msg)msg.textContent=pipelineDisplayMessage(res.message,0);
        const locMsg=Array.isArray(payload.locations)&&payload.locations.length?` · ${payload.locations.length} location${payload.locations.length!==1?"s":""}`:"";
        showToast(`${useAi?"AI generation":"Generation"} started for week of ${weekStart}${locMsg}`,"");
        pollPipelineStatus();
      } else {
        showToast("Error: "+(res.error||"Unknown error"),"error");
        setGenerateButtonsLoading(false);
      }
    })
    .catch(()=>{
      showToast("Server offline — try again","warn");
      setGenerateButtonsLoading(false);
    });
}

function optimizeScheduleWithAI(){
  _settSchedConfig=settNormalizeConfig(_settSchedConfig||{});
  const aiOpts = _settSchedConfig.settings_options||{};
  const apiKey = String(aiOpts.ai_optimize_api_key||aiOpts.ai_api_key||"").trim();
  const payload = {
    iteration:_iter||"Main",
    location:_loc||"",
    view:_view||"grid",
    dashboard_context:chatDashboardContext()
  };
  if(apiKey) payload.api_key=apiKey;
  setOptimizeButtonLoading(true);
  const bar=document.getElementById("pipeline-bar");
  const msg=document.getElementById("pb-msg");
  if(bar)bar.className="visible";
  if(msg)msg.textContent="AI is reviewing the active schedule and validating proposed changes…";
  schedulerFetch("/api/optimize-schedule",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  }).then(r=>r.json().then(j=>({ok:r.ok,json:j}))).then(({ok,json})=>{
    if(!ok||json.error)throw new Error(json.error||"AI optimization failed");
    const applied=Number(json.applied_count||0);
    const rejected=Number(json.rejected_count||0);
    if(bar)bar.className="";
    setOptimizeButtonLoading(false);
    optSumShow(json);
    showToast(`AI optimisation: ${applied} change${applied===1?"":"s"} applied${rejected?`, ${rejected} skipped`:""}`, applied>0?"":"info", 4200);
  }).catch(err=>{
    if(bar)bar.className="visible error";
    if(msg)msg.textContent=err.message||"AI optimization failed";
    showToast(err.message||"AI optimization failed","error",5200);
    setOptimizeButtonLoading(false);
  });
}

// ── Optimize Summary Modal ────────────────────────────────────
function optSumShow(json) {
  const overlay = document.getElementById("opt-sum-overlay");
  const body = document.getElementById("opt-sum-body");
  const title = document.getElementById("opt-sum-title");
  const stat = document.getElementById("opt-sum-footer-stat");
  if (!overlay || !body) return;

  const applied = json.applied || [];
  const rejected = json.rejected || [];
  const summary = json.summary || "";

  title.textContent = `AI Optimisation — ${applied.length} change${applied.length!==1?"s":""} applied`;

  const typeLabels = {
    swap_trainer:"Trainer Swap", add_class:"Class Added", remove_class:"Class Removed",
    move_class:"Class Moved", change_time:"Time Changed", change_class:"Class Changed", change_level:"Level Changed"
  };

  function opIcon(type) {
    return {swap_trainer:"↔",add_class:"+",remove_class:"−",move_class:"→",change_time:"→",change_class:"~",change_level:"~"}[type]||"·";
  }

  function slotMeta(s) {
    if (!s) return "";
    const parts = [];
    if (s.location) parts.push(s.location.replace("House, Kemps Corner","KW").replace("HQ, Bandra","SU").replace(" House","KE"));
    if (s.day_of_week) parts.push(s.day_of_week.slice(0,3));
    if (s.time) parts.push(s.time);
    return parts.join(" · ");
  }

  function changeHtml(item, type) {
    const b = item.before || {};
    const a = item.after || {};
    const opType = item.type || "";
    let changeDesc = "";
    if (opType === "swap_trainer") {
      changeDesc = `<span class="opt-sum-pill trainer">${rvEscapeHtml(b.trainer_1||"?")}</span><span class="opt-sum-arrow">→</span><span class="opt-sum-pill trainer">${rvEscapeHtml(a.trainer_1||"?")}</span>`;
    } else if (opType === "move_class" || opType === "change_time") {
      changeDesc = `<span class="opt-sum-pill time">${rvEscapeHtml(slotMeta(b))}</span><span class="opt-sum-arrow">→</span><span class="opt-sum-pill time">${rvEscapeHtml(slotMeta(a))}</span>`;
    } else if (opType === "change_class") {
      changeDesc = `<span class="opt-sum-pill class-name">${rvEscapeHtml(b.class_name||"?")}</span><span class="opt-sum-arrow">→</span><span class="opt-sum-pill class-name">${rvEscapeHtml(a.class_name||"?")}</span>`;
    } else if (opType === "change_level") {
      changeDesc = `<span class="opt-sum-pill class-name">${rvEscapeHtml(b.class_level||b.level||"?")}</span><span class="opt-sum-arrow">→</span><span class="opt-sum-pill class-name">${rvEscapeHtml(a.class_level||a.level||"?")}</span>`;
    } else if (opType === "add_class") {
      changeDesc = `<span class="opt-sum-pill class-name">${rvEscapeHtml(a.class_name||"?")}</span> with <span class="opt-sum-pill trainer">${rvEscapeHtml(a.trainer_1||"?")}</span>`;
    } else if (opType === "remove_class") {
      changeDesc = `<span class="opt-sum-pill class-name">${rvEscapeHtml(b.class_name||"?")}</span> with <span class="opt-sum-pill trainer">${rvEscapeHtml(b.trainer_1||"?")}</span>`;
    }
    const meta = slotMeta(b) || slotMeta(a);
    const validation = Array.isArray(item.validation) ? item.validation : [];
    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    const detailHtml = [...validation, ...evidence].slice(0, 5).map(line =>
      `<div class="opt-sum-change-reason" style="color:var(--text-muted)">${rvEscapeHtml(line)}</div>`
    ).join("");
    return `<div class="opt-sum-change ${type}">
      <div class="opt-sum-change-icon">${opIcon(opType)}</div>
      <div class="opt-sum-change-body">
        <div class="opt-sum-change-title">${rvEscapeHtml(typeLabels[opType]||opType)}</div>
        <div class="opt-sum-change-meta">${changeDesc}${meta?`<span style="color:var(--text-light);margin:0 5px">·</span><span style="color:var(--text-muted);font-size:9px">${rvEscapeHtml(meta)}</span>`:""}
        </div>
        ${item.reason ? `<div class="opt-sum-change-reason">${rvEscapeHtml(item.reason)}</div>` : ""}
        ${detailHtml}
      </div>
    </div>`;
  }

  let html = "";
  if (summary) html += `<div class="opt-sum-ai-text">"${rvEscapeHtml(summary)}"</div>`;

  if (applied.length) {
    html += `<div class="opt-sum-section"><div class="opt-sum-section-label">Applied changes <span class="opt-sum-section-count green">${applied.length}</span></div>`;
    applied.forEach(item => { html += changeHtml(item, "applied"); });
    html += "</div>";
  }

  if (rejected.length) {
    html += `<div class="opt-sum-section"><div class="opt-sum-section-label">Rejected / skipped <span class="opt-sum-section-count red">${rejected.length}</span></div>`;
    rejected.forEach(item => {
      html += `<div class="opt-sum-change rejected"><div class="opt-sum-change-icon">✗</div><div class="opt-sum-change-body">
        <div class="opt-sum-change-title">${rvEscapeHtml(typeLabels[item.type||""]||item.type||"?")} — ${rvEscapeHtml(item.message||"")}</div>
        ${item.reason ? `<div class="opt-sum-change-reason">AI attempted: ${rvEscapeHtml(item.reason)}</div>` : ""}
        ${Array.isArray(item.validation) ? item.validation.slice(0, 4).map(line => `<div class="opt-sum-change-reason" style="color:var(--text-muted)">${rvEscapeHtml(line)}</div>`).join("") : ""}
      </div></div>`;
    });
    html += "</div>";
  }

  if (!applied.length && !rejected.length) {
    html = `<div style="padding:24px 0;text-align:center;color:var(--text-muted);font-size:13px">No changes were produced. The schedule may already be optimised for the active filters.</div>`;
  }

  body.innerHTML = html;
  if (stat) stat.innerHTML = `<strong>${applied.length}</strong> applied &nbsp;·&nbsp; <strong>${rejected.length}</strong> skipped`;
  overlay.classList.add("open");
}

function optSumClose() {
  const overlay = document.getElementById("opt-sum-overlay");
  if (overlay) overlay.classList.remove("open");
}

function finaliseSchedule(){
  const btn=document.getElementById("finalise-btn");
  const weekStart=getSelectedScheduleWeekStart();
  if(!weekStart){showToast("Choose a valid schedule week first","warn");return;}
  if(btn){btn.disabled=true;btn.textContent="Finalising…";}
  schedulerFetch("/api/finalise-schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({week_start:weekStart})})
    .then(r=>r.json().then(j=>({ok:r.ok,json:j})))
    .then(({ok,json})=>{
      if(!ok||!json.ok)throw new Error(json.error||"Could not finalise schedule");
      const info=json.finalised||{};
      showToast(`Finalised ${info.file_name||"schedule PDF"} to Supabase`,"",4200);
      if(btn)btn.textContent="Finalized";
      setTimeout(()=>{if(btn){btn.disabled=false;btn.textContent="Finalize PDF";}},1800);
    })
    .catch(err=>{
      showToast(err.message||"Could not finalise schedule","error",5200);
      if(btn){btn.disabled=false;btn.textContent="Finalize PDF";}
    });
}

function reportAiRunStatus(d){
  if(!d)return;
  sessionStorage.setItem("last_ai_run_status", JSON.stringify(d));
  const usedGreedy=d.planner_mode==="greedy_fallback"||d.ai_planned===false;
  const repaired=Array.isArray(d.repaired_locations)?d.repaired_locations:[];
  const pct=(typeof d.ai_fraction==="number")?Math.round(d.ai_fraction*100)+"% AI-curated":"";
  if(usedGreedy){
    showToast("Generated with greedy fallback, not AI — check AI API key/model in Control Center","warn",6500);
  }else if(repaired.length){
    showToast("AI-generated"+(pct?" ("+pct+")":"")+", topped up with greedy for: "+repaired.join(", "),"warn",6500);
  }else if(d.planner_mode==="ai"){
    showToast("Generated with AI ("+((d.ai_models||[])[0]||"model")+(pct?", "+pct:"")+")","",3500);
  }
}

function pollPipelineStatus(){
  if(_pipelinePoller)clearInterval(_pipelinePoller);
  const WARN_AFTER_MS=5*60*1000;
  const HARD_STOP_MS=30*60*1000;
  const started=Date.now();
  let warnedLongRun=false;
  const tick=()=>{
    const elapsed=Date.now()-started;
    if(elapsed>HARD_STOP_MS){
      clearInterval(_pipelinePoller);_pipelinePoller=null;
      setGenerateButtonsLoading(false);
      showToast("Pipeline exceeded 30 min — check server logs","warn");
      return;
    }
    schedulerFetch("/api/pipeline-status?ts="+Date.now())
      .then(r=>r.json())
      .then(d=>{
        const bar=document.getElementById("pipeline-bar");
        const msg=document.getElementById("pb-msg");
        const status=(typeof d.status==="string"&&d.status)?d.status:(d.running?"running":"idle");
        if(status==="running"){
          if(!warnedLongRun&&elapsed>WARN_AFTER_MS){
            warnedLongRun=true;
            showToast("Pipeline is still running (over 5 min)","warn",4500);
          }
          if(bar)bar.className="visible";
          if(msg)msg.textContent=pipelineDisplayMessage(d.message,elapsed);
        } else if(status==="done"){
          clearInterval(_pipelinePoller);_pipelinePoller=null;
          if(bar)bar.className="visible";
          if(msg)msg.textContent=d.message||"Schedule ready — reload to see new results";
          setGenerateButtonsLoading(false);
          schedulerFetch("/api/ai-run-status?ts="+Date.now())
            .then(r=>r.json())
            .then(reportAiRunStatus)
            .catch(()=>{})
            .then(()=>{
              showToast("Schedule updated — reloading…","");
              setTimeout(()=>{
                sessionStorage.setItem("new_schedule_generated", "true");
                window.location.reload();
              }, 800);
            });
        } else if(status==="failed"){
          clearInterval(_pipelinePoller);_pipelinePoller=null;
          if(bar){bar.className="visible error";}
          if(msg)msg.textContent=d.message||"Pipeline failed. Check server logs.";
          setGenerateButtonsLoading(false);
          showToast("Pipeline failed — check logs","error");
        } else {
          if(bar)bar.className="";
          setGenerateButtonsLoading(false);
          clearInterval(_pipelinePoller);_pipelinePoller=null;
        }
      })
      .catch(()=>{});
  };
  tick();
  _pipelinePoller=setInterval(tick,2000);
}

// ============================================================
// CONTROL CENTER MODAL — orbital home (6 main categories) -> section view
// ============================================================
const CC_ICONS={
  trainers:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  classes:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2.59 12.6A2 2 0 0 1 2 11.17V4a2 2 0 0 1 2-2h7.17a2 2 0 0 1 1.41.59l7.99 8a2 2 0 0 1 .02 2.82Z"/><circle cx="7.5" cy="7.5" r="1.25"/></svg>`,
  location:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  days:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  universal:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>`,
  ai:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
};
const CONTROL_CENTER_BUCKETS={
  trainers:{label:"Trainers",icon:CC_ICONS.trainers,description:"Directory, availability, certifications, and leave for every trainer. Score priority is derived automatically from tier.",
    entries:[
      {label:"Directory",action:"trainers"},
      {label:"Bulk Ops",action:"trainers-bulk"},
      {label:"Certifications",action:"qualifications"},
      {label:"Leave & Off Days",action:"leave"},
    ]},
  classes:{label:"Classes",icon:CC_ICONS.classes,description:"Everything about a class format — capacity, preferred trainers, and time rules — plus pins and custom rules.",
    entries:[
      {label:"Class Settings",action:"classmix"},
      {label:"Pinned & Custom Rules",action:"customrules"},
    ]},
  location:{label:"Location",icon:CC_ICONS.location,description:"Daily and weekly class-count targets per studio.",
    entries:[{label:"Setup / Targets",action:"targets"}]},
  universal:{label:"Universal Rules",icon:CC_ICONS.universal,description:"Cross-location safeguards applied to every generation.",
    entries:[{label:"Universal Safeguards",action:"universal"}]},
  ai:{label:"AI & General Settings",icon:CC_ICONS.ai,description:"Model policy, validation gates, and scoring weights.",
    entries:[
      {label:"Policy & Options",action:"advanced"},
      {label:"Scoring & Planner",action:"ai"},
    ]},
};
// Buckets whose only content lives inside ssec-rules' 5 native subtabs
// (targets/classmix/custom/universal). Used to filter that shared
// subtab bar down to only the button(s) relevant to the active bucket.
const CC_RULES_SUBTAB_BUCKET={targets:"location",classmix:"classes",custom:"classes",universal:"universal"};

let _ccMode="home";
let _ccActiveBucket=null;

function controlCenterEnsurePanel(){
  const host=document.getElementById("control-center-settings-panel");
  if(!host||host.dataset.loaded==="1")return;
  renderSettingsView(host);
  host.dataset.loaded="1";
}

function renderControlCenterShell(){
  const box=document.getElementById("modal-box"); if(!box)return;
  box.className="modal-box control-center-modal no-hdr";
  box.innerHTML=`
    <button class="modal-close cc-float-close" onclick="closeModal()">✕</button>

    <div class="control-center-shell">
      <div class="control-center-home" id="control-center-home"></div>

      <div class="control-center-section" id="control-center-section" hidden>
        <div class="cc-section-header">
          <button class="cc-back-btn" onclick="controlCenterShowHome()">&larr; Back to Control Center</button>
          <div class="cc-section-top">
            <div class="cc-section-title-row">
              <span class="cc-section-icon" id="cc-section-icon"></span>
              <div>
                <div class="control-center-nav-title" id="control-center-heading"></div>
                <div class="control-center-nav-desc" id="control-center-description"></div>
              </div>
            </div>
            <div class="cc-header-actions">
              <button class="sett-ghost-btn" onclick="settImportConfig()">Import JSON</button>
              <button class="sett-ghost-btn" onclick="settExportConfig()">Export JSON</button>
            </div>
          </div>
        </div>
        <div class="cc-meta-tabs" id="cc-meta-tabs" hidden></div>
        <section class="control-center-panel" id="control-center-settings-panel"></section>
      </div>
    </div>`;
}

function controlCenterStopRotation(){ /* no-op — home is a static grid now, kept as a call-site no-op */ }

function controlCenterRenderHome(){
  const host=document.getElementById("control-center-home");
  if(!host)return;
  host.innerHTML=`
    <div class="cc-grid-canvas">
      <div class="cc-grid">
        ${Object.entries(CONTROL_CENTER_BUCKETS).map(([key,b])=>`
          <button class="cc-tile" data-accent="${key}" onclick="controlCenterEnterBucket('${key}')">
            <span class="cc-tile-icon">${b.icon}</span>
            <span class="cc-tile-body">
              <span class="cc-tile-label">${rvEscapeHtml(b.label)}</span>
              <span class="cc-tile-desc">${rvEscapeHtml(b.description)}</span>
            </span>
            <span class="cc-tile-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </button>`).join("")}
      </div>
    </div>`;
}

function controlCenterFilterRulesSubtabs(bucketKey){
  const bar=document.getElementById("rules-subtabs-bar");
  if(bar){
    const buttons=[...bar.querySelectorAll(".sett-subtab")];
    buttons.forEach(b=>{b.style.display=(CC_RULES_SUBTAB_BUCKET[b.dataset.subtab]===bucketKey)?"":"none";});
    // Every bucket that owns 2+ rules-subtabs already exposes them via its own
    // meta-tab row (cc-meta-tabs) — hide the shared native bar entirely so the
    // same choice never shows twice.
    bar.style.display="none";
  }
  // Buckets whose own meta-tab row already covers their native subtab bar —
  // hide that bar so the same choice isn't shown twice.
  const trainersBar=document.getElementById("trainers-subtabs-bar");
  if(trainersBar)trainersBar.style.display=bucketKey==="trainers"?"none":"";
}

function controlCenterRunAction(action){
  if(action==="trainers-bulk"){settSetTab("trainers");settSetSub("trainers","bulk");return;}
  settSetTab(action);
}

function controlCenterRenderMetaTabs(bucketKey,entryIndex){
  const bucket=CONTROL_CENTER_BUCKETS[bucketKey];
  const host=document.getElementById("cc-meta-tabs");
  if(!host)return;
  if(!bucket||bucket.entries.length<2){
    host.hidden=true;host.innerHTML="";
    return;
  }
  host.hidden=false;
  host.innerHTML=bucket.entries.map((e,i)=>
    `<button class="cc-meta-tab${i===entryIndex?" active":""}" onclick="controlCenterSelectEntry('${bucketKey}',${i})">${rvEscapeHtml(e.label)}</button>`
  ).join("");
}

function controlCenterSelectEntry(bucketKey,entryIndex){
  const bucket=CONTROL_CENTER_BUCKETS[bucketKey];
  if(!bucket)return;
  document.querySelectorAll("#cc-meta-tabs .cc-meta-tab").forEach((b,i)=>b.classList.toggle("active",i===entryIndex));
  controlCenterFilterRulesSubtabs(bucketKey);
  controlCenterRunAction(bucket.entries[entryIndex].action);
}

function controlCenterEnterBucket(bucketKey,entryIndex=0){
  const bucket=CONTROL_CENTER_BUCKETS[bucketKey];
  if(!bucket)return;
  _ccMode="section";
  _ccActiveBucket=bucketKey;
  controlCenterStopRotation();
  const home=document.getElementById("control-center-home");
  const section=document.getElementById("control-center-section");
  if(home)home.hidden=true;
  if(section)section.hidden=false;
  const icon=document.getElementById("cc-section-icon");
  const heading=document.getElementById("control-center-heading");
  const description=document.getElementById("control-center-description");
  if(icon)icon.innerHTML=bucket.icon;
  if(heading)heading.textContent=bucket.label;
  if(description)description.textContent=bucket.description;
  controlCenterRenderMetaTabs(bucketKey,entryIndex);
  controlCenterEnsurePanel();
  controlCenterFilterRulesSubtabs(bucketKey);
  controlCenterRunAction(bucket.entries[entryIndex].action);
}

function controlCenterShowHome(){
  _ccMode="home";
  _ccActiveBucket=null;
  const home=document.getElementById("control-center-home");
  const section=document.getElementById("control-center-section");
  if(section)section.hidden=true;
  if(home){home.hidden=false;controlCenterRenderHome();}
}

function openControlCenterModal(bucketKey=null){
  renderControlCenterShell();
  if(bucketKey&&CONTROL_CENTER_BUCKETS[bucketKey]){
    controlCenterEnterBucket(bucketKey);
  } else {
    controlCenterShowHome();
  }
  document.getElementById("modal-overlay").classList.add("open");
}

// ============================================================
// SHARED RULES CATALOG — used as fallback data + escaping helpers
// ============================================================
const BUILTIN_RULES_CATALOG={
  groups:[
    {id:"universal",label:"Universal",description:"Apply to all 3 studio locations",enabled:true,rules:[
      {id:"UNIV-001",type:"hard",label:"Barre 57 ≥ 25% of weekly classes",description:"Barre 57 family must be ≥ 25% of total weekly classes at any location",enabled:true,risk_level:"critical",impact_area:"Class Mix",status_tag:"Mandatory"},
      {id:"UNIV-002",type:"hard",label:"All 3 time bands covered daily",description:"All 3 time bands must have ≥ 1 class every weekday (morning / midday / evening)",enabled:true,risk_level:"critical",impact_area:"Slot Coverage",status_tag:"Mandatory"},
      {id:"UNIV-003",type:"hard",label:"Saturday morning is high-load",description:"Saturday morning should carry strong demand coverage without violating weekly floors, trainer caps, or quality gates",enabled:true,risk_level:"high",impact_area:"Day Distribution",status_tag:"Recommended"},
      {id:"UNIV-004",type:"hard",label:"Sunday max 5–6 classes, no early/evening",description:"Sunday max 5–6 classes. No class before 10:00. No evening band.",enabled:true,risk_level:"high",impact_area:"Sunday Policy",status_tag:"Mandatory"},
      {id:"UNIV-005",type:"hard",label:"Specialist classes — certified trainers only",description:"PowerCycle, Strength Lab, Pre/Post Natal, Foundations — only certified trainers may teach",enabled:true,risk_level:"critical",impact_area:"Trainer Certification",status_tag:"Mandatory"},
      {id:"UNIV-006",type:"hard",label:"Express class must pair with full-length equivalent",description:"Any Express class must be paired with a full-length equivalent of the same type on the same day",enabled:true,risk_level:"high",impact_area:"Class Pairing",status_tag:"Recommended"},
      {id:"UNIV-007",type:"hard",label:"Studio Recovery never first class of day",description:"Studio Recovery must NEVER be the first class of the day at any location",enabled:true,risk_level:"high",impact_area:"Class Ordering",status_tag:"Mandatory"},
      {id:"UNIV-008",type:"hard",label:"Foundations must never be scheduled",description:"Foundations is blocked from auto-scheduling in every slot",enabled:true,risk_level:"high",impact_area:"Class Restriction",status_tag:"Mandatory"},
      {id:"UNIV-009",type:"hard",label:"No trainer > 3 consecutive classes without gap",description:"No trainer more than 3 consecutive classes without ≥ 30 min gap",enabled:true,risk_level:"high",impact_area:"Trainer Welfare",status_tag:"Mandatory"},
      {id:"UNIV-010",type:"hard",label:"No trainer > 4 classes per day",description:"No trainer more than 4 classes in one day",enabled:true,risk_level:"critical",impact_area:"Trainer Welfare",status_tag:"Mandatory"},
      {id:"UNIV-011",type:"hard",label:"PowerCycle never at Kenkere",description:"PowerCycle NEVER at Kenkere House — not for any reason",enabled:true,risk_level:"critical",impact_area:"Location Restriction",status_tag:"Mandatory"},
      {id:"UNIV-012",type:"hard",label:"Strength Lab only at Kwality",description:"Strength Lab ONLY at Kwality House, Kemps Corner",enabled:true,risk_level:"critical",impact_area:"Location Restriction",status_tag:"Mandatory"},
      {id:"UNIV-013",type:"hard",label:"Pre/Post Natal only at Kwality",description:"Pre/Post Natal ONLY at Kwality House, Kemps Corner",enabled:true,risk_level:"critical",impact_area:"Location Restriction",status_tag:"Mandatory"},
      {id:"UNIV-014",type:"hard",label:"Peak midday slot never empty",description:"Peak midday slot must never be empty at any location",enabled:true,risk_level:"critical",impact_area:"Slot Coverage",status_tag:"Mandatory"},
      {id:"UNIV-015",type:"always_do",label:"≥ 1 Barre 57 before 10:00 AM every day",description:"Always schedule ≥ 1 Barre 57 before 10:00 AM every day",enabled:true,risk_level:"high",impact_area:"Morning Programming",status_tag:"Recommended"},
      {id:"UNIV-016",type:"always_do",label:"Barre 57 or Cardio Barre in 19:00–19:30 on weekdays",description:"Always schedule Barre 57 or Cardio Barre in the 19:00–19:30 window on weekdays",enabled:true,risk_level:"high",impact_area:"Evening Programming",status_tag:"Recommended"},
      {id:"UNIV-017",type:"always_do",label:"Tier 1 trainer at primary peak slot",description:"Always assign a Tier 1 trainer to the primary peak slot",enabled:true,risk_level:"high",impact_area:"Trainer Quality",status_tag:"Recommended"},
      {id:"UNIV-018",type:"trainer_availability",label:"Substitution: same tier + class → one tier lower → cross-location",description:"Trainer substitution protocol: same tier + same class → one tier lower + same class → cross-location trainer with ≥ 30 sessions at that location",enabled:true,risk_level:"medium",impact_area:"Substitution",status_tag:"Recommended"},
      {id:"UNIV-019",type:"hard",label:"No substitution for specialist classes with non-certified trainers",description:"Specialist classes (PowerCycle, Strength Lab, Pre/Post Natal) — NO substitution with non-certified trainers",enabled:true,risk_level:"critical",impact_area:"Trainer Certification",status_tag:"Mandatory"},
      {id:"UNIV-020",type:"hard",label:"No trainer where they have < 30 historical sessions",description:"Never roster a trainer at a location where they have < 30 historical sessions",enabled:true,risk_level:"high",impact_area:"Trainer History",status_tag:"Recommended"},
    ]},
    {id:"kwality",label:"Kwality House",description:"Kwality House, Kemps Corner specific rules",enabled:true,rules:[
      {id:"KW-001",type:"always_do",label:"11:30 AM slot — Tier 1 trainer always",description:"11:30 AM slot must always be filled with a Tier 1 trainer",enabled:true,risk_level:"critical",impact_area:"Peak Slot",status_tag:"Mandatory"},
      {id:"KW-002",type:"trainer_availability",label:"Anisha Shah — Mon/Tue/Wed only at Kwality",description:"Anisha Shah → Mon/Tue/Wed ONLY. Never Thu/Sat/Sun at Kwality.",enabled:true,risk_level:"high",impact_area:"Trainer Lock",status_tag:"Mandatory"},
      {id:"KW-003",type:"trainer_availability",label:"Mrigakshi Jaiswal — Thu/Fri only at Kwality",description:"Mrigakshi Jaiswal → Thu/Fri ONLY at Kwality.",enabled:true,risk_level:"high",impact_area:"Trainer Lock",status_tag:"Mandatory"},
      {id:"KW-004",type:"trainer_availability",label:"Pranjali Jain owns Saturday 10:15–12:30",description:"Pranjali Jain owns Saturday 10:15–12:30 block at Kwality",enabled:true,risk_level:"high",impact_area:"Owned Block",status_tag:"Mandatory"},
      {id:"KW-005",type:"trainer_availability",label:"Rohan Dahima owns Thursday morning block",description:"Rohan Dahima owns Thursday morning (09:15, 10:15) block at Kwality",enabled:true,risk_level:"high",impact_area:"Owned Block",status_tag:"Mandatory"},
      {id:"KW-006",type:"hard",label:"Strength Lab — Atulan exclusively, Mon/Wed evenings",description:"Strength Lab → Atulan Purohit EXCLUSIVELY. Mon/Wed evenings only. Max 2×/week.",enabled:true,risk_level:"critical",impact_area:"Specialist Class",status_tag:"Mandatory"},
      {id:"KW-007",type:"hard",label:"Pre/Post Natal — Anisha (Mon–Wed) / Mrigakshi (Thu–Fri)",description:"Pre/Post Natal → Anisha Shah (Mon–Wed), Mrigakshi Jaiswal (Thu–Fri). Mornings only (08:30–11:30).",enabled:true,risk_level:"critical",impact_area:"Specialist Class",status_tag:"Mandatory"},
      {id:"KW-008",type:"soft",label:"Strength Lab max 2×/week total",description:"Strength Lab max 2× per week total at Kwality",enabled:true,risk_level:"medium",impact_area:"Class Volume",status_tag:"Recommended"},
    ]},
    {id:"supreme",label:"Supreme HQ",description:"Supreme HQ, Bandra specific rules",enabled:true,rules:[
      {id:"SU-001",type:"hard",label:"PowerCycle equal pillar — min 2 per weekday",description:"PowerCycle must be treated as equal pillar to Barre 57 — minimum 2 PowerCycle classes per day on weekdays",enabled:true,risk_level:"critical",impact_area:"Class Mix",status_tag:"Mandatory"},
      {id:"SU-002",type:"always_do",label:"Cauveri Vikrant — first choice for all PowerCycle at Supreme",description:"Cauveri Vikrant is first-choice for ALL PowerCycle slots at Supreme",enabled:true,risk_level:"high",impact_area:"Trainer Priority",status_tag:"Mandatory"},
      {id:"SU-003",type:"trainer_availability",label:"Anisha Shah — Thursdays only at Supreme",description:"Anisha Shah → THURSDAYS ONLY at Supreme HQ. Never any other day. Teaches 08:00–11:00 block only.",enabled:true,risk_level:"critical",impact_area:"Trainer Lock",status_tag:"Mandatory"},
      {id:"SU-004",type:"trainer_availability",label:"Vivaran Dhasmana owns Tue/Wed mornings at Supreme",description:"Vivaran Dhasmana owns Tue/Wed morning blocks (07:30–11:00) at Supreme",enabled:true,risk_level:"high",impact_area:"Owned Block",status_tag:"Mandatory"},
      {id:"SU-005",type:"trainer_availability",label:"Karan Bhatia owns Sunday 10:15 and 11:30 at Supreme",description:"Karan Bhatia owns Sunday 10:15 and 11:30 blocks at Supreme",enabled:true,risk_level:"high",impact_area:"Owned Block",status_tag:"Mandatory"},
      {id:"SU-006",type:"trainer_availability",label:"Atulan Purohit owns Fri/Sat mornings at Supreme",description:"Atulan Purohit owns Fri/Sat morning block (09:00–11:30) at Supreme",enabled:true,risk_level:"high",impact_area:"Owned Block",status_tag:"Mandatory"},
      {id:"SU-007",type:"trainer_availability",label:"Mrigakshi Jaiswal — Mon/Tue/Wed evenings only at Supreme",description:"Mrigakshi Jaiswal → Mon/Tue/Wed evenings only at Supreme. Not available other days here.",enabled:true,risk_level:"high",impact_area:"Trainer Lock",status_tag:"Mandatory"},
      {id:"SU-008",type:"always_do",label:"18:00 weekday slot — Tier 1 trainer",description:"18:00 PM slot must always have a Tier 1 trainer on weekdays",enabled:true,risk_level:"high",impact_area:"Peak Slot",status_tag:"Recommended"},
      {id:"SU-009",type:"never_do",label:"No Strength Lab at Supreme",description:"No Strength Lab at Supreme HQ — Kwality only",enabled:true,risk_level:"critical",impact_area:"Location Restriction",status_tag:"Mandatory"},
      {id:"SU-010",type:"never_do",label:"No Pre/Post Natal at Supreme",description:"No Pre/Post Natal at Supreme HQ — Kwality only",enabled:true,risk_level:"critical",impact_area:"Location Restriction",status_tag:"Mandatory"},
    ]},
    {id:"kenkere",label:"Kenkere House",description:"Kenkere House, Bengaluru specific rules",enabled:true,rules:[
      {id:"KE-001",type:"never_do",label:"PowerCycle NEVER at Kenkere",description:"PowerCycle NEVER at Kenkere House — not for any reason",enabled:true,risk_level:"critical",impact_area:"Location Restriction",status_tag:"Mandatory"},
      {id:"KE-002",type:"always_do",label:"Kajol Kanchan — 6-day anchor, never reduce",description:"Kajol Kanchan is 6-day anchor — never reduce her allocation without confirmed coverage",enabled:true,risk_level:"critical",impact_area:"Trainer Anchor",status_tag:"Mandatory"},
      {id:"KE-003",type:"trainer_availability",label:"Pushyank Nahar owns Mon/Tue/Thu mornings",description:"Pushyank Nahar owns Mon/Tue/Thu morning blocks (07:15, 09:00, 11:00)",enabled:true,risk_level:"high",impact_area:"Owned Block",status_tag:"Mandatory"},
      {id:"KE-004",type:"trainer_availability",label:"Shruti Kulkarni owns Thu/Fri mornings + Sunday midday",description:"Shruti Kulkarni owns Thu/Fri mornings and Sunday midday",enabled:true,risk_level:"high",impact_area:"Owned Block",status_tag:"Mandatory"},
      {id:"KE-005",type:"trainer_availability",label:"Veena Narasimhan — weekends 16:00–17:15 only",description:"Veena Narasimhan → weekends ONLY, 16:00–17:15 window ONLY",enabled:true,risk_level:"medium",impact_area:"Trainer Lock",status_tag:"Mandatory"},
      {id:"KE-006",type:"trainer_availability",label:"Chaitanya Nahar — Mon/Sat/Sun afternoons only",description:"Chaitanya Nahar → Mon/Sat/Sun afternoons only (16:00–18:45). Never mornings.",enabled:true,risk_level:"high",impact_area:"Trainer Lock",status_tag:"Mandatory"},
      {id:"KE-007",type:"always_do",label:"09:00 AM — Tier 1 trainer every day",description:"09:00 AM must be filled with a Tier 1 trainer every day at Kenkere",enabled:true,risk_level:"critical",impact_area:"Peak Slot",status_tag:"Mandatory"},
      {id:"KE-008",type:"hard",label:"Saturday 09:00–11:00 — Kajol or Pushyank only",description:"Saturday 09:00–11:00 block → Kajol Kanchan or Pushyank Nahar ONLY",enabled:true,risk_level:"high",impact_area:"Owned Block",status_tag:"Mandatory"},
      {id:"KE-009",type:"hard",label:"Foundations — certified trainers only at Kenkere",description:"Foundations certified trainers only: Shruti Kulkarni, Poojitha Bhaskar, Siddhartha Kusuma, Shruti Suresh, Pushyank Nahar, Kajol Kanchan",enabled:true,risk_level:"critical",impact_area:"Trainer Certification",status_tag:"Mandatory"},
    ]},
    {id:"classmix",label:"Class Mix",description:"Weekly class mix targets and soft constraints",enabled:true,rules:[
      {id:"MIX-001",type:"soft",label:"Barre 57 family 45–55% of weekly classes",description:"Barre 57 family 45–55% of weekly classes. Penalty 10 per % below 45.",enabled:true,risk_level:"high",impact_area:"Class Mix",status_tag:"Recommended"},
      {id:"MIX-002",type:"soft",label:"PowerCycle: 8–10% at Kwality, 25–28% at Supreme, 0% at Kenkere",description:"PowerCycle 8–10% at Kwality, 25–28% at Supreme, 0% at Kenkere",enabled:true,risk_level:"high",impact_area:"Class Mix",status_tag:"Recommended"},
      {id:"MIX-003",type:"soft",label:"Mat 57 min 3–4×/week per location",description:"Mat 57 minimum 3–4× per week at each location",enabled:true,risk_level:"medium",impact_area:"Class Mix",status_tag:"Recommended"},
      {id:"MIX-004",type:"soft",label:"FIT 1× daily, morning slots",description:"FIT 1× daily, morning slots preferred",enabled:true,risk_level:"medium",impact_area:"Class Mix",status_tag:"Recommended"},
      {id:"MIX-005",type:"soft",label:"Foundations disabled",description:"Foundations class mix is currently set to zero and should not be generated",enabled:true,risk_level:"high",impact_area:"Class Mix",status_tag:"Mandatory"},
      {id:"MIX-006",type:"soft",label:"Recovery — weekends only, afternoon slots",description:"Recovery weekends only, afternoon slots (12:30–16:00)",enabled:true,risk_level:"low",impact_area:"Class Mix",status_tag:"Optional"},
      {id:"MIX-007",type:"soft",label:"Back Body Blaze — morning only, max 3×/week",description:"Back Body Blaze morning only (07:30–09:00), max 3×/week",enabled:true,risk_level:"low",impact_area:"Class Mix",status_tag:"Optional"},
      {id:"MIX-008",type:"soft",label:"Studio Amped Up! max 1–2×/week; Reshma or Rohan only",description:"Studio Amped Up! max 1–2×/week; Reshma Sharma or Rohan Dahima only",enabled:true,risk_level:"low",impact_area:"Class Mix",status_tag:"Optional"},
      {id:"MIX-009",type:"soft",label:"Cardio Barre 1×/day, evenings preferred",description:"Cardio Barre 1×/day, evenings preferred",enabled:false,risk_level:"low",impact_area:"Class Mix",status_tag:"Optional"},
      {id:"MIX-010",type:"soft",label:"Strength Lab max 2×/week at Kwality, Mon/Wed evenings",description:"Strength Lab max 2×/week at Kwality, Mon/Wed evenings only",enabled:true,risk_level:"medium",impact_area:"Class Mix",status_tag:"Recommended"},
    ]},
    {id:"slots",label:"Slot Priority",description:"Slot filling priority and peak window rules",enabled:true,rules:[
      {id:"SLOT-001",type:"slot_required",label:"Always fill peak midday and prime evening",description:"Always fill peak midday (11:00–11:30) and prime evening (19:00–19:30)",enabled:true,risk_level:"critical",impact_area:"Slot Coverage",status_tag:"Mandatory"},
      {id:"SLOT-002",type:"slot_required",label:"Fill morning block and early evening",description:"Fill morning block (08:00–09:30) and early evening (17:45–18:15)",enabled:true,risk_level:"high",impact_area:"Slot Coverage",status_tag:"Recommended"},
      {id:"SLOT-003",type:"slot_required",label:"Fill early morning and late evening if trainers available",description:"Fill early morning (07:00–07:30) and late evening (20:00) if trainers available",enabled:false,risk_level:"low",impact_area:"Slot Coverage",status_tag:"Optional"},
      {id:"SLOT-004",type:"soft",label:"Mid-afternoon optional — location dependent",description:"Mid-afternoon (13:00–16:00) optional — location dependent",enabled:false,risk_level:"low",impact_area:"Slot Coverage",status_tag:"Optional"},
    ]},
  ]
};

let _rulesCatalog=null;

function rvEscapeHtml(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function rvEscapeAttr(v){return rvEscapeHtml(v).replace(/\n/g,"&#10;");}

// ============================================================
// HISTORY VIEW — Historical slot baseline from scored data
// ============================================================
let _histData=null;
let _histLoc=null;
let _histSort="score";
let _histVisibleRows=[];

function renderHistoryView(area){
  const wrap=document.createElement("div");
  wrap.className="hist-view";
  wrap.innerHTML=`
    <div class="hist-view-header">
      <div class="hist-view-title">📊 Historical Baseline</div>
      <div class="hist-view-sub">All known class+trainer+slot combinations ranked by performance. Auto-protected slots (🔒) are those above the studio average fill rate with sufficient history.</div>
    </div>
    <div id="hist-loc-tabs" class="hist-loc-tabs"></div>
    <div class="hist-sort-row">
      <span class="hist-sort-label">Sort by:</span>
      <button class="hist-sort-btn active" id="hsort-score" onclick="histSetSort('score')">Score</button>
      <button class="hist-sort-btn" id="hsort-fill" onclick="histSetSort('fill')">Fill Rate</button>
      <button class="hist-sort-btn" id="hsort-sessions" onclick="histSetSort('sessions')">Sessions</button>
      <button class="hist-sort-btn" id="hsort-day" onclick="histSetSort('day')">Day/Time</button>
    </div>
    <div id="hist-summary-row" class="hist-summary-row"></div>
    <div id="hist-content"></div>`;
  area.appendChild(wrap);
  if(_histData){histRenderContent();}
  else{
    document.getElementById("hist-content").innerHTML=`<div class="hist-empty">Loading historical data…</div>`;
    schedulerFetch("/api/historic-slots")
      .then(r=>r.json())
      .then(d=>{_histData=d;histRenderContent();})
      .catch(()=>{document.getElementById("hist-content").innerHTML=`<div class="hist-empty">Could not load historical data. Run the pipeline first to generate scores.</div>`;});
  }
}

function histSetSort(s){
  _histSort=s;
  document.querySelectorAll(".hist-sort-btn").forEach(b=>b.classList.remove("active"));
  const el=document.getElementById("hsort-"+s);
  if(el)el.classList.add("active");
  histRenderContent();
}

function histRenderContent(){
  if(!_histData)return;
  const ranking=(_histData.slot_group_ranking||_histData.class_slot_ranking||[]);
  const locs=[...new Set(ranking.map(r=>r.location))].filter(Boolean).sort();
  if(!_histLoc&&locs.length)_histLoc=locs[0];

  const tabBar=document.getElementById("hist-loc-tabs");
  if(tabBar){
    tabBar.innerHTML=locs.map(l=>`<button class="hist-loc-tab${l===_histLoc?" active":""}" onclick="histSetLoc('${l.replace(/'/g,"\\'")}')"> ${l.length>28?l.slice(0,26)+"…":l}</button>`).join("");
  }

  const locSlots=ranking.filter(r=>r.location===_histLoc);
  const sorted=[...locSlots].sort((a,b)=>{
    if(_histSort==="score")return(b.score||0)-(a.score||0);
    if(_histSort==="fill")return(b.blended_fill||0)-(a.blended_fill||0);
    if(_histSort==="sessions")return(b.session_count||0)-(a.session_count||0);
    if(_histSort==="day"){
      const dayOrd={Monday:0,Tuesday:1,Wednesday:2,Thursday:3,Friday:4,Saturday:5,Sunday:6};
      const dc=(dayOrd[a.day_name]||0)-(dayOrd[b.day_name]||0);
      return dc!==0?dc:(a.time||"").localeCompare(b.time||"");
    }
    return 0;
  });

  const sumEl=document.getElementById("hist-summary-row");
  if(sumEl){
    const protect=locSlots.filter(r=>r.recommendation==="PROTECT").length;
    const autoP=locSlots.filter(r=>r.above_studio_avg).length;
    const avgFill=locSlots.length?locSlots.reduce((a,r)=>a+(r.blended_fill||0),0)/locSlots.length:0;
    const studioAvg=locSlots.length?locSlots[0].studio_avg_fill:null;
    sumEl.innerHTML=`
      <span class="hist-sum-chip"><span>${locSlots.length}</span> combos tracked</span>
      <span class="hist-sum-chip">Avg fill <span>${pct(avgFill)}</span></span>
      ${studioAvg!=null?`<span class="hist-sum-chip">Studio avg <span>${pct(studioAvg)}</span></span>`:""}
      <span class="hist-sum-chip">🛡 Protect <span>${protect}</span></span>
      <span class="hist-sum-chip">🔒 Auto-protected <span>${autoP}</span></span>`;
  }

  const content=document.getElementById("hist-content");
  if(!content)return;
  if(!sorted.length){content.innerHTML=`<div class="hist-empty">No historical data for this location. Run the pipeline to generate scores.</div>`;return;}

  _histVisibleRows=sorted;
  content.innerHTML=`<div class="hist-table-wrap"><table class="hist-table">
    <thead><tr>
      <th>Rank</th><th>Class</th><th>Day</th><th>Time</th><th>Score</th><th>Status</th>
      <th>Avg Attendance</th><th>Fill</th><th>Revenue</th><th>Sessions</th><th>Top Trainer</th><th></th>
    </tr></thead>
    <tbody>${sorted.map((r,i)=>{
      const top=(r.top_trainers&&r.top_trainers[0])||{};
      const status=r.pinned_slot?"PINNED":(r.protect_class_time?"PROTECTED":(r.recommendation||""));
      return`<tr>
        <td>${i+1}</td>
        <td><strong>${displayClass(r.class)}</strong><br><span style="color:var(--text-light)">${r.unique_id_1||""}</span></td>
        <td>${r.day_name||""}</td>
        <td>${r.time||""}</td>
        <td><strong>${Math.round(r.score||0)}</strong></td>
        <td>${status}</td>
        <td>${round1(r.avg_attendance??r.avg_checkin)}</td>
        <td style="color:${fillColor(r.avg_fill_rate||r.blended_fill||0)}">${pct(r.avg_fill_rate||r.blended_fill,1)}</td>
        <td>₹${Number(r.avg_revenue||0).toLocaleString("en-IN",{maximumFractionDigits:0})}</td>
        <td>${r.session_count||0}</td>
        <td>${top.trainer||r.trainer||"—"}${top.score!=null?`<br><span style="color:var(--text-light)">${Math.round(top.score)} pts</span>`:""}</td>
        <td><button class="hist-row-action" onclick="openHistoricModal(${i})">Drill down</button></td>
      </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function histSetLoc(loc){
  _histLoc=loc;
  histRenderContent();
}

function openHistoricModal(index){
  const r=_histVisibleRows[index];
  if(!r)return;
  const h=r.historic_detail||{};
  const trainers=r.top_trainers||[];
  const status=r.pinned_slot?"PINNED SLOT":(r.protect_class_time?"PROTECTED SLOT":(r.recommendation||""));
  const box=document.getElementById("modal-box");
  box.className="modal-box";
  const metricRows=[
    ["UniqueID1",r.unique_id_1||"—"],["Class",displayClass(r.class)],["Location",r.location||"—"],
    ["Day / Time",`${r.day_name||"—"} ${r.time||""}`],["Score",`${(r.score||0).toFixed(1)}/100`],["Status",status],
    ["Avg attendance",round1(r.avg_attendance??r.avg_checkin)],["Capacity fill",pct(r.avg_fill_rate||r.blended_fill,1)],
    ["Avg revenue",`₹${Number(r.avg_revenue||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`],["Sessions",r.session_count||0],
    ["Session rows",h.session_rows??"—"],["Avg booked",h.avg_booked!=null?round1(h.avg_booked):"—"],
    ["Avg capacity",h.avg_capacity!=null?round1(h.avg_capacity):"—"],["Total revenue",h.total_revenue!=null?`₹${Number(h.total_revenue).toLocaleString("en-IN",{maximumFractionDigits:0})}`:"—"],
    ["Late cancel",h.avg_late_cancel_rate!=null?pct(h.avg_late_cancel_rate,1):"—"],["No show",h.avg_no_show_rate!=null?pct(h.avg_no_show_rate,1):"—"],
  ];
  box.innerHTML=`
    <div class="modal-hdr">
      <div><div class="modal-class-name">${displayClass(r.class)}</div><div class="modal-meta">${r.location||""} · ${r.day_name||""} ${r.time||""} · ${status}</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="hist-modal-tabs">
      <button class="hist-modal-tab active" onclick="histModalTab('summary')">Summary</button>
      <button class="hist-modal-tab" onclick="histModalTab('trainers')">Trainer Ranking</button>
      <button class="hist-modal-tab" onclick="histModalTab('classes')">Class Rows</button>
      <button class="hist-modal-tab" onclick="histModalTab('scoring')">Scoring</button>
      <button class="hist-modal-tab" onclick="histModalTab('definitions')">Definitions</button>
      <button class="hist-modal-tab" onclick="histModalTab('raw')">Raw Metrics</button>
    </div>
    <div class="modal-body">
      <div class="hist-tab-panel active" id="hist-panel-summary">
        <div class="modal-metrics">
          <div class="mm"><div class="mm-l">Score</div><div class="mm-v">${(r.score||0).toFixed(1)}</div><div class="mm-s">weighted class slot score</div></div>
          <div class="mm"><div class="mm-l">Avg Attendance</div><div class="mm-v">${round1(r.avg_attendance??r.avg_checkin)}</div><div class="mm-s">highest weight</div></div>
          <div class="mm"><div class="mm-l">Fill Rate</div><div class="mm-v">${pct(r.avg_fill_rate||r.blended_fill,1)}</div><div class="mm-s">capacity utilization</div></div>
        </div>
        <table class="hist-modal-table" style="margin-top:12px"><tbody>${metricRows.map(([k,v])=>`<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>
      </div>
      <div class="hist-tab-panel" id="hist-panel-trainers">
        <table class="hist-modal-table"><thead><tr><th>Rank</th><th>Trainer</th><th>UniqueID2</th><th>Score</th><th>Avg Attendance</th><th>Fill</th><th>Revenue</th><th>Sessions</th></tr></thead>
        <tbody>${trainers.map((t,i)=>`<tr><td>${i+1}</td><td>${t.trainer}</td><td>${t.unique_id_2||""}</td><td>${(t.score||0).toFixed(1)}</td><td>${round1(t.avg_attendance)}</td><td>${pct(t.avg_fill_rate,1)}</td><td>₹${Number(t.avg_revenue||0).toLocaleString("en-IN",{maximumFractionDigits:0})}</td><td>${t.session_count||0}</td></tr>`).join("")||`<tr><td colspan="8">No trainer-level UniqueID2 metrics found.</td></tr>`}</tbody></table>
      </div>
      <div class="hist-tab-panel" id="hist-panel-classes">
        ${sessionRowsTable((h.individual_sessions||[]))}
      </div>
      <div class="hist-tab-panel" id="hist-panel-scoring">
        <div class="hist-formula">Score = average attendance × 75 + fill × 15 + revenue × 7 + sessions × 3. PowerCycle: fill × 50. Strength: fill × 70.</div>
        ${scoreBreakdownHtml(r.score_breakdown)}
      </div>
      <div class="hist-tab-panel" id="hist-panel-definitions">
        ${metricDefinitionsHtml()}
      </div>
      <div class="hist-tab-panel" id="hist-panel-raw">
        ${historicDrilldownHtml(r)}
      </div>
    </div>`;
  document.getElementById("modal-overlay").classList.add("open");
}

function tbcFillPillClass(fill){
  const f=fill||0;
  if(f>=0.5)return"tbc-pill tbc-pill-great";
  if(f>=0.28)return"tbc-pill tbc-pill-good";
  if(f>=0.22)return"tbc-pill tbc-pill-mid";
  return"tbc-pill tbc-pill-weak";
}
function tbcVsStudioAvg(r){
  const studioAvg=r.studio_avg_fill;
  if(studioAvg==null||!isFinite(studioAvg))return"—";
  const delta=(r.avg_fill_rate||0)-studioAvg;
  const sign=delta>=0?"+":"";
  const cls=delta>=0?"tbc-delta-pos":"tbc-delta-neg";
  return `<span class="${cls}">${sign}${(delta*100).toFixed(1)}pp</span>`;
}
function tbcRecommendationBadge(r){
  const rec=String(r.recommendation||"").toUpperCase();
  const map={
    DROP:["modal-badge-drop","Drop"],
    CONSIDER:["modal-badge-consider","Consider"],
    INCLUDE:["modal-badge-include","Include"],
  };
  const [cls,label]=map[rec]||["modal-badge-manual",rec?rec[0]+rec.slice(1).toLowerCase():"—"];
  return `<span class="modal-badge ${cls}">${label}</span>`;
}
function tbcSummaryChips(rows,label){
  if(!rows.length)return"";
  const avgFill=rows.reduce((s,r)=>s+(r.avg_fill_rate||0),0)/rows.length;
  const avgScore=rows.reduce((s,r)=>s+(r.score||0),0)/rows.length;
  const avgRevenue=rows.reduce((s,r)=>s+(r.avg_revenue||0),0)/rows.length;
  const totalSessions=rows.reduce((s,r)=>s+(r.trainer_total_sessions||r.session_count||0),0);
  return `<div class="tbc-summary">
    <div class="tbc-chip"><div class="tbc-chip-l">${label} shown</div><div class="tbc-chip-v">${rows.length}</div></div>
    <div class="tbc-chip"><div class="tbc-chip-l">Avg fill</div><div class="tbc-chip-v">${pct(avgFill,1)}</div></div>
    <div class="tbc-chip"><div class="tbc-chip-l">Avg score</div><div class="tbc-chip-v">${avgScore.toFixed(1)}</div></div>
    <div class="tbc-chip"><div class="tbc-chip-l">Avg revenue</div><div class="tbc-chip-v">₹${Math.round(avgRevenue).toLocaleString("en-IN")}</div></div>
    <div class="tbc-chip"><div class="tbc-chip-l">Total sessions</div><div class="tbc-chip-v">${totalSessions}</div></div>
  </div>`;
}

async function openTopBottomClassesModal(){
  await ensureHistoricSlotsLoaded();
  const activeLocs=new Set(getActiveLocations());
  const ranking=(_historicSlotsCache?.class_slot_ranking||[]).filter(r=>activeLocs.has(r.location));
  const sessionsOf=r=>r.trainer_total_sessions||r.session_count||0;
  const top=ranking
    .filter(r=>(r.avg_fill_rate||0)>=0.28&&sessionsOf(r)>=5)
    .sort((a,b)=>(b.score||0)-(a.score||0)||(b.avg_fill_rate||0)-(a.avg_fill_rate||0))
    .slice(0,25);
  const bottom=ranking
    .filter(r=>(r.avg_fill_rate||0)<0.22&&sessionsOf(r)>=5)
    .sort((a,b)=>(a.avg_fill_rate||0)-(b.avg_fill_rate||0))
    .slice(0,25);
  _histVisibleRows=[...top,...bottom];

  const row=(r,i,rank)=>`<tr onclick="openHistoricModal(${i})" class="tbc-row">
    <td class="num tbc-rank">${rank}</td>
    <td>${displayClass(r.class)}</td><td>${r.trainer||"—"}</td><td>${r.location||"—"}</td>
    <td>${r.day_name||""} ${r.time||""}</td>
    <td><span class="${tbcFillPillClass(r.avg_fill_rate)}">${pct(r.avg_fill_rate,1)}</span></td>
    <td class="num">${tbcVsStudioAvg(r)}</td>
    <td class="num">${round1(r.avg_checkin)}</td>
    <td class="num">₹${Number(r.avg_revenue||0).toLocaleString("en-IN",{maximumFractionDigits:0})}</td>
    <td class="num">${(r.score||0).toFixed(1)}</td>
    <td class="num">${sessionsOf(r)}</td>
    <td>${tbcRecommendationBadge(r)}</td>
  </tr>`;
  const table=(rows,offset,emptyMsg,label)=>`${tbcSummaryChips(rows,label)}<table class="hist-modal-table tbc-table"><thead><tr>
    <th>#</th><th>Class</th><th>Trainer</th><th>Location</th><th>Day/Time</th><th>Fill</th><th>vs Studio Avg</th><th>Avg Check-in</th><th>Avg Revenue</th><th>Score</th><th>Sessions</th><th>Status</th>
  </tr></thead><tbody>${rows.map((r,i)=>row(r,offset+i,i+1)).join("")||`<tr><td colspan="12">${emptyMsg}</td></tr>`}</tbody></table>`;

  const box=document.getElementById("modal-box");
  box.className="modal-box tbc-modal";
  box.innerHTML=`
    <div class="modal-hdr">
      <div><div class="modal-class-name">Top &amp; Bottom Classes</div>
        <div class="modal-meta">${[...activeLocs].join(", ")||"All locations"} · fill≥28% + ≥5 sessions for top, fill&lt;22% + ≥5 sessions for bottom</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="hist-modal-tabs">
      <button class="hist-modal-tab active" onclick="tbcModalTab('top')">🏆 Top Performers (${top.length})</button>
      <button class="hist-modal-tab" onclick="tbcModalTab('bottom')">⚠️ Bottom Performers (${bottom.length})</button>
    </div>
    <div class="modal-body">
      <div class="hist-tab-panel active" id="tbc-panel-top">${table(top,0,"No top performers found for this filter.","Top classes")}</div>
      <div class="hist-tab-panel" id="tbc-panel-bottom">${table(bottom,top.length,"No weak performers found for this filter.","Bottom classes")}</div>
    </div>`;
  document.getElementById("modal-overlay").classList.add("open");
}

function tbcModalTab(id){
  document.querySelectorAll(".hist-modal-tab").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".hist-tab-panel").forEach(p=>p.classList.remove("active"));
  const buttons=[...document.querySelectorAll(".hist-modal-tab")];
  buttons[id==="top"?0:1]?.classList.add("active");
  document.getElementById("tbc-panel-"+id)?.classList.add("active");
}

function histModalTab(id){
  document.querySelectorAll(".hist-modal-tab").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".hist-tab-panel").forEach(p=>p.classList.remove("active"));
  const buttons=[...document.querySelectorAll(".hist-modal-tab")];
  const labels={summary:0,trainers:1,classes:2,scoring:3,definitions:4,raw:5,schedscore:0,scheddefs:1,schedrows:2};
  if(buttons[labels[id]]){
    buttons[labels[id]].classList.add("active");
  }
  const panel=document.getElementById("hist-panel-"+id);
  if(panel)panel.classList.add("active");
}

// ============================================================
// SETTINGS VIEW — Comprehensive studio configuration
// ============================================================
let _settTrainerProfiles=null;
let _settSchedConfig=null;
let _settSection="overview";
let _qualSearch="";
let _trainerMgmtSearch="";
let _trainerMgmtStatusFilter="";
let _trainerMgmtLocFilter="";
let _settMatrixSelection=new Set();
let _settLastValidation={errors:[],warnings:[],info:[]};
let _editingCustomRuleIdx=null;
let _editingManualPinIdx=null;

const QUAL_KEYS=["all_barre","cardio_barre","mat_57","powercycle","strength_lab","foundations","pre_post_natal","amped_up","hiit","recovery","fit","back_body_blaze","express_barre","express_cycle","studio_recovery","barre_flow","special"];
const QUAL_LABELS={"all_barre":"Studio Barre 57","cardio_barre":"Studio Cardio Barre","mat_57":"Studio Mat 57","powercycle":"Studio PowerCycle","strength_lab":"Studio Strength Lab","foundations":"Studio Foundations","pre_post_natal":"Pre/Post Natal","amped_up":"Studio Amped Up!","hiit":"Studio HIIT","recovery":"Studio Recovery","fit":"Studio FIT","back_body_blaze":"Studio Back Body Blaze","express_barre":"Barre/Cardio/Mat Express","express_cycle":"Studio PowerCycle Express","studio_recovery":"Studio Recovery","barre_flow":"Studio Barre Flow","special":"Hosted / Special Format"};
const QUAL_FORMAT_HINTS={
  all_barre:"Studio Barre 57",
  cardio_barre:"Studio Cardio Barre, Studio Cardio Barre Express, Studio Cardio Barre Plus",
  mat_57:"Studio Mat 57, Studio Mat 57 Express",
  powercycle:"Studio PowerCycle",
  strength_lab:"Studio Strength Lab",
  foundations:"Studio Foundations",
  amped_up:"Studio Amped Up!",
  hiit:"Studio HIIT",
  recovery:"Studio Recovery",
  fit:"Studio FIT, Studio FIT Express",
  back_body_blaze:"Studio Back Body Blaze",
  express_barre:"Studio Barre 57 Express, Studio Cardio Barre Express, Studio Mat 57 Express",
  express_cycle:"Studio PowerCycle Express",
  studio_recovery:"Studio Recovery",
  barre_flow:"Studio Barre Flow",
  special:"Hosted classes, partnership classes, and custom workshop formats"
};
const DAYS_ALL=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const LOCS_ALL=["Kwality House, Kemps Corner","Supreme HQ, Bandra","Courtside","Kenkere House","Copper & Cloves"];
const CITIES_ALL=["Mumbai","Bengaluru"];
const LOCATION_CITY={
  "Kwality House, Kemps Corner":"Mumbai",
  "Supreme HQ, Bandra":"Mumbai",
  "Courtside":"Mumbai",
  "Kenkere House":"Bengaluru",
  "Copper & Cloves":"Bengaluru"
};
function trainerCities(t){
  const locs=Object.keys(t.locations||{});
  const cities=new Set(locs.map(loc=>LOCATION_CITY[loc]).filter(Boolean));
  return cities.size?[...cities]:["Unassigned"];
}
function groupTrainerRowsByCity(rows,trainerOf){
  const groups=new Map(CITIES_ALL.map(c=>[c,[]]));
  rows.forEach(row=>{
    const cities=trainerCities(trainerOf(row));
    cities.forEach(city=>{
      if(!groups.has(city))groups.set(city,[]);
      groups.get(city).push(row);
    });
  });
  return [...groups.entries()].filter(([,list])=>list.length);
}
function settHistoricWeekOffDays(t){
  const days=Array.isArray(t?.historic_week_off_days)?t.historic_week_off_days:[];
  return days.filter(d=>DAYS_ALL.includes(d)).slice(0,2);
}
function settDefaultAvailableDays(t){
  const offs=new Set(settHistoricWeekOffDays(t));
  const days=DAYS_ALL.filter(d=>!offs.has(d));
  return days.length?days:DAYS_ALL;
}
function settAvailabilityDaysFor(t,ld){
  return Array.isArray(ld?.available_days)&&ld.available_days.length?ld.available_days:settDefaultAvailableDays(t);
}
const CLASS_MIX_TARGETS={
  "Kwality House, Kemps Corner":{
    "Studio Barre 57":{min:14,max:22},"Studio Cardio Barre":{min:8,max:10},"Studio Mat 57":{min:5,max:8},
    "Studio PowerCycle":{min:13,max:14},"Studio Strength Lab":{min:6,max:8},"Studio Back Body Blaze":{min:0,max:3},
    "Studio FIT":{min:8,max:8},"Studio Recovery":{min:1,max:3},"Studio Foundations":{min:0,max:0},
    "Studio Amped Up!":{min:1,max:2},"Studio HIIT":{min:1,max:2}
  },
  "Supreme HQ, Bandra":{
    "Studio Barre 57":{min:12,max:20},"Studio Cardio Barre":{min:4,max:8},"Studio Mat 57":{min:3,max:6},
    "Studio PowerCycle":{min:14,max:20},"Studio Back Body Blaze":{min:0,max:3},
    "Studio FIT":{min:3,max:6},"Studio Recovery":{min:1,max:3},"Studio Foundations":{min:0,max:0}
  },
  "Kenkere House":{
    "Studio Barre 57":{min:12,max:20},"Studio Cardio Barre":{min:4,max:8},"Studio Mat 57":{min:3,max:6},
    "Studio Back Body Blaze":{min:0,max:3},"Studio FIT":{min:3,max:6},"Studio Recovery":{min:1,max:3},
    "Studio Foundations":{min:0,max:0}
  },
  "Courtside":{
    "Studio Barre 57":{min:1,max:2},"Studio Barre 57 Express":{min:0,max:1},
    "Studio Mat 57":{min:0,max:1},"Studio Mat 57 Express":{min:0,max:1},
    "Studio Cardio Barre":{min:0,max:1},"Studio Cardio Barre Express":{min:0,max:1},
    "Studio FIT":{min:0,max:1},"Studio FIT Express":{min:0,max:1},
    "Studio PowerCycle":{min:0,max:0},"Studio Strength Lab":{min:0,max:0}
  },
  "Copper & Cloves":{
    "Copper + Cloves Barre 57":{min:1,max:6},
    "Copper + Cloves Mat 57":{min:1,max:6},
    "Copper + Cloves FIT":{min:1,max:6}
  }
};

function settDefaultConfig(){
  return {
    targets:{},
    manual_protected:[],
    manual_excluded:[],
    custom_rules:[],
    leave_periods:[],
    off_days:[],
    inactive_trainers:[],
    class_mix:{},
    trainer_priority:{},
    settings_options:{
      enforce_exact_daily_targets:true,
      auto_repair_underfilled_days:true,
      allow_soft_mix_overrides:false,
      block_hard_conflict_saves:true,
      show_superseded_rules:true,
      save_snapshot_on_publish:true,
      pipeline_requires_validation:true,
      default_bulk_scope:"selection",
      target_cap_buffer:1,
      target_selection_strategy:"seeded_range",
      weekly_hours_cap:15,
      tier1_min_weekly_hours:13,
      tier1_ideal_weekly_hours:15,
      max_daily_trainer_hours:4,
      max_trainer_work_days:6,
      max_classes_per_day_default:3,
      enforce_assignment_days:true,
      enforce_leave_and_off_days:true,
      trainer_week_off_strategy:"historic_lowest_days",
      max_week_off_days:2,
      protect_pinned_classes_from_repair:true,
      hard_block_inactive_trainers:true,
      require_certified_format_match:true,
      conflict_policy:"settings_override_soft_rules",
      deepseek_api_key:"",
      deepseek_model:"",
      deepseek_base_url:"",
      ai_api_key:"",
      ai_provider:"openai",
      ai_model:"gpt-5.6-terra",
      ai_generation_model:"gpt-5.4-mini",
      ai_backup_model:"",
      ai_base_url:"https://api.openai.com/v1",
      ai_optimize_api_key:"",
      ai_optimize_model:"gpt-5.6-terra",
      ai_optimize_base_url:"https://api.openai.com/v1",
    },
    source_of_truth:{
      owner:"settings-command-center",
      conflict_policy:"settings_override_soft_rules",
      updated_at:new Date().toISOString(),
    },
  };
}

function settNormalizeConfig(config){
  const base=settDefaultConfig();
  const next={...base,...(config||{})};
  next.targets=next.targets||{};
  next.class_mix=next.class_mix||{};
  next.settings_options={...base.settings_options,...(next.settings_options||{})};
  const validBulkScopes=new Set(["selection","visible","weekdays","weekend"]);
  if(!validBulkScopes.has(next.settings_options.default_bulk_scope))next.settings_options.default_bulk_scope=base.settings_options.default_bulk_scope;
  const validPolicies=new Set(["settings_override_soft_rules","block_all_conflicts","manual_review_required"]);
  if(!validPolicies.has(next.settings_options.conflict_policy))next.settings_options.conflict_policy=base.settings_options.conflict_policy;
  const validTargetStrategies=new Set(["seeded_range","balanced_midpoint","lower_bias","upper_bias"]);
  if(!validTargetStrategies.has(next.settings_options.target_selection_strategy))next.settings_options.target_selection_strategy=base.settings_options.target_selection_strategy;
  next.settings_options.target_cap_buffer=Number(next.settings_options.target_cap_buffer??base.settings_options.target_cap_buffer);
  next.settings_options.weekly_hours_cap=Number(next.settings_options.weekly_hours_cap??base.settings_options.weekly_hours_cap);
  next.settings_options.tier1_min_weekly_hours=Number(next.settings_options.tier1_min_weekly_hours??base.settings_options.tier1_min_weekly_hours);
  next.settings_options.tier1_ideal_weekly_hours=Number(next.settings_options.tier1_ideal_weekly_hours??base.settings_options.tier1_ideal_weekly_hours);
  next.settings_options.max_daily_trainer_hours=Number(next.settings_options.max_daily_trainer_hours??base.settings_options.max_daily_trainer_hours);
  next.settings_options.max_trainer_work_days=Math.max(1,Math.min(6,Number(next.settings_options.max_trainer_work_days??base.settings_options.max_trainer_work_days)));
  next.settings_options.max_classes_per_day_default=Number(next.settings_options.max_classes_per_day_default??base.settings_options.max_classes_per_day_default);
  next.settings_options.max_week_off_days=Math.max(0,Math.min(2,Number(next.settings_options.max_week_off_days??base.settings_options.max_week_off_days)));
  if(!["historic_lowest_days","manual_only"].includes(next.settings_options.trainer_week_off_strategy))next.settings_options.trainer_week_off_strategy=base.settings_options.trainer_week_off_strategy;
  next.settings_options.deepseek_api_key=String(next.settings_options.deepseek_api_key||"");
  next.settings_options.deepseek_model="";
  next.settings_options.deepseek_base_url="";
  next.settings_options.ai_api_key=String(next.settings_options.ai_api_key||"");
  next.settings_options.ai_provider="openai";
  next.settings_options.ai_model="gpt-5.6-terra";
  next.settings_options.ai_generation_model="gpt-5.4-mini";
  next.settings_options.ai_backup_model="";
  next.settings_options.ai_base_url="https://api.openai.com/v1";
  next.settings_options.ai_optimize_api_key=String(next.settings_options.ai_optimize_api_key||"");
  next.settings_options.ai_optimize_model="gpt-5.6-terra";
  next.settings_options.ai_optimize_base_url="https://api.openai.com/v1";
  next.manual_protected=Array.isArray(next.manual_protected)?next.manual_protected:[];
  next.manual_excluded=Array.isArray(next.manual_excluded)?next.manual_excluded:[];
  next.custom_rules=Array.isArray(next.custom_rules)?next.custom_rules:[];
  next.leave_periods=Array.isArray(next.leave_periods)?next.leave_periods:[];
  next.off_days=Array.isArray(next.off_days)?next.off_days:[];
  next.inactive_trainers=Array.isArray(next.inactive_trainers)?next.inactive_trainers:[];
  next.source_of_truth={
    ...base.source_of_truth,
    ...(next.source_of_truth||{}),
    owner:"settings-command-center",
    conflict_policy:next.settings_options.conflict_policy||"settings_override_soft_rules",
  };
  LOCS_ALL.forEach(loc=>{
    if(!next.targets[loc])next.targets[loc]={};
    DAYS_ALL.forEach(day=>{
      const cur=next.targets[loc][day]||{};
      const fallback=loc==="Kwality House, Kemps Corner"?{target:10,max:12}:loc==="Supreme HQ, Bandra"?{target:9,max:10}:{target:7,max:9};
      next.targets[loc][day]={
        target:Number(cur.target??fallback.target),
        max:Number(cur.max??Math.max(Number(cur.target??fallback.target),fallback.max)),
        source:cur.source||"settings",
      };
    });
    if(!next.class_mix[loc])next.class_mix[loc]={};
    const defaults=CLASS_MIX_TARGETS[loc]||{};
    Object.keys(defaults).forEach(cls=>{
      const cur=next.class_mix[loc][cls]||defaults[cls]||{};
      next.class_mix[loc][cls]={
        min:Number(cur.min??0),
        max:Number(cur.max??Math.max(Number(cur.min??0),defaults[cls]?.max??10)),
        source:cur.source||"settings",
      };
    });
  });
  return next;
}

function settValidateConfig(config){
  const cfg=settNormalizeConfig(config||_settSchedConfig||{});
  const errors=[];
  const warnings=[];
  const info=[];
  LOCS_ALL.forEach(loc=>{
    let weeklyTarget=0;
    let weeklyMax=0;
    DAYS_ALL.forEach(day=>{
      const row=cfg.targets?.[loc]?.[day]||{};
      const target=Number(row.target||0);
      const max=Number(row.max||0);
      weeklyTarget+=target; weeklyMax+=max;
      if(target<0||max<0)errors.push(`${loc} ${day}: min and max must be non-negative.`);
      if(target>max)errors.push(`${loc} ${day}: min ${target} exceeds max ${max}.`);
      if(max===target&&target>=12)warnings.push(`${loc} ${day}: max equals a high target; optimiser has no recovery room.`);
      const buffer=Number(cfg.settings_options?.target_cap_buffer||0);
      if(buffer>0&&max<target+buffer)warnings.push(`${loc} ${day}: max should be at least target + ${buffer} for repair room.`);
    });
    info.push(`${LOC_SHORT[loc]||loc}: weekly target ${weeklyTarget}, max ${weeklyMax}`);
    Object.entries(cfg.class_mix?.[loc]||{}).forEach(([cls,limits])=>{
      const min=Number(limits.min||0), max=Number(limits.max||0);
      if(min<0||max<0)errors.push(`${loc} ${displayClass(cls)}: min and max must be non-negative.`);
      if(min>max)errors.push(`${loc} ${displayClass(cls)}: min ${min} exceeds max ${max}.`);
    });
  });
  const pinKeys=new Set();
  (cfg.manual_protected||[]).forEach((pin,i)=>{
    const key=[pin.location,pin.day||pin.day_of_week,pin.time,pin.class||pin.class_name].join("|");
    if(pinKeys.has(key))errors.push(`Manual pin ${i+1}: duplicate pinned class/time.`);
    pinKeys.add(key);
  });
  (cfg.custom_rules||[]).forEach(rule=>{
    if(rule.enabled!==false&&rule.rule_type==="daily_target"&&rule.location&&rule.day){
      const target=cfg.targets?.[rule.location]?.[rule.day]?.target;
      if(target!=null&&Number(rule.value)!==Number(target)){
        warnings.push(`${rule.location} ${rule.day}: custom daily rule ${rule.value} is superseded by Settings target ${target}.`);
      }
    }
  });
  // ── Tier hour ordering check ──────────────────────────────────────────
  // For each location, verify T1 trainers have ≥ T2, T2 ≥ T3.
  // Uses trainer profiles from _settTrainerProfiles and the live schedule (if available).
  if(Array.isArray(_settTrainerProfiles)&&_settTrainerProfiles.length){
    const tierOf={};
    _settTrainerProfiles.forEach(p=>{
      const t=Number((cfg.tier_overrides||[]).find(o=>o.trainer===p.name)?.tier||p.tier||3);
      tierOf[p.name]=t;
    });
    const locTierHours={};
    // Aggregate from live schedule if accessible
    const liveSlots=typeof _schedule!=="undefined"?_schedule:[];
    liveSlots.forEach(s=>{
      const loc=s.location;const tr=s.trainer_1;
      if(!loc||!tr)return;
      if(!locTierHours[loc])locTierHours[loc]={1:[],2:[],3:[]};
      const tier=tierOf[tr]||3;
      const dur=Number(s.duration_min||57);
      const existing=locTierHours[loc][tier]?.find(x=>x.name===tr);
      if(existing)existing.mins+=dur;
      else locTierHours[loc][tier]?.push({name:tr,mins:dur});
    });
    Object.entries(locTierHours).forEach(([loc,byTier])=>{
      const avgMins=tier=>{
        const arr=byTier[tier]||[];
        return arr.length?arr.reduce((s,x)=>s+x.mins,0)/arr.length:null;
      };
      const t1=avgMins(1),t2=avgMins(2),t3=avgMins(3);
      const locShort=LOC_SHORT[loc]||loc;
      if(t1!=null&&t2!=null&&t2>t1+15)
        warnings.push(`${locShort}: Tier 2 trainers average more hours than Tier 1 (${Math.round(t2/60*10)/10}h vs ${Math.round(t1/60*10)/10}h). Run Optimise to rebalance.`);
      if(t2!=null&&t3!=null&&t3>t2+15)
        warnings.push(`${locShort}: Tier 3 trainers average more hours than Tier 2 (${Math.round(t3/60*10)/10}h vs ${Math.round(t2/60*10)/10}h). Run Optimise to rebalance.`);
      if(t1!=null&&t3!=null&&t3>t1+15)
        warnings.push(`${locShort}: Tier 3 trainers average more hours than Tier 1 (${Math.round(t3/60*10)/10}h vs ${Math.round(t1/60*10)/10}h). Run Optimise to rebalance.`);
    });
  }
  if(Number(cfg.settings_options?.weekly_hours_cap||0)<=0)errors.push("Advanced: weekly trainer hours cap must be greater than zero.");
  if(Number(cfg.settings_options?.tier1_min_weekly_hours||0)<1)errors.push("Advanced: Tier 1 minimum weekly hours must be greater than zero.");
  if(Number(cfg.settings_options?.tier1_ideal_weekly_hours||0)<Number(cfg.settings_options?.tier1_min_weekly_hours||0))warnings.push("Advanced: Tier 1 ideal hours should be at least the Tier 1 minimum.");
  if(Number(cfg.settings_options?.tier1_ideal_weekly_hours||0)>Number(cfg.settings_options?.weekly_hours_cap||0))warnings.push("Advanced: Tier 1 ideal hours should not exceed the weekly cap.");
  if(Number(cfg.settings_options?.max_daily_trainer_hours||0)>4)warnings.push("Generation: max trainer hours/day is above the recommended 4-hour cap.");
  if(Number(cfg.settings_options?.max_trainer_work_days||0)>6)errors.push("Generation: trainer work days cannot exceed the occasional 6-day cap.");
  if(Number(cfg.settings_options?.max_trainer_work_days||0)>5)warnings.push("Generation: trainer work days above 5 should be used only occasionally when coverage requires it.");
  if(Number(cfg.settings_options?.max_classes_per_day_default||0)<=0)errors.push("Advanced: default classes per day cap must be greater than zero.");
  if(Number(cfg.settings_options?.max_week_off_days||0)>2)errors.push("Advanced: max default week-off days cannot exceed 2.");
  if(!cfg.settings_options?.enforce_assignment_days)warnings.push("Generation: assignment-day enforcement is disabled.");
  if(!cfg.settings_options?.enforce_leave_and_off_days)warnings.push("Generation: leave and week-off enforcement is disabled.");
  if(!cfg.settings_options?.protect_pinned_classes_from_repair)warnings.push("Generation: repair may move pinned classes.");
  if(cfg.settings_options?.block_hard_conflict_saves===false)warnings.push("Advanced: invalid saves are allowed; Settings will still be treated as canonical.");
  if(!cfg.settings_options?.pipeline_requires_validation)warnings.push("Advanced: pipeline validation gate is disabled.");
  return {errors,warnings,info};
}

function settUpdateCounts(){
  const cfg=settNormalizeConfig(_settSchedConfig||{});
  const profiles=_settTrainerProfiles||[];
  const setText=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  setText("sett-count-trainers",profiles.length);
  setText("sett-count-qualifications",profiles.length);
  setText("sett-count-availability",profiles.reduce((n,t)=>n+Object.keys(t.locations||{}).length,0));
  setText("sett-count-leave",(cfg.leave_periods||[]).length+(cfg.off_days||[]).length);
  setText("sett-count-targets",LOCS_ALL.length*DAYS_ALL.length);
  setText("sett-count-classmix",Object.values(cfg.class_mix||{}).reduce((n,m)=>n+Object.keys(m||{}).length,0));
  setText("sett-count-customrules",(cfg.custom_rules||[]).length+(cfg.manual_protected||[]).length);
  setText("sett-count-advanced",Object.keys(cfg.settings_options||{}).length);
  setText("sett-count-overview",(_settLastValidation.errors.length+_settLastValidation.warnings.length)||"OK");
}

function settValidateAndRender(){
  if(!_settSchedConfig)return true;
  _settSchedConfig=settNormalizeConfig(_settSchedConfig);
  _settLastValidation=settValidateConfig(_settSchedConfig);
  settUpdateCounts();
  const card=document.getElementById("sett-source-card");
  const sub=document.getElementById("sett-source-sub");
  if(card){
    card.classList.toggle("error",_settLastValidation.errors.length>0);
    card.classList.toggle("warn",!_settLastValidation.errors.length&&_settLastValidation.warnings.length>0);
  }
  if(sub){
    sub.textContent=_settLastValidation.errors.length
      ? `${_settLastValidation.errors.length} blocking conflict${_settLastValidation.errors.length===1?"":"s"}`
      : `${_settLastValidation.warnings.length} warning${_settLastValidation.warnings.length===1?"":"s"} · Settings is canonical`;
  }
  const list=document.getElementById("sett-conflict-list");
  if(list){
    const items=[
      ..._settLastValidation.errors.map(x=>({type:"error",text:x})),
      ..._settLastValidation.warnings.map(x=>({type:"warn",text:x})),
      ...(!_settLastValidation.errors.length&&!_settLastValidation.warnings.length?_settLastValidation.info.slice(0,4).map(x=>({type:"",text:x})):[]),
    ];
    list.innerHTML=items.map(i=>`<div class="sett-conflict-item ${i.type}">${rvEscapeHtml(i.text)}</div>`).join("")||`<div class="sett-conflict-item">No conflicts found.</div>`;
  }
  return _settLastValidation.errors.length===0;
}

function settSaveCanonicalConfig(statusId="settings",successMsg="Canonical settings saved"){
  if(!_settSchedConfig)_settSchedConfig=settDefaultConfig();
  _settSchedConfig=settNormalizeConfig(_settSchedConfig);
  _settSchedConfig.source_of_truth.updated_at=new Date().toISOString();
  settValidateAndRender();
  const errors=(_settLastValidation||{}).errors||[];
  const blockOnError=_settSchedConfig?.settings_options?.block_hard_conflict_saves!==false;
  if(blockOnError&&errors.length){
    showToast(`Cannot save — ${errors.length} blocking conflict${errors.length>1?"s":""} detected. Fix in AI & General Settings → Validation Health.`,"error");
    return Promise.resolve({ok:false});
  }
  return schedulerFetch("/api/save-schedule-config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(_settSchedConfig)})
    .then(r=>r.json())
    .then(res=>{
      const s=document.getElementById(`${statusId}-save-status`);
      if(s)s.textContent=res.ok?"Saved!":"Error";
      showToast(res.ok?successMsg:"Save failed",res.ok?"":"error");
      setTimeout(()=>{if(s)s.textContent="";},3000);
      return res;
    }).catch(()=>{
      showToast("Server error","error");
      return {ok:false};
    });
}

function settExportConfig(){
  const text=JSON.stringify(settNormalizeConfig(_settSchedConfig||{}),null,2);
  const blob=new Blob([text],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`schedule-config-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  showToast("Settings JSON downloaded","");
}

function settImportConfig(){
  const input=document.createElement("input");
  input.type="file";
  input.accept="application/json,.json";
  input.onchange=()=>{
    const file=input.files?.[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      let parsed;
      try{parsed=JSON.parse(reader.result);}
      catch(e){showToast("Invalid JSON file","error");return;}
      if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)){showToast("File is not a settings object","error");return;}
      if(!confirm("Replace the current settings with this file? This overwrites targets, class mix, trainer priority, custom rules, pins, and AI options."))return;
      _settSchedConfig=settNormalizeConfig(parsed);
      settSaveCanonicalConfig("settings","Settings imported").then(res=>{
        if(res.ok){
          settRenderTargets();settRenderClassMix();settRenderCustomRules();
          settRenderUniversalRulesPanel();settRenderAdvancedOptions();settRenderAISettings();
          settRenderTrainerPolicyOptions();settRenderAvailabilityPolicyOptions();settRenderTargetsPolicyOptions();
          settRenderClassMixPolicyOptions();settRenderPinPolicyOptions();
        }
      });
    };
    reader.readAsText(file);
  };
  input.click();
}

function renderSettingsView(area){
  const wrap=document.createElement("div");
  wrap.className="sett-view";
  wrap.innerHTML=`
    <div class="settings-console-layout">
      <main class="sett-main">
        <div class="sett-main-actions">
          <div class="sett-action-group">
            <button class="sett-ghost-btn" onclick="settValidateAndRender()">Validate Configuration</button>
            <button class="sett-ghost-btn" onclick="settResetMatrixSelection()">Clear Selections</button>
          </div>
          <button class="sett-ghost-btn primary" onclick="settSaveCanonicalConfig()">Save & Apply Changes</button>
        </div>

        <div class="sett-section" id="ssec-trainers">
          <div class="sett-section-head">
            <div>
              <div class="sett-section-kicker">People</div>
              <div class="sett-section-label">Trainer Directory</div>
              <div class="sett-section-desc">Manage trainer profiles, studio access, and activation status.</div>
            </div>
          </div>
          <div class="sett-subtabs" id="trainers-subtabs-bar">
            <button class="sett-subtab active" data-section="trainers" data-subtab="directory" onclick="settSetSub('trainers','directory')">Directory</button>
            <button class="sett-subtab" data-section="trainers" data-subtab="bulk" onclick="settSetSub('trainers','bulk')">Bulk Ops</button>
          </div>
          <div class="sett-subpanel active" data-section="trainers" data-subpanel="directory">
            <div id="avail-policy-wrap" style="margin-bottom:14px"></div>
            <div class="sett-tool-row">
              <input class="sett-input" id="trainer-mgr-search" type="text" placeholder="Search trainer…" oninput="_trainerMgmtSearch=this.value;settRenderTrainerManager()">
              <button class="sett-mini-btn" onclick="settAddTrainer()">Add New</button>
            </div>
            <div id="trainer-mgr-wrap"></div>
          </div>
          <div class="sett-subpanel" data-section="trainers" data-subpanel="bulk">
            <div class="trainer-mgr-bulk-grid">
              <div class="trainer-mgr-bulk-card">
                <div class="sett-section-kicker">Status</div>
                <div class="sett-section-label" style="font-size:15px;margin-bottom:10px">Visible Trainers</div>
                <div class="sett-control-strip" style="margin:0">
                  <button class="sett-mini-btn" onclick="settTrainerBulkActive(true)">Activate Visible</button>
                  <button class="sett-mini-btn" onclick="settTrainerBulkActive(false)">Deactivate Visible</button>
                </div>
              </div>
              <div class="trainer-mgr-bulk-card">
                <div class="sett-section-kicker">Tier Defaults</div>
                <div class="sett-section-label" style="font-size:15px;margin-bottom:10px">Tier + Class Cap</div>
                <div class="sett-control-strip" style="margin:0">
                  <select class="sett-select" id="trainer-bulk-tier">
                    <option value="1">Tier 1 · 4/day cap</option>
                    <option value="2">Tier 2 · 3/day cap</option>
                    <option value="3">Tier 3 · 2/day cap</option>
                    <option value="4">Tier 4 · 2/day cap</option>
                  </select>
                  <button class="sett-mini-btn" onclick="settTrainerBulkTier()">Apply Tier</button>
                </div>
              </div>
              <div class="trainer-mgr-bulk-card">
                <div class="sett-section-kicker">Caps</div>
                <div class="sett-section-label" style="font-size:15px;margin-bottom:10px">Manual Daily Cap</div>
                <div class="sett-control-strip" style="margin:0">
                  <input class="sett-input" id="trainer-bulk-cap" type="number" min="1" max="6" value="4" style="max-width:110px">
                  <button class="sett-mini-btn" onclick="settTrainerBulkClassCap()">Set Visible Caps</button>
                </div>
              </div>
            </div>
            <div id="trainer-policy-wrap" style="margin-top:16px"></div>
          </div>
          <div class="sett-save-bar"><button class="sett-save-btn" onclick="settSaveTrainerManager()">Save Directory</button></div>
        </div>

        <div class="sett-section" id="ssec-qualifications">
          <div class="sett-section-head">
            <div>
              <div class="sett-section-kicker">Eligibility</div>
              <div class="sett-section-label">Certification Matrix</div>
              <div class="sett-section-desc">Control which trainers are certified to teach each current class format.</div>
            </div>
          </div>
          <div class="sett-subtabs">
            <button class="sett-subtab active" data-section="qualifications" data-subtab="matrix" onclick="settSetSub('qualifications','matrix')">Matrix</button>
            <button class="sett-subtab" data-section="qualifications" data-subtab="bulk" onclick="settSetSub('qualifications','bulk')">Bulk</button>
          </div>
          <div class="sett-subpanel active" data-section="qualifications" data-subpanel="matrix">
            <input type="text" id="qual-search" placeholder="Search…" oninput="_qualSearch=this.value;settRenderQualifications()" class="sett-input" style="margin-bottom:12px;width:100%">
            <div id="qual-table-wrap"></div>
          </div>
          <div class="sett-subpanel" data-section="qualifications" data-subpanel="bulk">
            <button class="sett-mini-btn" onclick="settQualBulk(true)">Check Visible</button>
            <button class="sett-mini-btn" onclick="settQualBulk(false)">Uncheck Visible</button>
          </div>
          <div class="sett-save-bar"><button class="sett-save-btn" onclick="settSaveQualifications()">Save Certs</button></div>
        </div>

        <div class="sett-section" id="ssec-availability">
          <div class="sett-section-head">
            <div>
              <div class="sett-section-kicker">People</div>
              <div class="sett-section-label">Leave &amp; Off Days</div>
              <div class="sett-section-desc">Saved leave periods and one-off off days. Weekly available days, shift window, and daily cap now live directly on each trainer's card in the Directory.</div>
            </div>
          </div>
          <div class="sett-subpanel active" data-section="availability" data-subpanel="leave">
            <div id="leave-policy-wrap" style="margin-bottom:14px"></div>
            <datalist id="leave-trainer-list"></datalist>
            <div class="leave-add-grid">
              <div class="leave-add-card">
                <div class="leave-add-title">Add Leave Period</div>
                <div class="leave-add-fields">
                  <input class="sett-input" id="leave-trainer" list="leave-trainer-list" placeholder="Trainer name" autocomplete="off">
                  <input class="sett-input" id="leave-from" type="date" title="From date">
                  <input class="sett-input" id="leave-to" type="date" title="To date">
                  <select class="sett-select" id="leave-loc">
                    <option value="">All locations</option>
                    ${(typeof LOCS_ALL!=="undefined"?LOCS_ALL:[]).map(l=>`<option value="${l}">${l}</option>`).join("")}
                  </select>
                  <button class="sett-mini-btn primary" onclick="settAddLeave()">Add Leave</button>
                </div>
              </div>
              <div class="leave-add-card">
                <div class="leave-add-title">Add One-off Off Day</div>
                <div class="leave-add-fields">
                  <input class="sett-input" id="offday-trainer" list="leave-trainer-list" placeholder="Trainer name" autocomplete="off">
                  <input class="sett-input" id="offday-date" type="date" title="Off date">
                  <select class="sett-select" id="offday-loc">
                    <option value="">All locations</option>
                    ${(typeof LOCS_ALL!=="undefined"?LOCS_ALL:[]).map(l=>`<option value="${l}">${l}</option>`).join("")}
                  </select>
                  <button class="sett-mini-btn primary" onclick="settAddOffDay()">Add Off Day</button>
                </div>
              </div>
            </div>
            <div id="leave-list"></div>
            <div class="sett-save-bar"><button class="sett-save-btn" onclick="settSaveLeave()">Save Leave</button></div>
          </div>
        </div>

        <div class="sett-section" id="ssec-rules">
          <div class="sett-subtabs" id="rules-subtabs-bar">
            <button class="sett-subtab active" data-section="rules" data-subtab="targets" onclick="settSetSub('rules','targets')">Setup / Targets</button>
            <button class="sett-subtab" data-section="rules" data-subtab="classmix" onclick="settSetSub('rules','classmix')">Classes</button>
            <button class="sett-subtab" id="stab-customrules" data-section="rules" data-subtab="custom" onclick="settSetSub('rules','custom')">Pinned & Custom</button>
            <button class="sett-subtab" data-section="rules" data-subtab="universal" onclick="settSetSub('rules','universal')">Universal</button>
          </div>
          <div class="sett-subpanel active" data-section="rules" data-subpanel="targets">
            <div class="sett-section-desc" style="margin-bottom:10px">Daily and weekly class-count floors and ceilings per studio — hard generation minimums the optimizer must reach before it explores additional classes.</div>
            <div id="targets-policy-wrap" style="margin-bottom:14px"></div>
            <div id="targets-wrap"></div>
          </div>
          <div class="sett-subpanel" data-section="rules" data-subpanel="classmix">
            <div class="sett-section-desc" style="margin-bottom:10px">Everything about each class format lives here: weekly capacity per studio, preferred/certified trainers, and time restrictions.</div>
            <div id="classmix-policy-wrap" style="margin-bottom:14px"></div>
            <div id="classmix-wrap"></div>
          </div>
          <div class="sett-subpanel" id="ssec-customrules" data-section="rules" data-subpanel="custom">
            <div class="sett-section-desc" style="margin-bottom:10px">Manually pinned classes and saved hard/soft custom rules that override default scoring for specific trainers, slots, or locations.</div>
            <div id="pin-policy-wrap" style="margin-bottom:14px"></div>
            <div id="customrules-builder" class="advanced-rule-builder"></div>
            <div id="customrules-list" class="rule-list" style="margin-top:16px"></div>
            <div id="manualpins-builder" style="margin-top:24px"></div>
            <div id="manualpins-list" class="rule-list" style="margin-top:16px"></div>
          </div>
          <div class="sett-subpanel" data-section="rules" data-subpanel="universal">
            <div class="sett-section-desc" style="margin-bottom:10px">Cross-location hard safeguards — mandatory and recommended rules applied to every generation regardless of studio.</div>
            <input type="text" id="univ-rule-search" placeholder="Search safeguards…" class="sett-input" style="margin-bottom:14px;width:100%" oninput="settFilterUnivRules(this.value)">
            <div id="universal-rules-list"></div>
          </div>
        </div>

        <div class="sett-section" id="ssec-advanced">
          <div class="sett-section-head">
            <div>
              <div class="sett-section-kicker">Intelligence</div>
              <div class="sett-section-label">AI &amp; Generation</div>
              <div class="sett-section-desc">Model policy, validation gates, and scoring weights used by every generation.</div>
            </div>
          </div>
          <div class="sett-subtabs">
            <button class="sett-subtab active" data-section="advanced" data-subtab="policy" onclick="settSetSub('advanced','policy')">Policy &amp; Options</button>
            <button class="sett-subtab" data-section="advanced" data-subtab="scoring" onclick="settSetSub('advanced','scoring')">Scoring &amp; Planner</button>
          </div>
          <div class="sett-subpanel active" data-section="advanced" data-subpanel="policy">
            <div class="sett-config-panel">
              <div class="sett-section-head">
                <div>
                  <div class="sett-card-title">Validation Health</div>
                  <div class="sett-card-copy">Blocking conflicts and constraint warnings across every saved section.</div>
                </div>
              </div>
              <div id="sett-conflict-list" class="sett-conflict-list"><div class="sett-conflict-item">Loading validation...</div></div>
            </div>
            <div id="advanced-options-wrap"></div>
            <div class="sett-save-bar"><button class="sett-save-btn" onclick="settSaveAdvancedOptions()">Save Policy</button></div>
          </div>
          <div class="sett-subpanel" data-section="advanced" data-subpanel="scoring">
            <div id="ai-settings-wrap"></div>
          </div>
        </div>
      </main>

    </div>
  `;
  area.appendChild(wrap);
  settLoadData();
}

function settSetTab(tab){
  let mainTab=tab;
  if(["targets","classmix","custom","customrules","universal"].includes(tab)) mainTab="rules";
  if(tab==="ai") mainTab="advanced";
  if(tab==="leave") mainTab="availability";
  _settSection=mainTab;
  document.querySelectorAll(".sett-tab,.sett-nav-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".sett-section").forEach(s=>s.classList.remove("active"));
  const btn=document.getElementById("stab-"+mainTab);
  if(btn)btn.classList.add("active");
  const sec=document.getElementById("ssec-"+mainTab);
  if(sec)sec.classList.add("active");
  if(mainTab==="rules"){
    settRenderTargets();
    settRenderClassMix();
    settRenderCustomRules();
    settRenderUniversalRulesPanel();
    if(["targets","classmix","custom","customrules","universal"].includes(tab)){
      settSetSub("rules", tab==="customrules"?"custom":tab);
    } else {
      settSetSub("rules", "targets");
    }
  }
  settResetMatrixSelection(false);
  if(mainTab==="advanced"){
    settRenderAdvancedOptions();
    settRenderAISettings();
    settSetSub("advanced",tab==="ai"?"scoring":"policy");
  }
  if(mainTab==="availability"&&tab==="leave")settSetSub("availability","leave");
  settValidateAndRender();
}

function settSetSub(section,sub){
  document.querySelectorAll(`.sett-subtab[data-section="${section}"]`).forEach(b=>b.classList.toggle("active",b.dataset.subtab===sub));
  document.querySelectorAll(`.sett-subpanel[data-section="${section}"]`).forEach(p=>p.classList.toggle("active",p.dataset.subpanel===sub));
}

function settWeeklyTargetStats(cfg,loc){
  const rows=cfg.targets?.[loc]||{};
  return DAYS_ALL.reduce((acc,day)=>{
    const row=rows[day]||{};
    acc.target+=Number(row.target||0);
    acc.max+=Number(row.max||0);
    return acc;
  },{target:0,max:0});
}

function settAdvancedOptionCard(kind,key,title,desc,controlHtml){
  return `<div class="sett-option-card" data-advanced-key="${rvEscapeAttr(key)}">
    <div class="sett-option-top">
      <div>
        <div class="sett-option-title">${rvEscapeHtml(title)}</div>
        <div class="sett-option-desc">${rvEscapeHtml(desc)}</div>
      </div>
      ${kind==="toggle"?controlHtml:""}
    </div>
    ${kind==="field"?controlHtml:""}
  </div>`;
}
function settOptToggle(o,key){return `<label class="sett-switch"><input type="checkbox" ${o[key]?"checked":""} onchange="settSetAdvancedOption('${key}',this.checked,'boolean')"><span class="sett-slider"></span></label>`;}
function settOptNumber(o,key,min,max,step=1){return `<input type="number" min="${min}" max="${max}" step="${step}" value="${Number(o[key]??0)}" onchange="settSetAdvancedOption('${key}',this.value,'number')">`;}
function settOptSelect(o,key,choices){return `<select onchange="settSetAdvancedOption('${key}',this.value,'string')">${choices.map(([v,l])=>`<option value="${v}" ${o[key]===v?"selected":""}>${l}</option>`).join("")}</select>`;}

// Category-scoped policy panels — each renders into a wrap div physically
// located inside its own Control Center bucket, so caps/toggles that used to
// be dumped under "AI & General Settings" now live where they conceptually
// belong (Trainers / Days of the Week / Location / Classes / Pinned rules).
function settRenderTrainerPolicyOptions(){
  const wrap=document.getElementById("trainer-policy-wrap");
  if(!wrap||!_settSchedConfig)return;
  const o=_settSchedConfig.settings_options||{};
  wrap.innerHTML=`
    <div class="sett-config-panel">
      <div class="sett-section-kicker">Global Trainer Policy</div>
      <div class="sett-section-desc" style="margin-bottom:12px">Hard caps and eligibility checks applied to every trainer during generation.</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("toggle","hard_block_inactive_trainers","Block inactive trainers","Prevent inactive trainer profiles from being used by Standard, AI, and repair generation.",settOptToggle(o,"hard_block_inactive_trainers"))}
        ${settAdvancedOptionCard("toggle","require_certified_format_match","Require certification match","Treat trainer format certification as a hard eligibility check before assignment.",settOptToggle(o,"require_certified_format_match"))}
        ${settAdvancedOptionCard("field","weekly_hours_cap","Tier-1 weekly hours cap","Hard Tier 1 weekly cap used by planner guardrail copy and reporting metadata.",settOptNumber(o,"weekly_hours_cap",1,40,0.5))}
        ${settAdvancedOptionCard("field","tier1_min_weekly_hours","Tier-1 minimum weekly hours","Minimum target the planner pulls Tier 1 trainers toward before lower-tier fill.",settOptNumber(o,"tier1_min_weekly_hours",1,15,0.5))}
        ${settAdvancedOptionCard("field","tier1_ideal_weekly_hours","Tier-1 ideal weekly hours","Preferred Tier 1 utilisation target before tapering toward the 15h cap.",settOptNumber(o,"tier1_ideal_weekly_hours",1,15,0.5))}
        ${settAdvancedOptionCard("field","max_daily_trainer_hours","Max trainer hours/day","Hard daily trainer assignment cap across all classes and locations.",settOptNumber(o,"max_daily_trainer_hours",1,8,0.5))}
        ${settAdvancedOptionCard("field","max_trainer_work_days","Max trainer work days","Prevents all-seven-day trainer schedules while allowing one or two weekly off days.",settOptNumber(o,"max_trainer_work_days",1,6,1))}
        ${settAdvancedOptionCard("field","max_classes_per_day_default","Default classes per instructor/day","Fallback per-day instructor cap when a profile does not specify a tighter value.",settOptNumber(o,"max_classes_per_day_default",1,8,1))}
      </div>
    </div>`;
}
function settRenderAvailabilityPolicyOptions(){
  if(!_settSchedConfig)return;
  const o=_settSchedConfig.settings_options||{};
  const wrap=document.getElementById("avail-policy-wrap");
  if(wrap)wrap.innerHTML=`
    <div class="sett-config-panel">
      <div class="sett-section-kicker">Assignment-Day Enforcement</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("toggle","enforce_assignment_days","Enforce assignment days","Block trainer assignments outside the saved studio-specific availability days.",settOptToggle(o,"enforce_assignment_days"))}
      </div>
    </div>`;
  const wrap2=document.getElementById("leave-policy-wrap");
  if(wrap2)wrap2.innerHTML=`
    <div class="sett-config-panel">
      <div class="sett-section-kicker">Leave &amp; Week-Off Policy</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("toggle","enforce_leave_and_off_days","Enforce leave and week offs","Block trainer assignments on saved leave periods, dated off days, and historic week-off defaults.",settOptToggle(o,"enforce_leave_and_off_days"))}
        ${settAdvancedOptionCard("field","trainer_week_off_strategy","Week-off defaulting","Choose how trainer default week offs are selected when a profile still has all seven days active.",settOptSelect(o,"trainer_week_off_strategy",[["historic_lowest_days","Use historic lowest-use days"],["manual_only","Manual only"]]))}
        ${settAdvancedOptionCard("field","max_week_off_days","Max default week offs","Maximum historic week-off days assigned by default per trainer.",settOptNumber(o,"max_week_off_days",0,2,1))}
      </div>
    </div>`;
}
function settRenderTargetsPolicyOptions(){
  const wrap=document.getElementById("targets-policy-wrap");
  if(!wrap||!_settSchedConfig)return;
  const o=_settSchedConfig.settings_options||{};
  wrap.innerHTML=`
    <div class="sett-config-panel">
      <div class="sett-section-kicker">Target Fill Policy</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("toggle","enforce_exact_daily_targets","Prioritize exact daily targets","Tell the planner to treat daily target counts as the preferred allocation before exploratory classes.",settOptToggle(o,"enforce_exact_daily_targets"))}
        ${settAdvancedOptionCard("toggle","auto_repair_underfilled_days","Auto-repair underfilled days","Allow the planner to add safe classes when a day cannot reach the target.",settOptToggle(o,"auto_repair_underfilled_days"))}
        ${settAdvancedOptionCard("field","target_selection_strategy","Daily count selection","Choose how the planner picks the desired class count inside each min/max day range.",settOptSelect(o,"target_selection_strategy",[["seeded_range","Seeded range per run"],["balanced_midpoint","Balanced midpoint"],["lower_bias","Lower bias"],["upper_bias","Upper bias"]]))}
        ${settAdvancedOptionCard("field","target_cap_buffer","Target cap buffer","Minimum gap between daily min and max before validation warns about low repair room.",settOptNumber(o,"target_cap_buffer",0,8,1))}
      </div>
    </div>`;
}
function settRenderClassMixPolicyOptions(){
  const wrap=document.getElementById("classmix-policy-wrap");
  if(!wrap||!_settSchedConfig)return;
  const o=_settSchedConfig.settings_options||{};
  wrap.innerHTML=`
    <div class="sett-config-panel">
      <div class="sett-section-kicker">Class-Mix Policy</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("toggle","allow_soft_mix_overrides","Allow soft class-mix overrides","Permit controlled deviations from class-mix targets when trainer availability blocks a cleaner plan.",settOptToggle(o,"allow_soft_mix_overrides"))}
      </div>
    </div>`;
}
function settRenderPinPolicyOptions(){
  const wrap=document.getElementById("pin-policy-wrap");
  if(!wrap||!_settSchedConfig)return;
  const o=_settSchedConfig.settings_options||{};
  wrap.innerHTML=`
    <div class="sett-config-panel">
      <div class="sett-section-kicker">Pin Protection</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("toggle","protect_pinned_classes_from_repair","Protect pinned classes from repair","Keep manual pins fixed when auto-repair fills target gaps.",settOptToggle(o,"protect_pinned_classes_from_repair"))}
      </div>
    </div>`;
}

function settRenderAdvancedOptions(){
  const wrap=document.getElementById("advanced-options-wrap");
  if(!wrap||!_settSchedConfig)return;
  _settSchedConfig=settNormalizeConfig(_settSchedConfig);
  const o=_settSchedConfig.settings_options||{};
  const toggle=(key)=>`<label class="sett-switch"><input type="checkbox" ${o[key]?"checked":""} onchange="settSetAdvancedOption('${key}',this.checked,'boolean')"><span class="sett-slider"></span></label>`;
  const number=(key,min,max,step=1)=>`<input type="number" min="${min}" max="${max}" step="${step}" value="${Number(o[key]??0)}" onchange="settSetAdvancedOption('${key}',this.value,'number')">`;
  const select=(key,choices)=>`<select onchange="settSetAdvancedOption('${key}',this.value,'string')">${choices.map(([v,l])=>`<option value="${v}" ${o[key]===v?"selected":""}>${l}</option>`).join("")}</select>`;
  wrap.innerHTML=`
    <div class="sett-config-panel">
      <div class="sett-section-kicker">AI Keys & Schedule Generation</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("field","ai_provider","AI Provider","All AI-powered functions use OpenAI only.",`<input type="text" value="OpenAI" disabled>`)}
        ${settAdvancedOptionCard("field","ai_api_key","OpenAI API Key","Used for all AI generation and assistant features.",`<input type="password" value="${rvEscapeAttr(o.ai_api_key||"")}" placeholder="Paste OpenAI key" autocomplete="off" onchange="settSetAdvancedOption('ai_api_key',this.value,'string')">`)}
        ${settAdvancedOptionCard("field","ai_generation_model","Schedule Generation Model","Cost-controlled model used only for full schedule generation.",`<input type="text" value="gpt-5.4-mini" disabled>`)}
        ${settAdvancedOptionCard("field","ai_model","Assistant/Edit Model","Higher-accuracy model for chatbot edits, best-fit trainer/class recommendations, and precise schedule changes.",`<input type="text" value="gpt-5.6-terra" disabled>`)}
        ${settAdvancedOptionCard("field","ai_base_url","OpenAI Base URL","Locked OpenAI API endpoint.",`<input type="text" value="https://api.openai.com/v1" disabled>`)}
      </div>
    </div>
    <div class="sett-config-panel">
      <div class="sett-section-kicker">AI Optimisation (Optimize with AI)</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("field","ai_optimize_model","Optimize Model","Locked model used by Optimize with AI.",`<input type="text" value="gpt-5.6-terra" disabled>`)}
        ${settAdvancedOptionCard("field","ai_optimize_base_url","Optimize Base URL","Locked OpenAI API endpoint.",`<input type="text" value="https://api.openai.com/v1" disabled>`)}
        ${settAdvancedOptionCard("field","ai_optimize_api_key","Optimize API Key","Optional separate OpenAI key for Optimize with AI.",`<input type="password" value="${rvEscapeAttr(o.ai_optimize_api_key||"")}" placeholder="Paste OpenAI key" autocomplete="off" onchange="settSetAdvancedOption('ai_optimize_api_key',this.value,'string')">`)}
      </div>
    </div>
    <div class="sett-config-panel">
      <div class="sett-section-kicker">Conflict Resolution</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("toggle","block_hard_conflict_saves","Block invalid saves","Prevent target, class-mix, and policy conflicts from becoming the saved source of truth.",toggle("block_hard_conflict_saves"))}
        ${settAdvancedOptionCard("toggle","show_superseded_rules","Show superseded rules","Keep daily target rules visible when Settings overrides them, so conflicts are explicit.",toggle("show_superseded_rules"))}
        ${settAdvancedOptionCard("field","conflict_policy","Conflict policy","Choose how the Settings source of truth wins when planner defaults or soft rules disagree.",select("conflict_policy",[["settings_override_soft_rules","Settings override soft rules"],["block_all_conflicts","Block all conflicts"],["manual_review_required","Manual review required"]]))}
        ${settAdvancedOptionCard("toggle","pipeline_requires_validation","Require validation before pipeline","Treat Settings validation as the gate before generation and publishing.",toggle("pipeline_requires_validation"))}
      </div>
    </div>
    <div class="sett-config-panel">
      <div class="sett-section-kicker">Operations</div>
      <div class="sett-option-grid">
        ${settAdvancedOptionCard("field","default_bulk_scope","Default bulk scope","Preselect the bulk-operator scope used by target and class-mix matrices.",select("default_bulk_scope",[["selection","Selected cells"],["visible","All visible cells"],["weekdays","Weekdays"],["weekend","Weekend"]]))}
        ${settAdvancedOptionCard("toggle","save_snapshot_on_publish","Save snapshot on publish","Mark each canonical save as a versioned settings snapshot for traceability.",toggle("save_snapshot_on_publish"))}
      </div>
    </div>`;
}

function settSetAdvancedOption(key,value,type){
  if(!_settSchedConfig)_settSchedConfig=settDefaultConfig();
  _settSchedConfig=settNormalizeConfig(_settSchedConfig);
  _settSchedConfig.settings_options[key]=type==="number"?Number(value):type==="boolean"?Boolean(value):value;
  if(key==="conflict_policy")_settSchedConfig.source_of_truth.conflict_policy=value;
  settValidateAndRender();
}

function settSaveAdvancedOptions(){
  _settSchedConfig=settNormalizeConfig(_settSchedConfig||{});
  settSaveCanonicalConfig("advanced","Advanced settings saved");
}

function settRenderAISettings(){
  const wrap=document.getElementById("ai-settings-wrap");
  if(!wrap)return;
  const cfg=(_settSchedConfig||{});
  const sw=cfg.scoring_weights||{fill_rate:35,revenue:25,avg_checkin:20,session_frequency:10,trend:10};
  const tb=cfg.time_band_weights||{morning:1.0,midday:1.15,evening:1.1};
  const ap=cfg.am_pm_settings||{morning_cap_pct:60,enforce_split:false,peak_slots:["08:00","09:00","11:00","11:30","18:00","19:15"]};
  const sliderRow=(id,label,val,min,max,step,desc)=>{
    const isTimeBand=id.startsWith("tb_");
    const updateCall=isTimeBand
      ?`settUpdateTimeBandWeight('${id.slice(3)}',this.value)`
      :`settUpdateScoringWeight('${id}',this.value)`;
    return `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:12px;font-weight:800;color:var(--text)">${label}</span>
        <span id="sw-${id}-val" style="font-size:13px;font-weight:900;color:var(--primary);min-width:36px;text-align:right">${val}${step<1?"×":"%"}</span>
      </div>
      <input type="range" id="sw-${id}" min="${min}" max="${max}" step="${step}" value="${val}"
        style="width:100%;accent-color:var(--primary)"
        oninput="document.getElementById('sw-${id}-val').textContent=this.value+'${step<1?"×":"%"}';${updateCall}">
      <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${desc}</div>
    </div>`;
  };
  wrap.innerHTML=`
    <div class="sett-config-panel" style="margin-bottom:12px">
      <div class="sett-section-kicker">Scoring Weights</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.5">Controls how the optimiser ranks class × trainer × slot combos. Weights must sum to 100.</div>
      <div id="sw-sum-badge" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:16px;background:var(--green-light);color:var(--green)">Sum: ${Object.values(sw).reduce((a,b)=>a+Number(b),0)}% ✓</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0 24px">
        ${sliderRow("fill_rate","Fill Rate",sw.fill_rate,0,60,1,"% of seats filled — primary quality signal")}
        ${sliderRow("revenue","Revenue",sw.revenue,0,50,1,"Normalised revenue per session within location")}
        ${sliderRow("avg_checkin","Avg Check-in",sw.avg_checkin,0,40,1,"Average bodies in the room — absolute attendance")}
        ${sliderRow("session_frequency","Session Frequency",sw.session_frequency,0,30,1,"How often this combo runs — recency & reliability signal")}
        ${sliderRow("trend","Trend",sw.trend,0,30,1,"Positive fill-rate slope over last 12 weeks gets bonus")}
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="sett-ghost-btn" onclick="settResetScoringWeights()">Reset Defaults</button>
        <button class="sett-ghost-btn primary" onclick="settSaveAISettings()">Save Weights</button>
      </div>
    </div>

    <div class="sett-config-panel" style="margin-bottom:12px">
      <div class="sett-section-kicker">AM / PM Time-Band Multipliers</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.5">Multiplies the composite score for slots in each time band. 1.0 = neutral. Above 1.0 = prefer this band. Below 1.0 = deprioritise.</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0 24px">
        ${sliderRow("tb_morning","Morning (07:00–09:59)",tb.morning,0.5,2.0,0.05,"Early-bird classes — higher if your AM crowd is loyal")}
        ${sliderRow("tb_midday","Midday (10:00–12:59)",tb.midday,0.5,2.0,0.05,"Peak studio window — usually highest traffic")}
        ${sliderRow("tb_evening","Evening (17:00–20:30)",tb.evening,0.5,2.0,0.05,"After-work crowd — strong at most locations")}
      </div>
      <div style="margin-top:8px">
        <label style="font-size:11px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:8px">
          <input type="checkbox" ${ap.enforce_split?"checked":""} onchange="settSetAMPMOption('enforce_split',this.checked)">
          Enforce AM / PM split cap
        </label>
        <div style="margin-top:10px;display:flex;align-items:center;gap:10px">
          <label style="font-size:11px;color:var(--text-muted)">Morning classes cap (% of day)</label>
          <input type="number" min="20" max="80" value="${ap.morning_cap_pct||60}" style="width:70px;height:30px;border:1px solid var(--border);border-radius:6px;padding:0 8px;font-size:12px;font-weight:700;background:var(--surface);color:var(--text)" oninput="settSetAMPMOption('morning_cap_pct',+this.value)">
          <span style="font-size:11px;color:var(--text-muted)">%</span>
        </div>
      </div>
      <div style="margin-top:14px">
        <div style="font-size:10px;font-weight:900;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em;margin-bottom:8px">Peak Priority Slots</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="peak-slots-row">
          ${["07:00","07:15","07:30","08:00","08:30","09:00","09:15","09:30","10:00","10:15","10:30","11:00","11:30","17:30","17:45","18:00","18:30","19:00","19:15","19:30","20:00"].map(t=>{
            const on=(ap.peak_slots||[]).includes(t);
            return`<button class="sett-mini-btn${on?" primary":""}" onclick="settTogglePeakSlot('${t}',this)" style="font-size:10px;padding:3px 8px">${t}</button>`;
          }).join("")}
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="sett-ghost-btn primary" onclick="settSaveAISettings()">Save AM/PM Settings</button>
      </div>
    </div>

    <div class="sett-config-panel">
      <div class="sett-section-kicker">Planner Intelligence</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
        <div class="sett-option-card">
          <div class="sett-option-top"><span class="sett-option-title">Score Floor</span><input type="number" min="0" max="50" value="${cfg.score_floor||25}" style="width:56px;height:28px;border:1px solid var(--border);border-radius:6px;padding:0 6px;font-size:12px;background:var(--surface);color:var(--text)" onchange="settSetPlannerOption('score_floor',+this.value)"></div>
          <div class="sett-option-desc">Classes scoring below this threshold are marked DROP and excluded unless forced by mix rules.</div>
        </div>
        <div class="sett-option-card">
          <div class="sett-option-top"><span class="sett-option-title">PROTECT Threshold</span><input type="number" min="50" max="100" value="${cfg.protect_threshold||70}" style="width:56px;height:28px;border:1px solid var(--border);border-radius:6px;padding:0 6px;font-size:12px;background:var(--surface);color:var(--text)" onchange="settSetPlannerOption('protect_threshold',+this.value)"></div>
          <div class="sett-option-desc">Slots scoring at or above this are PROTECT — always included in the optimised schedule.</div>
        </div>
        <div class="sett-option-card">
          <div class="sett-option-top"><span class="sett-option-title">Backtrack Depth</span><input type="number" min="1" max="10" value="${cfg.backtrack_depth||3}" style="width:56px;height:28px;border:1px solid var(--border);border-radius:6px;padding:0 6px;font-size:12px;background:var(--surface);color:var(--text)" onchange="settSetPlannerOption('backtrack_depth',+this.value)"></div>
          <div class="sett-option-desc">Max retries per slot when hard constraints block the top candidate. Higher = slower but more complete.</div>
        </div>
        <div class="sett-option-card">
          <div class="sett-option-top"><span class="sett-option-title">Trend Window</span><input type="number" min="4" max="26" value="${cfg.trend_window_weeks||12}" style="width:56px;height:28px;border:1px solid var(--border);border-radius:6px;padding:0 6px;font-size:12px;background:var(--surface);color:var(--text)" onchange="settSetPlannerOption('trend_window_weeks',+this.value)"><span style="font-size:10px;color:var(--text-muted);margin-left:4px">wks</span></div>
          <div class="sett-option-desc">Number of calendar weeks used to calculate fill-rate trend (positive slope gets scoring bonus).</div>
        </div>
      </div>
    </div>
  `;
}

function settUpdateScoringWeight(key,val){
  if(!_settSchedConfig)_settSchedConfig=settNormalizeConfig({});
  if(!_settSchedConfig.scoring_weights)_settSchedConfig.scoring_weights={fill_rate:35,revenue:25,avg_checkin:20,session_frequency:10,trend:10};
  _settSchedConfig.scoring_weights[key]=Number(val);
  const sum=Object.values(_settSchedConfig.scoring_weights).reduce((a,b)=>a+Number(b),0);
  const badge=document.getElementById("sw-sum-badge");
  if(badge){
    const ok=Math.abs(sum-100)<1;
    badge.style.background=ok?"#D1FAE5":"#FEF3C7";
    badge.style.color=ok?"#065F46":"#B45309";
    badge.textContent=`Sum: ${sum}% ${ok?"✓":"⚠ should be 100"}`;
  }
}

function settUpdateTimeBandWeight(band,val){
  if(!_settSchedConfig)_settSchedConfig=settNormalizeConfig({});
  if(!_settSchedConfig.time_band_weights)_settSchedConfig.time_band_weights={morning:1.0,midday:1.15,evening:1.1};
  _settSchedConfig.time_band_weights[band]=Number(val);
}

function settSetAMPMOption(key,val){
  if(!_settSchedConfig)_settSchedConfig=settNormalizeConfig({});
  if(!_settSchedConfig.am_pm_settings)_settSchedConfig.am_pm_settings={morning_cap_pct:60,enforce_split:false,peak_slots:["08:00","09:00","11:00","11:30","18:00","19:15"]};
  _settSchedConfig.am_pm_settings[key]=val;
}

function settTogglePeakSlot(t,btn){
  if(!_settSchedConfig)_settSchedConfig=settNormalizeConfig({});
  if(!_settSchedConfig.am_pm_settings)_settSchedConfig.am_pm_settings={morning_cap_pct:60,enforce_split:false,peak_slots:["08:00","09:00","11:00","11:30","18:00","19:15"]};
  const slots=_settSchedConfig.am_pm_settings.peak_slots||[];
  const idx=slots.indexOf(t);
  if(idx>=0){slots.splice(idx,1);btn.classList.remove("primary");}
  else{slots.push(t);btn.classList.add("primary");}
  _settSchedConfig.am_pm_settings.peak_slots=slots;
}

function settSetPlannerOption(key,val){
  if(!_settSchedConfig)_settSchedConfig=settNormalizeConfig({});
  _settSchedConfig[key]=val;
}

function settResetScoringWeights(){
  if(!_settSchedConfig)_settSchedConfig=settNormalizeConfig({});
  _settSchedConfig.scoring_weights={fill_rate:35,revenue:25,avg_checkin:20,session_frequency:10,trend:10};
  settRenderAISettings();
  showToast("Scoring weights reset to defaults","");
}

function settSaveAISettings(){
  if(!_settSchedConfig)return;
  settSaveCanonicalConfig("ai","AI & scoring settings saved");
}

function settLoadData(){
  const p1=_settTrainerProfiles?Promise.resolve(_settTrainerProfiles):schedulerFetch("/api/trainer-profiles").then(r=>r.json()).then(d=>{
    _settTrainerProfiles=Array.isArray(d)?d:(Array.isArray(d?.data)?d.data:[]);
    return _settTrainerProfiles;
  }).catch(()=>{_settTrainerProfiles=[];return[];});
  const p2=_settSchedConfig?Promise.resolve(_settSchedConfig):schedulerFetch("/api/schedule-config").then(r=>r.json()).then(d=>{
    _settSchedConfig=settNormalizeConfig((d&&!d.error)?d:settDefaultConfig());
    return _settSchedConfig;
  }).catch(()=>{_settSchedConfig=settNormalizeConfig(settDefaultConfig());return _settSchedConfig;});
  Promise.all([p1,p2]).then(()=>{
    settSyncPriorityFromTiers();
    settRenderTrainerManager();settRenderQualifications();settRenderTargets();
    settRenderLeave();settRenderClassMix();settRenderCustomRules();settRenderAdvancedOptions();settRenderAISettings();
    settRenderTrainerPolicyOptions();settRenderAvailabilityPolicyOptions();settRenderTargetsPolicyOptions();settRenderClassMixPolicyOptions();settRenderPinPolicyOptions();
    settPopulateLeaveTrainerList();
    settValidateAndRender();
  }).catch(()=>{});
}

function trainerIsActive(t){
  const inactive=new Set((_settSchedConfig?.inactive_trainers)||[]);
  return t.active!==false&&!inactive.has(t.name);
}

function settFilteredTrainerIndexes(){
  const q=(_trainerMgmtSearch||"").toLowerCase();
  return (_settTrainerProfiles||[]).map((t,i)=>({t,i})).filter(({t})=>{
    const name=(t.name||"").toLowerCase();
    const active=trainerIsActive(t);
    const locs=Object.keys(t.locations||{});
    if(q&&!name.includes(q))return false;
    if(_trainerMgmtStatusFilter==="active"&&!active)return false;
    if(_trainerMgmtStatusFilter==="inactive"&&active)return false;
    if(_trainerMgmtLocFilter&&!locs.includes(_trainerMgmtLocFilter))return false;
    return true;
  });
}

function settRenderTrainerManager(){
  const wrap=document.getElementById("trainer-mgr-wrap");
  if(!wrap||!_settTrainerProfiles)return;
  const rows=settFilteredTrainerIndexes();
  if(!rows.length){wrap.innerHTML=`<div style="font-size:12px;color:var(--text-muted);padding:10px 0">No trainers match the current filters.</div>`;return;}
  const cityGroups=groupTrainerRowsByCity(rows,({t})=>t);
  wrap.innerHTML=cityGroups.map(([city,cityRows])=>`
    <div class="sett-city-group-label">${rvEscapeHtml(city)} <span class="sett-city-group-count">${cityRows.length}</span></div>
    <div class="trainer-mgr-grid">
    ${cityRows.map(({t,i})=>{
      const active=trainerIsActive(t);
      const img=trainerImage(t.name);
      const locNames=Object.keys(t.locations||{});
      const classCount=locNames.reduce((sum,loc)=>sum+((t.locations?.[loc]?.session_count)||0),0);
      const tierCap=settTierDefaultCap(t.tier||3);
      return`<div class="trainer-mgr-card" data-index="${i}">
        <div class="trainer-mgr-top">
          <div class="trainer-mgr-avatar">${img?`<img src="${img}" alt="${rvEscapeAttr(t.name||"Trainer")}">`:trainerInitials(t.name||"New")}</div>
          <div class="trainer-mgr-fields">
            <input class="sett-input trainer-mgr-name" value="${rvEscapeAttr(t.name||"")}" placeholder="Trainer name" style="min-width:0">
            <select class="sett-select trainer-mgr-tier" onchange="settTrainerTierChanged(this)">
              ${[1,2,3,4].map(v=>`<option value="${v}" ${Number(t.tier||3)===v?"selected":""}>Tier ${v}</option>`).join("")}
            </select>
            <label class="trainer-mgr-active-label${active?"":" off"}">
              <input type="checkbox" class="trainer-mgr-active" ${active?"checked":""}> Active
            </label>
          </div>
        </div>
        <div class="trainer-mgr-meta">
          <span class="trainer-mgr-pill">${classCount} historic sessions</span>
          <span class="trainer-mgr-pill">${locNames.length} locations</span>
          <span class="trainer-mgr-pill">${Object.values(t.qualifications||{}).filter(Boolean).length} qualifications</span>
          <span class="trainer-mgr-pill trainer-mgr-cap-pill">Cap ${tierCap}/day</span>
        </div>
        <div class="trainer-mgr-locs">
          ${LOCS_ALL.map(loc=>{
            const ld=(t.locations||{})[loc]||{};
            const enabled=!!(t.locations||{})[loc];
            const activeDays=new Set(enabled?settAvailabilityDaysFor(t,ld):[]);
            const tw=ld.time_window||{};
            const weekOffs=settHistoricWeekOffDays(t);
            return`<div class="trainer-mgr-loc" data-loc="${rvEscapeAttr(loc)}">
              <div class="trainer-mgr-loc-head" onclick="settToggleTrainerLoc(this)">
                <label style="display:flex;gap:5px;align-items:center;text-transform:none;letter-spacing:0;font-size:11px;color:var(--text-2)" onclick="event.stopPropagation()"><input type="checkbox" class="trainer-mgr-loc-enabled" ${enabled?"checked":""} onchange="settToggleTrainerLoc(this.closest('.trainer-mgr-loc-head'),this.checked)"> ${rvEscapeHtml(loc.split(",")[0])}</label>
                <span class="sett-badge" style="min-width:64px">${ld.session_count||0} cls</span>
                <span class="trainer-mgr-loc-chevron">▾</span>
              </div>
              <div class="trainer-mgr-loc-body">
                ${weekOffs.length?`<div class="trainer-mgr-loc-days-hint">Historic off: <b>${weekOffs.map(d=>d.slice(0,3)).join(", ")}</b></div>`:""}
                <div class="avail-field">
                  <div class="avail-field-label">Available Days</div>
                  <div class="avail-days-row">
                    ${DAYS_ALL.map(d=>{
                      const on=activeDays.has(d);
                      return `<button class="avail-day-chip${on?" on":""}" data-day="${d}" onclick="event.stopPropagation();settToggleDay(this)" title="${d}">${d.slice(0,2)}</button>`;
                    }).join("")}
                  </div>
                </div>
                <div class="trainer-mgr-loc-grid">
                  <input class="sett-input trainer-mgr-start" type="time" value="${tw.start||"06:00"}" style="min-width:0" title="Shift start">
                  <input class="sett-input trainer-mgr-end" type="time" value="${tw.end||"22:00"}" style="min-width:0" title="Shift end">
                  <input class="sett-input trainer-mgr-maxd" type="number" min="1" max="8" value="${ld.max_classes_per_day||4}" title="Max classes/day" style="min-width:0">
                  <select class="sett-select trainer-mgr-ampm" title="AM/PM preference">
                    <option value="any" ${(ld.am_pm_preference||"any")==="any"?"selected":""}>Any</option>
                    <option value="am" ${ld.am_pm_preference==="am"?"selected":""}>AM Only</option>
                    <option value="pm" ${ld.am_pm_preference==="pm"?"selected":""}>PM Only</option>
                    <option value="am_pref" ${ld.am_pm_preference==="am_pref"?"selected":""}>Prefer AM</option>
                    <option value="pm_pref" ${ld.am_pm_preference==="pm_pref"?"selected":""}>Prefer PM</option>
                  </select>
                </div>
              </div>
            </div>`;
          }).join("")}
        </div>
        <div class="trainer-mgr-actions">
          <button class="sett-mini-btn danger" onclick="settDeleteTrainer('${String(t.name||"").replace(/'/g,"\\'")}')">Delete</button>
        </div>
      </div>`;
    }).join("")}
  </div>`).join("");
}

function settTierDefaultCap(tier){
  const t=Number(tier||3);
  if(t===1)return 4;
  if(t===2)return 3;
  return 2;
}

function settTrainerTierChanged(sel){
  const cap=settTierDefaultCap(sel.value);
  const card=sel.closest(".trainer-mgr-card");
  if(!card)return;
  card.querySelectorAll(".trainer-mgr-maxd").forEach(inp=>{inp.value=cap;});
  const badge=card.querySelector(".trainer-mgr-cap-pill");
  if(badge)badge.textContent=`Tier ${sel.value} default cap ${cap}/day`;
}

function settCollectTrainerManager(){
  const next=[...(_settTrainerProfiles||[])];
  const inactive=new Set((_settSchedConfig?.inactive_trainers)||[]);
  document.querySelectorAll(".trainer-mgr-card").forEach(card=>{
    const idx=Number(card.dataset.index);
    const prev=next[idx]||{};
    const oldName=prev.name||"";
    const name=(card.querySelector(".trainer-mgr-name")||{}).value?.trim()||oldName;
    const tier=Number((card.querySelector(".trainer-mgr-tier")||{}).value||prev.tier||3);
    const active=!!(card.querySelector(".trainer-mgr-active")||{}).checked;
    const locs={};
    card.querySelectorAll(".trainer-mgr-loc").forEach(locEl=>{
      if(!locEl.querySelector(".trainer-mgr-loc-enabled")?.checked)return;
      const loc=locEl.dataset.loc;
      const selectedDays=[...locEl.querySelectorAll(".avail-day-chip.on")].map(ch=>ch.dataset.day);
      const old=(prev.locations||{})[loc]||{};
      const days=[...new Set(selectedDays.length?selectedDays:settAvailabilityDaysFor(prev,old))];
      locs[loc]={
        ...old,
        available_days:days,
        time_window:{
          start:locEl.querySelector(".trainer-mgr-start")?.value||old.time_window?.start||"07:00",
          end:locEl.querySelector(".trainer-mgr-end")?.value||old.time_window?.end||"21:00",
        },
        max_classes_per_day:Number(locEl.querySelector(".trainer-mgr-maxd")?.value||old.max_classes_per_day||4),
        am_pm_preference:locEl.querySelector(".trainer-mgr-ampm")?.value||old.am_pm_preference||"any",
      };
    });
    next[idx]={...prev,name,tier,active,locations:locs};
    inactive.delete(oldName);
    inactive.delete(name);
    if(!active)inactive.add(name);
  });
  const names=next.map(t=>(t.name||"").trim()).filter(Boolean);
  if(new Set(names).size!==names.length)throw new Error("Trainer names must be unique.");
  if(!_settSchedConfig)_settSchedConfig={};
  _settSchedConfig.inactive_trainers=[...inactive].sort();
  return next;
}

function settSaveTrainerManager(){
  let updated;
  try{updated=settCollectTrainerManager();}
  catch(e){showToast(e.message||"Invalid trainer data","error");return;}
  _settTrainerProfiles=updated;
  _settSchedConfig=settNormalizeConfig(_settSchedConfig||{});
  settSyncPriorityFromTiers();
  Promise.all([
    schedulerFetch("/api/save-trainer-profiles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(updated)}).then(r=>r.json()),
    schedulerFetch("/api/save-schedule-config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(_settSchedConfig||{})}).then(r=>r.json()),
  ]).then(([a,b])=>{
    const ok=a.ok&&b.ok;
    const s=document.getElementById("trainer-mgr-save-status");
    if(s)s.textContent=ok?"Saved!":"Error";
    showToast(ok?"Trainer directory saved":"Save failed",ok?"":"error");
    settRenderTrainerManager();settRenderQualifications();settPopulateLeaveTrainerList();
    setTimeout(()=>{if(s)s.textContent="";},3000);
  }).catch(()=>showToast("Server error","error"));
}

function settAddTrainer(){
  const name=prompt("Trainer name");
  if(!name)return;
  if((_settTrainerProfiles||[]).some(t=>(t.name||"").toLowerCase()===name.trim().toLowerCase())){showToast("Trainer already exists","error");return;}
  const loc=(_trainerMgmtLocFilter&&LOCS_ALL.includes(_trainerMgmtLocFilter))?_trainerMgmtLocFilter:LOCS_ALL[0];
  const profile={
    name:name.trim(),
    tier:3,
    active:true,
    qualifications:{all_barre:true,mat_57:false,powercycle:false,strength_lab:false,foundations:false,pre_post_natal:false,amped_up:false,hiit:false,recovery:false},
    locations:{[loc]:{available_days:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],time_window:{start:"06:00",end:"22:00"},max_classes_per_day:4,session_count:0}},
  };
  if(!_settTrainerProfiles)_settTrainerProfiles=[];
  _settTrainerProfiles.push(profile);
  settSyncPriorityFromTiers();
  settRenderTrainerManager();settRenderQualifications();settPopulateLeaveTrainerList();
  showToast("Trainer added — save to persist","");
}

function settDeleteTrainer(name){
  if(!name)return;
  if(!confirm(`Delete trainer "${name}" from profiles? Existing generated schedules will keep their text until regenerated.`))return;
  _settTrainerProfiles=(_settTrainerProfiles||[]).filter(t=>t.name!==name);
  if(!_settSchedConfig)_settSchedConfig={};
  const inactive=new Set(_settSchedConfig.inactive_trainers||[]);
  inactive.add(name);
  _settSchedConfig.inactive_trainers=[...inactive].sort();
  settRenderTrainerManager();settRenderQualifications();settPopulateLeaveTrainerList();
  showToast("Trainer removed — save to persist","");
}

function settTrainerBulkActive(active){
  const visible=new Set(settFilteredTrainerIndexes().map(({i})=>i));
  (_settTrainerProfiles||[]).forEach((t,i)=>{if(visible.has(i))t.active=active;});
  if(!_settSchedConfig)_settSchedConfig={};
  const inactive=new Set(_settSchedConfig.inactive_trainers||[]);
  (_settTrainerProfiles||[]).forEach((t,i)=>{
    if(!visible.has(i))return;
    if(active)inactive.delete(t.name);else inactive.add(t.name);
  });
  _settSchedConfig.inactive_trainers=[...inactive].sort();
  settRenderTrainerManager();
  showToast(`${visible.size} trainer${visible.size===1?"":"s"} ${active?"activated":"deactivated"} — saving…`,"");
  settSaveTrainerManager();
}

function settTrainerBulkTier(){
  const tier=Number(document.getElementById("trainer-bulk-tier")?.value||1);
  const cap=settTierDefaultCap(tier);
  const visible=new Set(settFilteredTrainerIndexes().map(({i})=>i));
  (_settTrainerProfiles||[]).forEach((t,i)=>{
    if(!visible.has(i))return;
    t.tier=tier;
    Object.values(t.locations||{}).forEach(ld=>{ld.max_classes_per_day=cap;});
  });
  settSyncPriorityFromTiers();
  settRenderTrainerManager();settRenderQualifications();
  showToast(`${visible.size} visible trainer${visible.size===1?"":"s"} moved to Tier ${tier} with ${cap}/day cap — saving…`,"");
  settSaveTrainerManager();
}

function settTrainerBulkClassCap(){
  const cap=Math.max(1,Math.min(6,Number(document.getElementById("trainer-bulk-cap")?.value||4)));
  const visible=new Set(settFilteredTrainerIndexes().map(({i})=>i));
  (_settTrainerProfiles||[]).forEach((t,i)=>{
    if(!visible.has(i))return;
    Object.values(t.locations||{}).forEach(ld=>{ld.max_classes_per_day=cap;});
  });
  settRenderTrainerManager();
  showToast(`${visible.size} visible trainer${visible.size===1?"":"s"} set to ${cap}/day cap — saving…`,"");
  settSaveTrainerManager();
}

function settRenderQualifications(){
  const wrap=document.getElementById("qual-table-wrap");
  if(!wrap||!_settTrainerProfiles)return;
  const trainers=Array.isArray(_settTrainerProfiles)?_settTrainerProfiles:[];
  const q=(_qualSearch||"").toLowerCase();
  const sorted=[...trainers].sort((a,b)=>(a.name||"").localeCompare(b.name||"")).filter(t=>!q||(t.name||"").toLowerCase().includes(q));
  wrap.innerHTML=`<div class="qual-wrap">
    <table class="qual-table" id="qual-table">
    <colgroup>
      <col class="qual-name-col">
      <col class="qual-tier-col">
      ${QUAL_KEYS.map(()=>`<col class="qual-format-col">`).join("")}
    </colgroup>
    <thead><tr>
      <th>Trainer</th>
      <th>Tier</th>
      ${QUAL_KEYS.map(k=>{
        const label=QUAL_LABELS[k]||k;
        return `<th title="${rvEscapeAttr(label)}"><div class="qual-col-head">
        <span class="qual-format-label">${label}</span>
        <div class="qual-col-actions">
          <button class="qual-col-btn" title="Enable All" onclick="settQualColumn('${k}',true);event.stopPropagation()">+</button>
          <button class="qual-col-btn" title="Disable All" onclick="settQualColumn('${k}',false);event.stopPropagation()">−</button>
        </div>
      </div></th>`;
      }).join("")}
    </tr></thead>
    <tbody>
      ${groupTrainerRowsByCity(sorted,t=>t).map(([city,cityTrainers])=>`
        <tr class="qual-city-row"><td colspan="${2+QUAL_KEYS.length}" class="qual-city-label">${rvEscapeHtml(city)} <span class="sett-city-group-count">${cityTrainers.length}</span></td></tr>
        ${cityTrainers.map(t=>`<tr class="qual-row" data-trainer="${(t.name||"").replace(/"/g,"&quot;")}">
        <td>
          <div class="qual-row-name">
            <span class="trainer-mgr-avatar" style="width:28px;height:28px">${trainerImage(t.name)?`<img src="${trainerImage(t.name)}">`:trainerInitials(t.name||"")}</span>
            <span style="font-size:11px">${rvEscapeHtml(t.name||"")}</span>
          </div>
        </td>
        <td><span class="qual-tier">T${t.tier||"?"}</span></td>
        ${QUAL_KEYS.map(k=>`<td><input type="checkbox" class="qual-cb" data-trainer="${(t.name||"").replace(/"/g,"&quot;")}" data-key="${k}" ${(t.qualifications||{})[k]?"checked":""} onchange="settCollectQualsFromDom()"></td>`).join("")}
      </tr>`).join("")}`).join("")}
    </tbody>
  </table></div>`;
}

function settCollectQualsFromDom(){
  if(!_settTrainerProfiles)return;
  document.querySelectorAll(".qual-cb").forEach(cb=>{
    const trainer=cb.dataset.trainer;
    const key=cb.dataset.key;
    const profile=_settTrainerProfiles.find(t=>t.name===trainer);
    if(profile){
      if(!profile.qualifications)profile.qualifications={};
      profile.qualifications[key]=cb.checked;
    }
  });
}

function settQualBulk(on){
  const cbs=[...document.querySelectorAll(".qual-cb")].filter(cb=>{
    const row=cb.closest(".qual-row");
    return row&&row.style.display!=="none";
  });
  cbs.forEach(cb=>{cb.checked=on;});
  settCollectQualsFromDom();
  showToast(`${on?"Checked":"Unchecked"} ${cbs.length} visible qualification${cbs.length===1?"":"s"}`,"");
}

function settQualColumn(key,on){
  const cbs=[...document.querySelectorAll(`.qual-cb[data-key="${key}"]`)].filter(cb=>{
    const row=cb.closest(".qual-row");
    return row&&row.style.display!=="none";
  });
  cbs.forEach(cb=>{cb.checked=on;});
  settCollectQualsFromDom();
  showToast(`${on?"Enabled":"Disabled"} ${QUAL_LABELS[key]||key} for visible trainers`,"");
}

function settSaveQualifications(){
  if(!_settTrainerProfiles)return;
  const table=document.getElementById("qual-table");
  if(!table)return;
  const cbs=table.querySelectorAll(".qual-cb");
  const updates={};
  cbs.forEach(cb=>{
    const name=cb.dataset.trainer;
    const key=cb.dataset.key;
    if(!updates[name])updates[name]={};
    updates[name][key]=cb.checked;
  });
  const updated=(_settTrainerProfiles||[]).map(t=>{
    if(updates[t.name]){return{...t,qualifications:{...t.qualifications,...updates[t.name]}};}
    return t;
  });
  _settTrainerProfiles=updated;
  schedulerFetch("/api/save-trainer-profiles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(updated)})
    .then(r=>r.json())
    .then(res=>{
      const s=document.getElementById("qual-save-status");
      if(s)s.textContent=res.ok?"Saved successfully!":"Error saving";
      showToast(res.ok?"Trainer qualifications saved":"Save failed",res.ok?"":"error");
      setTimeout(()=>{if(s)s.textContent="";},3000);
    }).catch(()=>{showToast("Server error","error");});
}

function settToggleTrainerLoc(headEl,forceOpen){
  const card=headEl.closest(".trainer-mgr-loc");
  if(!card)return;
  if(forceOpen===true){card.classList.add("expanded");return;}
  if(forceOpen===false){card.classList.remove("expanded");return;}
  card.classList.toggle("expanded");
}

function settToggleDay(el){
  el.classList.toggle("on");
}

function settBulkToolbarHtml(matrix,title){
  const defaultScope=(_settSchedConfig?.settings_options?.default_bulk_scope)||"selection";
  return`<div class="sett-matrix-toolbar" data-toolbar="${matrix}">
    <div class="sett-bulk-field">
      <label>${title}</label>
      <select id="${matrix}-bulk-op">
        <option value="set-target">Set target/min</option>
        <option value="inc-target">Increment target/min</option>
        <option value="set-max">Set max</option>
        <option value="max-plus">Max = target/min + N</option>
        <option value="weekday-template">Apply weekday template</option>
        <option value="weekend-template">Apply weekend template</option>
        <option value="clear-selection">Clear selected to zero</option>
      </select>
    </div>
    <div class="sett-bulk-field"><label>Value</label><input type="number" id="${matrix}-bulk-value" value="1"></div>
    <div class="sett-bulk-field">
      <label>Scope</label>
      <select id="${matrix}-bulk-scope">
        <option value="selection" ${defaultScope==="selection"?"selected":""}>Selected cells</option>
        <option value="visible" ${defaultScope==="visible"?"selected":""}>All visible cells</option>
        <option value="weekdays" ${defaultScope==="weekdays"?"selected":""}>Weekdays</option>
        <option value="weekend" ${defaultScope==="weekend"?"selected":""}>Weekend</option>
      </select>
    </div>
    <button class="sett-ghost-btn" onclick="settSelectAllMatrixCells('${matrix}')">Select All</button>
    <button class="sett-ghost-btn" onclick="settApplyBulk('${matrix}')">Preview & Apply</button>
    <button class="sett-ghost-btn" onclick="settResetMatrixSelection()">Clear Selection</button>
    <div class="sett-inspector-box sett-selection-status" data-matrix="${matrix}">Select cells above, or use Select All, then apply a bulk operator.</div>
  </div>`;
}

function settClassMixAdvancedBulkHtml(classes){
  return `<div class="sett-matrix-toolbar" style="margin-top:8px">
    <div class="sett-bulk-field">
      <label>Location</label>
      <select id="classmix-adv-loc">
        <option value="__all__">All locations</option>
        ${LOCS_ALL.map(loc=>`<option value="${rvEscapeAttr(loc)}">${rvEscapeHtml(LOC_SHORT[loc]||loc)}</option>`).join("")}
      </select>
    </div>
    <div class="sett-bulk-field" style="min-width:220px">
      <label>Format</label>
      <select id="classmix-adv-cls">
        <option value="__all__">All formats</option>
        ${classes.map(cls=>`<option value="${rvEscapeAttr(cls)}">${rvEscapeHtml(displayClass(cls))}</option>`).join("")}
      </select>
    </div>
    <div class="sett-bulk-field">
      <label>Operation</label>
      <select id="classmix-adv-op">
        <option value="set-target">Set min</option>
        <option value="inc-target">Increase min</option>
        <option value="set-max">Set max</option>
        <option value="max-plus">Set max = min + N</option>
        <option value="clear-selection">Clear to zero</option>
      </select>
    </div>
    <div class="sett-bulk-field"><label>Value</label><input type="number" id="classmix-adv-value" value="1"></div>
    <button class="sett-ghost-btn" onclick="settApplyClassMixAdvancedBulk()">Apply Location + Format</button>
  </div>`;
}

function settApplyClassMixAdvancedBulk(){
  const loc=document.getElementById("classmix-adv-loc")?.value||"__all__";
  const cls=document.getElementById("classmix-adv-cls")?.value||"__all__";
  const op=document.getElementById("classmix-adv-op")?.value||"set-target";
  const value=document.getElementById("classmix-adv-value")?.value||"1";
  const opSel=document.getElementById("classmix-bulk-op");
  const valueInp=document.getElementById("classmix-bulk-value");
  const scopeSel=document.getElementById("classmix-bulk-scope");
  if(opSel)opSel.value=op;
  if(valueInp)valueInp.value=value;
  if(scopeSel)scopeSel.value="selection";

  settResetMatrixSelection(false);
  const cells=[...document.querySelectorAll(`.sett-matrix-cell[data-matrix="classmix"]`)].filter(el=>{
    const locOk=loc==="__all__"||el.dataset.loc===loc;
    const clsOk=cls==="__all__"||el.dataset.key===cls;
    return locOk&&clsOk;
  });
  cells.forEach(el=>settSelectMatrixElement(el,true));
  settUpdateSelectionInspector();
  settApplyBulk("classmix");
}

function settMatrixCellKey(el){return `${el.dataset.matrix}|${el.dataset.loc}|${el.dataset.key}`;}
function settSelectMatrixElement(el,on=true){
  const key=settMatrixCellKey(el);
  el.classList.toggle("selected",on);
  if(on)_settMatrixSelection.add(key);else _settMatrixSelection.delete(key);
}
function settToggleMatrixCell(event,el){
  if(event.metaKey||event.ctrlKey){
    document.querySelectorAll(`.sett-matrix-cell[data-matrix="${el.dataset.matrix}"][data-loc="${CSS.escape(el.dataset.loc)}"]`).forEach(cell=>settSelectMatrixElement(cell,true));
  } else {
    settSelectMatrixElement(el,!el.classList.contains("selected"));
  }
  settUpdateSelectionInspector();
}
function settSelectMatrixRow(matrix,loc){
  const rowCells=[...document.querySelectorAll(`.sett-matrix-cell[data-matrix="${matrix}"][data-loc="${CSS.escape(loc)}"]`)];
  const allSelected=rowCells.length>0&&rowCells.every(el=>el.classList.contains("selected"));
  rowCells.forEach(el=>settSelectMatrixElement(el,!allSelected));
  settUpdateSelectionInspector();
}
function settSelectMatrixColumn(matrix,key){
  const colCells=[...document.querySelectorAll(`.sett-matrix-cell[data-matrix="${matrix}"][data-key="${CSS.escape(key)}"]`)];
  const allSelected=colCells.length>0&&colCells.every(el=>el.classList.contains("selected"));
  colCells.forEach(el=>settSelectMatrixElement(el,!allSelected));
  settUpdateSelectionInspector();
}
function settResetMatrixSelection(update=true){
  _settMatrixSelection.clear();
  document.querySelectorAll(".sett-matrix-cell.selected").forEach(el=>el.classList.remove("selected"));
  if(update)settUpdateSelectionInspector();
}
function settSelectAllMatrixCells(matrix){
  document.querySelectorAll(`.sett-matrix-cell[data-matrix="${matrix}"]`).forEach(el=>settSelectMatrixElement(el,true));
  settUpdateSelectionInspector();
}
function settCellsForScope(matrix,scope){
  if(scope==="selection"){
    const selected=[...document.querySelectorAll(`.sett-matrix-cell[data-matrix="${matrix}"].selected`)];
    return selected.length?selected:[...document.querySelectorAll(`.sett-matrix-cell[data-matrix="${matrix}"]`)];
  }
  if(scope==="weekdays")return [...document.querySelectorAll(`.sett-matrix-cell[data-matrix="${matrix}"]`)].filter(el=>DAYS_ALL.slice(0,5).includes(el.dataset.key));
  if(scope==="weekend")return [...document.querySelectorAll(`.sett-matrix-cell[data-matrix="${matrix}"]`)].filter(el=>["Saturday","Sunday"].includes(el.dataset.key));
  return [...document.querySelectorAll(`.sett-matrix-cell[data-matrix="${matrix}"]`)];
}
function settUpdateSelectionInspector(){
  document.querySelectorAll(".sett-selection-status").forEach(box=>{
    const matrix=box.dataset.matrix;
    const selected=[...document.querySelectorAll(`.sett-matrix-cell[data-matrix="${matrix}"].selected`)];
    if(!selected.length){box.innerHTML="Select cells above, or use Select All, then apply a bulk operator.";return;}
    const locs=new Set(selected.map(el=>el.dataset.loc));
    const keys=new Set(selected.map(el=>el.dataset.key));
    box.innerHTML=`<strong>${selected.length} selected cell${selected.length===1?"":"s"}</strong><br>${[...locs].map(l=>LOC_SHORT[l]||l).join(", ")}<br><span style="color:#64748B">${[...keys].slice(0,8).join(", ")}${keys.size>8?"…":""}</span>`;
  });
}
function settApplyBulk(matrix){
  const op=document.getElementById(`${matrix}-bulk-op`)?.value||"set-target";
  const raw=Number(document.getElementById(`${matrix}-bulk-value`)?.value||0);
  const scope=document.getElementById(`${matrix}-bulk-scope`)?.value||"selection";
  const cells=settCellsForScope(matrix,scope);
  cells.forEach(cell=>{
    const inputs=[...cell.querySelectorAll("input")];
    const first=inputs.find(inp=>["target","min"].includes(inp.dataset.field));
    const max=inputs.find(inp=>inp.dataset.field==="max");
    if(!first||!max)return;
    const a=Number(first.value||0);
    if(op==="set-target")first.value=Math.max(0,raw);
    if(op==="inc-target")first.value=Math.max(0,a+raw);
    if(op==="set-max")max.value=Math.max(0,raw);
    if(op==="max-plus")max.value=Math.max(Number(first.value||0),Number(first.value||0)+raw);
    if(op==="weekday-template"){first.value=matrix==="targets"?10:2;max.value=matrix==="targets"?12:4;}
    if(op==="weekend-template"){first.value=matrix==="targets"?6:1;max.value=matrix==="targets"?8:3;}
    if(op==="clear-selection"){first.value=0;max.value=0;}
  });
  if(matrix==="targets")settTargetsChanged();
  if(matrix==="classmix")settClassMixChanged();
  showToast(`${cells.length} ${matrix==="targets"?"target":"class mix"} cell${cells.length===1?"":"s"} updated`,"");
}

function settRenderTargets(){
  const wrap=document.getElementById("targets-wrap");
  if(!wrap||!_settSchedConfig)return;
  _settSchedConfig=settNormalizeConfig(_settSchedConfig);
  const targets=(_settSchedConfig.targets||{});
  wrap.innerHTML=`
    ${settBulkToolbarHtml("targets","Daily target bulk operators")}
    <div class="sett-matrix-wrap">
      <table class="sett-matrix" id="targets-matrix">
        <thead><tr>
          <th>Studio</th>
          ${DAYS_ALL.map(day=>`<th><button class="sett-mini-btn" onclick="settSelectMatrixColumn('targets','${day}')">${day.slice(0,3)}</button></th>`).join("")}
        </tr></thead>
        <tbody>
          ${LOCS_ALL.map(loc=>`<tr>
            <td class="sett-matrix-rowhead"><button class="sett-mini-btn" onclick="settSelectMatrixRow('targets','${rvEscapeAttr(loc)}')">${rvEscapeHtml(loc)}</button></td>
            ${DAYS_ALL.map(day=>{
              const dt=targets[loc]?.[day]||{};
              const invalid=Number(dt.target||0)>Number(dt.max||0);
              return`<td>
                <div class="sett-matrix-cell ${invalid?"invalid":""}" data-matrix="targets" data-loc="${rvEscapeAttr(loc)}" data-key="${day}" onclick="settToggleMatrixCell(event,this)">
                  <div class="sett-matrix-pair">
                    <label class="sett-matrix-mini"><span>Min</span><input type="number" min="0" max="30" data-loc="${rvEscapeAttr(loc)}" data-day="${day}" data-field="target" value="${Number(dt.target||0)}" class="target-inp" onclick="event.stopPropagation()" oninput="settTargetsChanged()"></label>
                    <label class="sett-matrix-mini"><span>Max</span><input type="number" min="0" max="35" data-loc="${rvEscapeAttr(loc)}" data-day="${day}" data-field="max" value="${Number(dt.max||0)}" class="target-inp" onclick="event.stopPropagation()" oninput="settTargetsChanged()"></label>
                  </div>
                </div>
              </td>`;
            }).join("")}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  settValidateAndRender();
}

function settSaveTargets(){
  settCollectTargetsFromDom();
  settSaveCanonicalConfig("targets","Schedule targets saved");
}

function settCollectTargetsFromDom(){
  const targets={};
  document.querySelectorAll(".target-inp").forEach(inp=>{
    const{loc,day,field}=inp.dataset;
    if(!targets[loc])targets[loc]={};
    if(!targets[loc][day])targets[loc][day]={};
    targets[loc][day][field]=parseInt(inp.value)||0;
    targets[loc][day].source="settings";
  });
  _settSchedConfig={...(_settSchedConfig||{}),targets};
  _settSchedConfig=settNormalizeConfig(_settSchedConfig);
}

function settTargetsChanged(){
  settCollectTargetsFromDom();
  document.querySelectorAll(".target-inp").forEach(inp=>{
    const cell=inp.closest(".sett-matrix-cell");
    if(!cell)return;
    const loc=inp.dataset.loc, day=inp.dataset.day;
    const cur=_settSchedConfig.targets?.[loc]?.[day]||{};
    cell.classList.toggle("invalid",Number(cur.target||0)>Number(cur.max||0));
  });
  settValidateAndRender();
}

// ---------- Leave & Off Days ----------
function settPopulateLeaveTrainerList(){
  const dl=document.getElementById("leave-trainer-list");
  if(!dl||!_settTrainerProfiles)return;
  dl.innerHTML=(_settTrainerProfiles||[]).map(t=>`<option value="${rvEscapeAttr(t.name||"")}"></option>`).join("");
}

function settRenderLeave(){
  const wrap=document.getElementById("leave-list");
  if(!wrap)return;
  const periods=(_settSchedConfig?.leave_periods)||[];
  const offDays=(_settSchedConfig?.off_days)||[];
  if(!periods.length&&!offDays.length){wrap.innerHTML=`<div class="leave-empty">No leave periods recorded.</div>`;return;}
  const row=(p,i,kind)=>`<div class="leave-row">
      <div class="leave-row-avatar">${trainerInitials(p.trainer||"")}</div>
      <div class="leave-row-body">
        <span class="leave-row-name">${rvEscapeHtml(p.trainer)}</span>
        <span class="leave-row-range">${kind==="leave"?`${p.from_date} → ${p.to_date}`:p.date}</span>
        ${p.location?`<span class="leave-row-loc">${rvEscapeHtml(p.location)}</span>`:`<span class="leave-row-loc all">All locations</span>`}
      </div>
      <button class="leave-row-remove" onclick="${kind==="leave"?`settRemoveLeave(${i})`:`settRemoveOffDay(${i})`}">Remove</button>
    </div>`;
  wrap.innerHTML=`
    <div class="leave-group-label">Active Leave Periods (${periods.length})</div>
    ${periods.map((p,i)=>row(p,i,"leave")).join("")||`<div class="leave-empty">None yet.</div>`}
    <div class="leave-group-label" style="margin-top:16px">One-off Off Days (${offDays.length})</div>
    ${offDays.map((p,i)=>row(p,i,"offday")).join("")||`<div class="leave-empty">None yet.</div>`}`;
}

function settAddLeave(){
  const trainer=(document.getElementById("leave-trainer")||{}).value||"";
  const from=(document.getElementById("leave-from")||{}).value||"";
  const to=(document.getElementById("leave-to")||{}).value||"";
  const loc=(document.getElementById("leave-loc")||{}).value||"";
  if(!trainer||!from||!to){showToast("Fill trainer, from date, and to date","error");return;}
  if(!_settSchedConfig)_settSchedConfig={};
  if(!_settSchedConfig.leave_periods)_settSchedConfig.leave_periods=[];
  _settSchedConfig.leave_periods.push({trainer,from_date:from,to_date:to,...(loc?{location:loc}:{})});
  settRenderLeave();
  document.getElementById("leave-trainer").value="";
  document.getElementById("leave-from").value="";
  document.getElementById("leave-to").value="";
  showToast("Leave period added — save to persist","");
}

function settRemoveLeave(idx){
  if(!_settSchedConfig?.leave_periods)return;
  _settSchedConfig.leave_periods.splice(idx,1);
  settRenderLeave();
}

function settAddOffDay(){
  const trainer=(document.getElementById("offday-trainer")||{}).value||"";
  const day=(document.getElementById("offday-date")||{}).value||"";
  const loc=(document.getElementById("offday-loc")||{}).value||"";
  if(!trainer||!day){showToast("Fill trainer and date","error");return;}
  if(!_settSchedConfig)_settSchedConfig={};
  if(!_settSchedConfig.off_days)_settSchedConfig.off_days=[];
  _settSchedConfig.off_days.push({trainer,date:day,...(loc?{location:loc}:{})});
  settRenderLeave();
  document.getElementById("offday-trainer").value="";
  document.getElementById("offday-date").value="";
  showToast("Off day added — save to persist","");
}

function settRemoveOffDay(idx){
  if(!_settSchedConfig?.off_days)return;
  _settSchedConfig.off_days.splice(idx,1);
  settRenderLeave();
}

function settSaveLeave(){
  settSaveCanonicalConfig("leave","Leave config saved");
}

// ---------- Class Mix Rules ----------
const CMIX_FAMILY_LABELS={
  barre:"Barre & Signature Formats",powercycle:"PowerCycle",strength_lab:"Strength Lab",
  mat_57:"Mat 57",recovery:"Recovery",foundations:"Foundations",hiit:"HIIT",default:"Other Formats"
};
// Universal band mirrors the saved Universal Rules "MIX-001" entry (Barre 57
// family 45-55% of weekly classes). Per-location PowerCycle bands mirror
// "MIX-002". Shown here as a live health check, not a new hard rule.
const CMIX_UNIVERSAL_BAND={family:"barre",label:"Barre & Signature family",min:45,max:55};
const CMIX_LOCATION_BANDS={
  "Kwality House, Kemps Corner":{family:"powercycle",label:"PowerCycle",min:8,max:10},
  "Supreme HQ, Bandra":{family:"powercycle",label:"PowerCycle",min:25,max:28},
  "Kenkere House":{family:"powercycle",label:"PowerCycle",min:0,max:0},
};
let _cmixActiveLoc=null;
let _cmixSearch="";

function classQualKey(cn){
  const raw=String(cn||"").toLowerCase();
  const canon=canonicalMixClass(cn).toLowerCase();
  const l=canon+" "+raw;
  if(l.includes("powercycle")&&l.includes("express"))return"express_cycle";
  if(l.includes("powercycle"))return"powercycle";
  if(l.includes("strength lab"))return"strength_lab";
  if(l.includes("back body blaze"))return"back_body_blaze";
  if((l.includes("barre 57")||l.includes("cardio barre")||l.includes("mat 57"))&&l.includes("express"))return"express_barre";
  if(l.includes("cardio barre"))return"cardio_barre";
  if(l.includes("mat 57"))return"mat_57";
  if(l.includes("barre flow"))return"barre_flow";
  if(l.includes("barre 57")||l.includes("all barre"))return"all_barre";
  if(l.includes("natal"))return"pre_post_natal";
  if(l.includes("foundation"))return"foundations";
  if(l.includes("amped"))return"amped_up";
  if(l.includes("hiit"))return"hiit";
  if(l.includes("fit"))return"fit";
  if(l.includes("recovery"))return"recovery";
  return"special";
}

function settClassMixLocClasses(loc,cfg){
  const supported=Object.keys(CLASS_MIX_TARGETS[loc]||{});
  const cfgLoc=cfg[loc]||{};
  // Settings normalization backfills every known class name onto every
  // location as a harmless {min:0,max:0} placeholder. Only surface a saved
  // key here if it's actually relevant to this location (in its supported
  // list) or genuinely configured (non-zero) — otherwise every location's
  // card view would show every other location's classes at 0/0.
  const custom=Object.keys(cfgLoc).filter(cls=>{
    if(supported.includes(cls))return false;
    const v=cfgLoc[cls]||{};
    return Number(v.min||0)>0||Number(v.max||0)>0;
  });
  return [...new Set([...supported,...custom])];
}
function settClassMixLocWeeklyMin(loc,cfg){
  const cfgLoc=cfg[loc]||{};
  return settClassMixLocClasses(loc,cfg).reduce((sum,cls)=>{
    const cur=cfgLoc[cls]||(CLASS_MIX_TARGETS[loc]||{})[cls]||{min:0};
    return sum+Number(cur.min||0);
  },0);
}
function settClassMixFamilyMin(loc,cfg,family){
  const cfgLoc=cfg[loc]||{};
  return settClassMixLocClasses(loc,cfg).filter(cls=>getFamily(cls)===family).reduce((sum,cls)=>{
    const cur=cfgLoc[cls]||(CLASS_MIX_TARGETS[loc]||{})[cls]||{min:0};
    return sum+Number(cur.min||0);
  },0);
}
function settClassMixHealthChip(label,pct,min,max){
  const status=pct<min?"low":pct>max?"high":"ok";
  const color=status==="ok"?"#15803D":status==="low"?"#D97706":"#DC2626";
  const bg=status==="ok"?"#F0FDF4":status==="low"?"#FFFBEB":"#FEF2F2";
  const note=status==="ok"?"On target":status==="low"?"Below target":"Above target";
  return `<div class="cmix-health-chip" style="border-color:${color}44;background:${bg}">
    <div class="cmix-health-chip-top"><span>${rvEscapeHtml(label)}</span><b style="color:${color}">${pct.toFixed(0)}%</b></div>
    <div class="cmix-health-chip-bar"><div style="width:${Math.min(100,pct)}%;background:${color}"></div></div>
    <div class="cmix-health-chip-note" style="color:${color}">${note} · target ${min}-${max}%</div>
  </div>`;
}
function settRenderClassMixHealth(){
  const host=document.getElementById("cmix-health-strip");
  if(!host)return;
  const cfg=_settSchedConfig?.class_mix||{};
  const total=LOCS_ALL.reduce((s,loc)=>s+settClassMixLocWeeklyMin(loc,cfg),0);
  if(!total){host.innerHTML=`<div class="cmix-health-empty">Set class minimums below to see live mix-health checks.</div>`;return;}
  const uMin=LOCS_ALL.reduce((s,loc)=>s+settClassMixFamilyMin(loc,cfg,CMIX_UNIVERSAL_BAND.family),0);
  const chips=[settClassMixHealthChip(CMIX_UNIVERSAL_BAND.label,(uMin/total)*100,CMIX_UNIVERSAL_BAND.min,CMIX_UNIVERSAL_BAND.max)];
  Object.entries(CMIX_LOCATION_BANDS).forEach(([loc,band])=>{
    const locTotal=settClassMixLocWeeklyMin(loc,cfg);
    if(!locTotal)return;
    const bMin=settClassMixFamilyMin(loc,cfg,band.family);
    chips.push(settClassMixHealthChip(`${band.label} · ${LOC_SHORT[loc]||loc}`,(bMin/locTotal)*100,band.min,band.max));
  });
  host.innerHTML=`<div class="cmix-health-total">${total} classes/week planned across all studios</div><div class="cmix-health-chips">${chips.join("")}</div>`;
}

function settClassCapacityRowHtml(loc,cls,cfg){
  const supported=(CLASS_MIX_TARGETS[loc]||{})[cls];
  if(!supported&&!((cfg[loc]||{})[cls]))return"";
  const cur=(cfg[loc]||{})[cls]||supported||{min:0,max:0};
  const invalid=Number(cur.min||0)>Number(cur.max||0);
  return `<div class="cclass-cap-row sett-matrix-cell ${invalid?"invalid":""}" data-matrix="classmix" data-loc="${rvEscapeAttr(loc)}" data-key="${rvEscapeAttr(cls)}">
    <span class="cclass-cap-loc">${rvEscapeHtml(LOC_SHORT[loc]||loc)}</span>
    <label class="cmix-field"><span>Min / week</span><input type="number" min="0" max="40" data-loc="${rvEscapeAttr(loc)}" data-cls="${rvEscapeAttr(cls)}" data-field="min" value="${Number(cur.min||0)}" class="classmix-inp" oninput="settClassMixChanged()"></label>
    <label class="cmix-field"><span>Max / week</span><input type="number" min="0" max="40" data-loc="${rvEscapeAttr(loc)}" data-cls="${rvEscapeAttr(cls)}" data-field="max" value="${Number(cur.max||0)}" class="classmix-inp" oninput="settClassMixChanged()"></label>
    <span class="cclass-cap-warn">Min &gt; Max</span>
  </div>`;
}

function settClassPreferredTrainersHtml(cls){
  const key=classQualKey(cls);
  const trainers=[...(_settTrainerProfiles||[])].sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  if(!trainers.length)return `<div class="cclass-empty">No trainers loaded.</div>`;
  return `<div class="cclass-trainer-chips">${trainers.map(t=>{
    const on=!!(t.qualifications||{})[key];
    return `<button type="button" class="cclass-trainer-chip${on?" on":""}" data-trainer="${rvEscapeAttr(t.name||"")}" data-key="${key}" onclick="settClassPrefTrainerToggle(this)">${rvEscapeHtml(t.name||"")}</button>`;
  }).join("")}</div>`;
}

function settClassPrefTrainerToggle(btn){
  const trainer=btn.dataset.trainer, key=btn.dataset.key;
  const profile=(_settTrainerProfiles||[]).find(t=>t.name===trainer);
  if(!profile)return;
  if(!profile.qualifications)profile.qualifications={};
  const next=!profile.qualifications[key];
  profile.qualifications[key]=next;
  btn.classList.toggle("on",next);
  // keep every card showing this class format in sync (a trainer can appear once per class card only, but qual-table shares state)
}

function settClassTimeRulesHtml(cls){
  const rules=(_settSchedConfig?.custom_rules||[]).map((r,i)=>({r,i})).filter(({r})=>r.rule_type==="class_time_restriction"&&canonicalMixClass(r.class_name)===canonicalMixClass(cls));
  const rows=rules.map(({r,i})=>`<div class="cclass-time-rule">
      <span class="cfg-badge ${r.operator==="never"?"red":"blue"}">${r.operator==="never"?"Blocked":"Locked"}</span>
      <span>${rvEscapeHtml(r.location?(LOC_SHORT[r.location]||r.location):"All studios")}</span>
      <span>${rvEscapeHtml(r.day||"Any day")}</span>
      <span style="font-weight:700">${rvEscapeHtml(r.time||"")}</span>
      <button class="cfg-row-btn danger" onclick="settRemoveClassTimeRule(${i})">Remove</button>
    </div>`).join("");
  return `<div class="cclass-time-rules">${rows||`<div class="cclass-empty">No time restrictions — class can run any time slot that fits daily targets.</div>`}</div>
    <div class="cclass-time-add">
      <select class="sett-select cclass-time-loc"><option value="">All studios</option>${LOCS_ALL.map(l=>`<option value="${rvEscapeAttr(l)}">${rvEscapeHtml(LOC_SHORT[l]||l)}</option>`).join("")}</select>
      <select class="sett-select cclass-time-day"><option value="">Any day</option>${DAYS_ALL.map(d=>`<option value="${d}">${d.slice(0,3)}</option>`).join("")}</select>
      <input type="time" class="sett-input cclass-time-time" value="08:00">
      <select class="sett-select cclass-time-op"><option value="only">Lock to this time</option><option value="never">Block this time</option></select>
      <button class="sett-mini-btn" onclick="settAddClassTimeRule('${rvEscapeAttr(cls)}',this)">+ Add</button>
    </div>`;
}

function settAddClassTimeRule(cls,btn){
  const row=btn.closest(".cclass-time-add");
  const location=row.querySelector(".cclass-time-loc").value;
  const day=row.querySelector(".cclass-time-day").value;
  const time=row.querySelector(".cclass-time-time").value;
  const operator=row.querySelector(".cclass-time-op").value;
  if(!_settSchedConfig.custom_rules)_settSchedConfig.custom_rules=[];
  _settSchedConfig.custom_rules.push({id:"class-rule-"+Date.now(),rule_type:"class_time_restriction",class_name:cls,location,day,time,operator,priority:"hard",enabled:true});
  settRenderClassMix();
  showToast("Time restriction added","success");
}

function settRemoveClassTimeRule(i){
  _settSchedConfig.custom_rules.splice(i,1);
  settRenderClassMix();
}

function settClassSettingsCardHtml(cls,cfg){
  const color=classColor(cls);
  const locs=LOCS_ALL.filter(loc=>settClassMixLocClasses(loc,cfg).includes(cls));
  return `<div class="cclass-card" style="--cmix-accent:${color}" data-cclass="${rvEscapeAttr(cls.toLowerCase())}">
    <div class="cclass-card-head" onclick="this.closest('.cclass-card').classList.toggle('open')">
      <span class="cclass-dot" style="background:${color}"></span>
      <span class="cclass-name">${rvEscapeHtml(displayClass(cls))}</span>
      <span class="cclass-loc-count">${locs.length} studio${locs.length===1?"":"s"}</span>
      <span class="cfg-chevron">▾</span>
    </div>
    <div class="cclass-card-body">
      <div class="cclass-block">
        <div class="cclass-block-title">Weekly Capacity per Studio</div>
        <div class="cclass-cap-rows">${locs.map(loc=>settClassCapacityRowHtml(loc,cls,cfg)).join("")||`<div class="cclass-empty">Not configured for any studio yet.</div>`}</div>
      </div>
      <div class="cclass-block">
        <div class="cclass-block-title">Preferred / Certified Trainers</div>
        <div class="cclass-block-desc">Toggling a trainer here updates their certification — the optimiser only assigns certified trainers to this format.</div>
        ${settClassPreferredTrainersHtml(cls)}
      </div>
      <div class="cclass-block">
        <div class="cclass-block-title">Time Restrictions</div>
        <div class="cclass-block-desc">Lock this format to a specific slot, or block it from a slot. Hard rule — always enforced.</div>
        ${settClassTimeRulesHtml(cls)}
      </div>
    </div>
  </div>`;
}

function settFilterClassSettings(q){
  _cmixSearch=q||"";
  document.querySelectorAll(".cclass-card").forEach(card=>{
    const name=card.dataset.cclass||"";
    card.style.display=(!_cmixSearch||name.includes(_cmixSearch.toLowerCase()))?"":"none";
  });
}

function settRenderClassMix(){
  const wrap=document.getElementById("classmix-wrap");
  if(!wrap)return;
  _settSchedConfig=settNormalizeConfig(_settSchedConfig||{});
  const cfg=_settSchedConfig.class_mix||{};
  const allClasses=[...new Set(LOCS_ALL.flatMap(loc=>settClassMixLocClasses(loc,cfg)))];
  const byFamily={};
  allClasses.forEach(cls=>{(byFamily[getFamily(cls)]=byFamily[getFamily(cls)]||[]).push(cls);});
  const order=["barre","powercycle","strength_lab","mat_57","recovery","foundations","hiit","default"];
  wrap.innerHTML=`
    <input type="text" class="sett-input" placeholder="Search class formats…" style="width:100%;margin-bottom:12px" oninput="settFilterClassSettings(this.value)">
    <div class="cmix-health-strip" id="cmix-health-strip"></div>
    <div class="sett-toolbar-stack">
      ${settBulkToolbarHtml("classmix","Bulk Capacity Operators")}
      ${settClassMixAdvancedBulkHtml(allClasses)}
    </div>
    ${order.filter(f=>byFamily[f]?.length).map(family=>`
      <div class="cmix-family-group">
        <div class="cmix-family-head"><span class="cmix-family-dot" style="background:${FAM_COLOR[family]||FAM_COLOR.default}"></span>${rvEscapeHtml(CMIX_FAMILY_LABELS[family]||family)}</div>
        <div class="cclass-card-list">${byFamily[family].map(cls=>settClassSettingsCardHtml(cls,cfg)).join("")}</div>
      </div>`).join("")||`<div class="cmix-health-empty">No class formats configured yet.</div>`}
    <div class="sett-save-bar"><button class="sett-save-btn" onclick="settSaveClassMix()">Save Class Settings</button></div>`;
  settRenderClassMixHealth();
  settValidateAndRender();
}

function settSaveClassMix(){
  settCollectClassMixFromDom();
  Promise.all([
    settSaveCanonicalConfig("classmix","Class settings saved"),
    schedulerFetch("/api/save-trainer-profiles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(_settTrainerProfiles||[])}).then(r=>r.json()),
  ]).catch(()=>{});
}

function settCollectClassMixFromDom(){
  const mix={};
  document.querySelectorAll(".classmix-inp").forEach(inp=>{
    const{loc,cls,field}=inp.dataset;
    if(!mix[loc])mix[loc]={};
    if(!mix[loc][cls])mix[loc][cls]={};
    mix[loc][cls][field]=parseInt(inp.value)||0;
    mix[loc][cls].source="settings";
  });
  if(!_settSchedConfig)_settSchedConfig={};
  _settSchedConfig.class_mix=mix;
  _settSchedConfig=settNormalizeConfig(_settSchedConfig);
}

function settClassMixChanged(){
  settCollectClassMixFromDom();
  document.querySelectorAll(".classmix-inp").forEach(inp=>{
    const cell=inp.closest(".sett-matrix-cell");
    if(!cell)return;
    const loc=inp.dataset.loc, cls=inp.dataset.cls;
    const cur=_settSchedConfig.class_mix?.[loc]?.[cls]||{};
    cell.classList.toggle("invalid",Number(cur.min||0)>Number(cur.max||0));
  });
  settRenderClassMixHealth();
  settValidateAndRender();
}

// Trainer score-priority is derived from tier, not manually set (Tier 1=90, Tier 2=60, Tier 3/4=30).
function settTierDerivedPriority(tier){
  const t=Number(tier||3);
  if(t===1)return 90;
  if(t===2)return 60;
  return 30;
}

function settSyncPriorityFromTiers(){
  if(!_settTrainerProfiles)return;
  if(!_settSchedConfig)_settSchedConfig={};
  const prio={};
  _settTrainerProfiles.forEach(t=>{prio[t.name]=settTierDerivedPriority(t.tier);});
  _settSchedConfig.trainer_priority=prio;
}

// ---------- Custom Rules & Manual Pins ----------
function settAllClassOptions(){
  const names=new Set();
  Object.values(CLASS_MIX_TARGETS||{}).forEach(mix=>Object.keys(mix||{}).forEach(c=>names.add(c)));
  getAllLocSlots().forEach(s=>{if(s.class_name)names.add(canonicalMixClass(s.class_name));});
  return [...names].sort((a,b)=>displayClass(a).localeCompare(displayClass(b)));
}

function settTrainerOptions(){
  return (_settTrainerProfiles||[]).map(t=>t.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));
}

const CUSTOM_RULE_TEMPLATES={
  daily_target:{
    label:"Set daily class count",
    helper:"Choose a studio and day, then set exactly, minimum, or maximum classes.",
    operators:[["exactly","Exactly"],["min","Minimum"],["max","Maximum"]],
    fields:["location","day","operator","value","priority"],
  },
  weekly_class_mix:{
    label:"Set weekly class mix",
    helper:"Choose a studio and class format, then set the weekly minimum or maximum.",
    operators:[["min","Minimum per week"],["max","Maximum per week"],["exactly","Exactly per week"]],
    fields:["location","class","operator","value","priority"],
  },
  trainer_availability:{
    label:"Limit trainer availability",
    helper:"Choose an instructor and optionally narrow by studio, day, or time.",
    operators:[["never","Never schedule"],["only","Only schedule"],["max","Maximum classes per week"]],
    fields:["location","trainer","day","time","operator","value","priority"],
  },
  class_time_restriction:{
    label:"Control class time",
    helper:"Choose a class and time. Use never to block it, or only to force that class into that time.",
    operators:[["never","Never at this time"],["only","Only at this time"],["prefer","Prefer this time"]],
    fields:["location","class","day","time","operator","priority"],
  },
  class_location_restriction:{
    label:"Control class studio",
    helper:"Choose a class and studio. Use never to block it there, or only to keep it there.",
    operators:[["never","Never at this studio"],["only","Only at this studio"],["prefer","Prefer this studio"]],
    fields:["location","class","operator","priority"],
  },
  trainer_load_limit:{
    label:"Limit instructor workload",
    helper:"Set max classes or minutes for an instructor by day, week, studio, or time window.",
    operators:[["max_classes","Max classes"],["max_minutes","Max minutes"],["min_classes","Minimum classes"],["avoid_consecutive","Avoid back-to-back"]],
    fields:["location","trainer","day","time","time_end","operator","value","condition","priority"],
  },
  room_capacity_rule:{
    label:"Control room or capacity",
    helper:"Target a room, capacity threshold, or class format so high-demand sessions land in the right space.",
    operators:[["require_room","Require room"],["avoid_room","Avoid room"],["min_capacity","Minimum capacity"],["max_capacity","Maximum capacity"]],
    fields:["location","class","room","operator","value","condition","priority"],
  },
  sequence_spacing_rule:{
    label:"Space similar classes",
    helper:"Prevent repetitive class patterns by spacing a format or instructor across nearby times.",
    operators:[["min_gap","Minimum gap"],["not_consecutive","Not consecutive"],["max_same_window","Max in time window"]],
    fields:["location","class","trainer","day","time","time_end","operator","value","condition","priority"],
  },
  time_window_rule:{
    label:"Optimize time window",
    helper:"Create advanced rules for morning, evening, or custom time windows such as 08:00-09:00.",
    operators:[["at_least","At least"],["at_most","At most"],["prefer_mix","Prefer mixed formats"],["block_window","Block window"]],
    fields:["location","class","day","time","time_end","operator","value","condition","priority"],
  },
};

function settRoomOptions(){
  return [
    ["","Auto room"],
    ["studio_a","Studio 1 / A"],
    ["studio_b","Studio 2 / B"],
    ["powercycle","PowerCycle Studio"],
    ["strength_lab","Strength Lab"],
  ];
}

// Universal Rules panel — read-only display of always-enforced constraints
const UNIV_TYPE_BADGE={
  always_do:{label:"ALWAYS",bg:"#D1FAE5",fg:"#065F46"},
  never_do:{label:"NEVER",bg:"#FEE2E2",fg:"#991B1B"},
  class_location:{label:"LOC",fg:"#B45309",bg:"#FEF3C7"},
  hard:{label:"HARD",bg:"#FEE2E2",fg:"#991B1B"},
  slot_required:{label:"SLOT",bg:"#DBEAFE",fg:"#1D4ED8"},
  trainer_availability:{label:"TRAINER",bg:"#EDE9FE",fg:"#5B21B6"},
};
function settRenderUniversalRulesPanel(){
  const host=document.getElementById("universal-rules-list");
  if(!host)return;
  // Use cached catalog if already loaded by rules view
  if(_rulesCatalog&&_rulesCatalog.groups){
    _settRenderUnivCards(host,_rulesCatalog.groups||[]);
    return;
  }
  schedulerFetch("/api/rules-config")
    .then(r=>r.ok?r.json():{})
    .then(data=>{
      let groups=[];
      if(Array.isArray(data?.groups)&&data.groups.length){
        groups=data.groups;
        if(!_rulesCatalog)_rulesCatalog=data;
      } else if(Array.isArray(data?.hard_constraints)){
        groups=[{id:"hard",label:"Hard Constraints",rules:data.hard_constraints}];
      } else {
        if(!_rulesCatalog)_rulesCatalog=JSON.parse(JSON.stringify(BUILTIN_RULES_CATALOG));
        groups=BUILTIN_RULES_CATALOG.groups;
      }
      _settRenderUnivCards(host,groups);
    })
    .catch(()=>{
      _settRenderUnivCards(host,BUILTIN_RULES_CATALOG.groups);
    });
}
function _settUnivRuleCardHtml(r){
  const b=UNIV_TYPE_BADGE[r.type]||{label:(r.type||"RULE").toUpperCase().slice(0,6),bg:"#F1F5F9",fg:"#334155"};
  const searchText=`${r.id||""} ${r.label||""} ${r.description||""} ${r.impact_area||""}`.toLowerCase();
  return `<div class="univ-rule-card${r.enabled?"":" off"}" data-univ-search="${rvEscapeAttr(searchText)}">
    <div class="univ-rule-head">
      <div class="univ-rule-tags">
        <span class="univ-rule-badge" style="background:${b.bg};color:${b.fg}">${b.label}</span>
        <span class="univ-rule-id">${rvEscapeHtml(r.id||"")}</span>
        ${r.impact_area?`<span class="sett-badge">${rvEscapeHtml(r.impact_area)}</span>`:""}
      </div>
      <label class="sett-switch univ-rule-switch"><input type="checkbox" ${r.enabled?"checked":""} onchange="settToggleUniversalRule('${r.id}',this.checked)"><span class="sett-slider round"></span></label>
    </div>
    <div class="univ-rule-title">${rvEscapeHtml(r.label||r.description||"")}</div>
    ${r.description&&r.label?`<div class="univ-rule-desc">${rvEscapeHtml(r.description)}</div>`:""}
  </div>`;
}

function _settRenderUnivCards(host,groups){
  const allRules=groups.flatMap(g=>g.rules||[]);
  if(!allRules.length){
    host.innerHTML='<div class="univ-empty">No universal rules found.</div>';
    return;
  }
  host.innerHTML=groups.filter(g=>(g.rules||[]).length).map(g=>`
    <div class="univ-rule-group">
      <div class="univ-rule-group-head">
        <div class="univ-rule-group-label">${rvEscapeHtml(g.label||g.id||"Rules")}</div>
        <span class="sett-badge">${(g.rules||[]).length}</span>
      </div>
      ${g.description?`<div class="univ-rule-group-desc">${rvEscapeHtml(g.description)}</div>`:""}
      <div class="univ-rule-grid">${(g.rules||[]).map(_settUnivRuleCardHtml).join("")}</div>
    </div>`).join("");
}

function settFilterUnivRules(q){
  const needle=(q||"").trim().toLowerCase();
  document.querySelectorAll(".univ-rule-card").forEach(card=>{
    const hit=!needle||(card.dataset.univSearch||"").includes(needle);
    card.style.display=hit?"":"none";
  });
  document.querySelectorAll(".univ-rule-group").forEach(group=>{
    const anyVisible=[...group.querySelectorAll(".univ-rule-card")].some(c=>c.style.display!=="none");
    group.style.display=anyVisible?"":"none";
  });
}

function settToggleUniversalRule(ruleId,enabled){
  schedulerFetch("/api/update-rules-config",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({rules:{[ruleId]:{enabled}}})
  }).then(r=>r.json()).then(res=>{
    if(res.ok)showToast(`Rule ${ruleId} ${enabled?"enabled":"disabled"}`,"");
    else showToast("Failed to update rule","error");
    _rulesCatalog=null;
    settRenderUniversalRulesPanel();
  }).catch(()=>showToast("Network error","error"));
}

function settRenderCustomRules(){
  settRenderCustomRuleList();
  settRenderCustomRuleBuilder();
  settRenderManualPinList();
  settRenderManualPinBuilder();
}

function settRenderCustomRuleList(){
  const wrap=document.getElementById("customrules-list");
  if(!wrap)return;
  const rules=(_settSchedConfig?.custom_rules)||[];
  if(!rules.length){
    wrap.innerHTML=`<div class="rule-card"><div><div class="rule-title">No custom rules created.</div><div class="rule-meta"><span class="sett-badge">Empty</span></div></div></div>`;
    return;
  }
  wrap.innerHTML=`<div class="rule-list-grid">${rules.map((r,i)=>`<div class="rule-card">
    <div style="flex:1;min-width:0">
      <div class="rule-title">${rvEscapeHtml(settRuleSummary(r))}</div>
      <div class="rule-meta"><span class="sett-badge ${r.priority==="hard"?"red":"blue"}">${rvEscapeHtml(r.priority||"soft")}</span><span class="sett-badge">${rvEscapeHtml(r.location||"All studios")}</span><span class="sett-badge">${rvEscapeHtml(r.rule_type||"rule")}</span></div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="sett-mini-btn" onclick="settEditCustomRule(${i})">Edit</button>
      <button class="sett-mini-btn danger" onclick="settRemoveCustomRule(${i})">Remove</button>
    </div>
  </div>`).join("")}</div>`;
}

function settRuleSummary(r){
  const subject=r.class_name||r.trainer||"schedule";
  if(r.rule_type==="daily_target")return `${r.day||"Any day"} ${r.operator||"exactly"} ${r.value||0} classes`;
  if(r.rule_type==="weekly_class_mix")return `${subject} ${r.operator||"max"} ${r.value||0} per week`;
  if(r.rule_type==="trainer_availability")return `${r.trainer||"Trainer"} ${r.operator||"only"} ${r.day||"selected day"} ${r.time||""}`;
  if(r.rule_type==="class_time_restriction")return `${subject} ${r.operator||"never"} at ${r.time||"selected time"}`;
  if(r.rule_type==="class_location_restriction")return `${subject} ${r.operator||"only"} at ${r.location||"selected studio"}`;
  return `${subject} ${r.operator||"rule"} ${r.value||""}`.trim();
}

function settRenderCustomRuleBuilder(){
  const wrap=document.getElementById("customrules-builder");
  if(!wrap)return;
  const classes=settAllClassOptions();
  const trainers=settTrainerOptions();
  const editing=_editingCustomRuleIdx!==null;
  wrap.innerHTML=`<div class="rule-builder-card" style="padding:0;overflow:hidden">
    <div class="rule-builder-layout">
      <aside class="rule-builder-aside">
        <div class="cr-aside-kicker">Guided Rule Builder</div>
        <div class="cr-aside-title">Build complex scheduling logic without writing code.</div>
        <div id="cr-helper" class="cr-aside-helper"></div>
        <div id="cr-preview" class="cr-aside-preview">Rule preview</div>
      </aside>
      <main class="rule-builder-main">
        <div class="cr-field-group">
          <div class="cr-group-label">What &amp; Where</div>
          <div class="form-grid-even">
            <div data-cr-field="type"><label class="cr-field-lbl">Rule goal</label><select class="sett-select" id="cr-type" onchange="settUpdateCustomRuleBuilder()">
              ${Object.entries(CUSTOM_RULE_TEMPLATES).map(([id,t])=>`<option value="${id}">${rvEscapeHtml(t.label)}</option>`).join("")}
            </select></div>
            <div data-cr-field="location"><label class="cr-field-lbl">Studio</label><select class="sett-select" id="cr-location" onchange="settUpdateCustomRuleBuilder()"><option value="">All Studios</option>${LOCS_ALL.map(l=>`<option value="${rvEscapeAttr(l)}">${rvEscapeHtml(l)}</option>`).join("")}</select></div>
            <div data-cr-field="class"><label class="cr-field-lbl">Class</label><select class="sett-select" id="cr-class" onchange="settUpdateCustomRuleBuilder()"><option value="">Choose Class</option>${classes.map(c=>`<option value="${rvEscapeAttr(c)}">${rvEscapeHtml(displayClass(c))}</option>`).join("")}</select></div>
            <div data-cr-field="trainer"><label class="cr-field-lbl">Instructor</label><select class="sett-select" id="cr-trainer" onchange="settUpdateCustomRuleBuilder()"><option value="">Choose Instructor</option>${trainers.map(t=>`<option value="${rvEscapeAttr(t)}">${rvEscapeHtml(t)}</option>`).join("")}</select></div>
            <div data-cr-field="room"><label class="cr-field-lbl">Room</label><select class="sett-select" id="cr-room" onchange="settUpdateCustomRuleBuilder()">${settRoomOptions().map(([v,l])=>`<option value="${rvEscapeAttr(v)}">${rvEscapeHtml(l)}</option>`).join("")}</select></div>
          </div>
        </div>
        <div class="cr-field-group">
          <div class="cr-group-label">When</div>
          <div class="form-grid-even">
            <div data-cr-field="day"><label class="cr-field-lbl">Day</label><select class="sett-select" id="cr-day" onchange="settUpdateCustomRuleBuilder()"><option value="">Any Day</option>${DAYS_ALL.map(d=>`<option value="${d}">${d}</option>`).join("")}</select></div>
            <div data-cr-field="time"><label class="cr-field-lbl">Start Time</label><input class="sett-input" id="cr-time" type="time" onchange="settUpdateCustomRuleBuilder()"></div>
            <div data-cr-field="time_end"><label class="cr-field-lbl">End Time</label><input class="sett-input" id="cr-time-end" type="time" onchange="settUpdateCustomRuleBuilder()"></div>
          </div>
        </div>
        <div class="cr-field-group">
          <div class="cr-group-label">Rule Logic</div>
          <div class="form-grid-even">
            <div data-cr-field="operator"><label class="cr-field-lbl">Operator</label><select class="sett-select" id="cr-operator" onchange="settUpdateCustomRuleBuilder()"></select></div>
            <div data-cr-field="value"><label class="cr-field-lbl">Number</label><input class="sett-input" id="cr-value" type="number" min="0" max="40" value="1" oninput="settUpdateCustomRuleBuilder()"></div>
            <div data-cr-field="condition"><label class="cr-field-lbl">When</label><select class="sett-select" id="cr-condition" onchange="settUpdateCustomRuleBuilder()"><option value="">Always</option><option value="prime_time">Prime time only</option><option value="low_fill">If fill risk is low</option><option value="high_demand">If demand is high</option><option value="same_day">Within same day</option></select></div>
            <div data-cr-field="priority"><label class="cr-field-lbl">Strength</label><select class="sett-select" id="cr-priority" onchange="settUpdateCustomRuleBuilder()"><option value="hard">Hard block</option><option value="soft">Soft guidance</option></select></div>
          </div>
        </div>
        <div class="cr-actions">
          <button class="sett-save-btn" onclick="settAddCustomRule()">${editing?"Update Rule":"Add Rule"}</button>
          ${editing?`<button class="sett-ghost-btn" type="button" onclick="settCancelCustomRuleEdit()">Cancel</button>`:""}
        </div>
      </main>
    </div>
  </div>`;
  settUpdateCustomRuleBuilder();
  if(editing)settLoadCustomRuleToForm(_settSchedConfig?.custom_rules?.[_editingCustomRuleIdx]);
}

function settVisibleCustomRuleFields(type){
  return new Set(["type",...(CUSTOM_RULE_TEMPLATES[type]?.fields||[])]);
}

function settCustomRuleFormValue(id){
  return document.getElementById(id)?.value||"";
}

function settBuildCustomRuleFromForm(){
  const type=settCustomRuleFormValue("cr-type")||"daily_target";
  const rule={
    id:"custom-rule-"+Date.now(),
    rule_type:type,
    location:settCustomRuleFormValue("cr-location"),
    class_name:settCustomRuleFormValue("cr-class"),
    trainer:settCustomRuleFormValue("cr-trainer"),
    day:settCustomRuleFormValue("cr-day"),
    time:settCustomRuleFormValue("cr-time"),
    time_end:settCustomRuleFormValue("cr-time-end"),
    room:settCustomRuleFormValue("cr-room"),
    operator:settCustomRuleFormValue("cr-operator")||"exactly",
    value:Number(settCustomRuleFormValue("cr-value")||0),
    condition:settCustomRuleFormValue("cr-condition"),
    priority:settCustomRuleFormValue("cr-priority")||"hard",
    enabled:true,
  };
  return rule;
}

function settCustomRuleValidation(rule){
  const missing=[];
  if(["daily_target","weekly_class_mix","class_location_restriction"].includes(rule.rule_type)&&!rule.location)missing.push("studio");
  if(["daily_target"].includes(rule.rule_type)&&!rule.day)missing.push("day");
  if(["weekly_class_mix","class_time_restriction","class_location_restriction"].includes(rule.rule_type)&&!rule.class_name)missing.push("class");
  if(rule.rule_type==="trainer_availability"&&!rule.trainer)missing.push("instructor");
  if(rule.rule_type==="trainer_load_limit"&&!rule.trainer)missing.push("instructor");
  if(rule.rule_type==="room_capacity_rule"&&!rule.room&&["require_room","avoid_room"].includes(rule.operator))missing.push("room");
  if(["sequence_spacing_rule","time_window_rule"].includes(rule.rule_type)&&!rule.time)missing.push("start time");
  if(["sequence_spacing_rule","time_window_rule","trainer_load_limit"].includes(rule.rule_type)&&rule.time&&!rule.time_end)missing.push("end time");
  if(rule.rule_type==="class_time_restriction"&&!rule.time)missing.push("time");
  if(["daily_target","weekly_class_mix","trainer_load_limit","room_capacity_rule","sequence_spacing_rule","time_window_rule"].includes(rule.rule_type)&&!(rule.value>=0))missing.push("number");
  return missing;
}

function settUpdateCustomRuleBuilder(){
  const type=settCustomRuleFormValue("cr-type")||"daily_target";
  const tmpl=CUSTOM_RULE_TEMPLATES[type]||CUSTOM_RULE_TEMPLATES.daily_target;
  const visible=settVisibleCustomRuleFields(type);
  document.querySelectorAll("[data-cr-field]").forEach(el=>{
    el.style.display=visible.has(el.dataset.crField)?"":"none";
  });
  const op=document.getElementById("cr-operator");
  if(op){
    const current=op.value;
    op.innerHTML=(tmpl.operators||[]).map(([value,label])=>`<option value="${value}">${rvEscapeHtml(label)}</option>`).join("");
    if((tmpl.operators||[]).some(([value])=>value===current))op.value=current;
  }
  const helper=document.getElementById("cr-helper");
  if(helper)helper.textContent=tmpl.helper||"";
  const preview=document.getElementById("cr-preview");
  if(preview){
    const rule=settBuildCustomRuleFromForm();
    const missing=settCustomRuleValidation(rule);
    preview.textContent=missing.length?`Rule preview: choose ${missing.join(", ")}`:`Rule preview: ${settRuleSummary(rule)}`;
  }
}

function settAddCustomRule(){
  const rule=settBuildCustomRuleFromForm();
  const missing=settCustomRuleValidation(rule);
  if(missing.length){showToast(`Choose ${missing.join(", ")} before adding this rule`,"error");return;}
  if(!_settSchedConfig)_settSchedConfig={};
  if(!_settSchedConfig.custom_rules)_settSchedConfig.custom_rules=[];
  if(_editingCustomRuleIdx!==null)_settSchedConfig.custom_rules[_editingCustomRuleIdx]={..._settSchedConfig.custom_rules[_editingCustomRuleIdx],...rule};
  else _settSchedConfig.custom_rules.push(rule);
  _editingCustomRuleIdx=null;
  settRenderCustomRules();
  showToast("Custom rule saved — save to persist","");
}

function settRemoveCustomRule(idx){
  if(!_settSchedConfig?.custom_rules)return;
  _settSchedConfig.custom_rules.splice(idx,1);
  if(_editingCustomRuleIdx===idx)_editingCustomRuleIdx=null;
  settRenderCustomRules();
}

function settLoadCustomRuleToForm(rule){
  if(!rule)return;
  const map={
    "cr-type":rule.rule_type||"daily_target",
    "cr-location":rule.location||"",
    "cr-class":rule.class_name||"",
    "cr-trainer":rule.trainer||"",
    "cr-day":rule.day||"",
    "cr-time":rule.time||"",
    "cr-time-end":rule.time_end||"",
    "cr-room":rule.room||"",
    "cr-operator":rule.operator||"exactly",
    "cr-value":rule.value ?? 1,
    "cr-condition":rule.condition||"",
    "cr-priority":rule.priority||"hard",
  };
  const typeEl=document.getElementById("cr-type");
  if(typeEl)typeEl.value=map["cr-type"];
  settUpdateCustomRuleBuilder();
  Object.entries(map).forEach(([id,val])=>{
    const el=document.getElementById(id);
    if(el)el.value=val;
  });
  settUpdateCustomRuleBuilder();
}

function settEditCustomRule(idx){
  _editingCustomRuleIdx=idx;
  settRenderCustomRules();
}

function settCancelCustomRuleEdit(){
  _editingCustomRuleIdx=null;
  settRenderCustomRules();
}

function settRenderManualPinList(){
  const wrap=document.getElementById("manualpins-list");
  if(!wrap)return;
  const pins=(_settSchedConfig?.manual_protected)||[];
  if(!pins.length){
    wrap.innerHTML=`<div class="pin-card"><div><div class="pin-title">No manual pinned classes created.</div><div class="pin-meta"><span class="sett-badge">Empty</span></div></div></div>`;
    return;
  }
  wrap.innerHTML=`<div class="rule-list-grid">${pins.map((p,i)=>{
    const pinned=p.enabled!==false;
    return `<div class="pin-card${pinned?"":" off"}">
    <label class="sett-switch pin-toggle" title="${pinned?"Pinned — click to unpin":"Unpinned — click to pin"}">
      <input type="checkbox" ${pinned?"checked":""} onchange="settToggleManualPin(${i},this.checked)">
      <span class="sett-slider round"></span>
    </label>
    <div style="flex:1;min-width:0">
      <div class="pin-title">${rvEscapeHtml(p.day||p.day_of_week||"")} ${rvEscapeHtml(p.time||"")} · ${rvEscapeHtml(displayClass(p.class||p.class_name||""))}</div>
      <div class="pin-meta"><span class="sett-badge blue">${rvEscapeHtml(p.location||"Studio")}</span><span class="sett-badge green">${rvEscapeHtml(p.trainer||p.trainer_1||"Trainer")}</span>${p.room?`<span class="sett-badge">${rvEscapeHtml(p.room)}</span>`:""}${!pinned?`<span class="sett-badge">Unpinned</span>`:""}</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="sett-mini-btn" onclick="settEditManualPin(${i})">Edit</button>
      <button class="sett-mini-btn danger" onclick="settRemoveManualPin(${i})">Remove</button>
    </div>
  </div>`;
  }).join("")}</div>`;
}

function settToggleManualPin(idx,pinned){
  const pins=(_settSchedConfig?.manual_protected)||[];
  if(!pins[idx])return;
  pins[idx].enabled=pinned;
  settRenderManualPinList();
  settSaveCanonicalConfig("pins",pinned?"Class pinned":"Class unpinned");
}

function settRenderManualPinBuilder(){
  const wrap=document.getElementById("manualpins-builder");
  if(!wrap)return;
  const classes=settAllClassOptions();
  const trainers=settTrainerOptions();
  const editing=_editingManualPinIdx!==null;
  wrap.innerHTML=`<div class="pin-builder-card">
    <div class="cr-group-label">Pin a Class</div>
    <div class="form-grid-even">
    <div><label class="cr-field-lbl">Studio</label><select class="sett-select" id="pin-location">${LOCS_ALL.map(l=>`<option value="${rvEscapeAttr(l)}">${rvEscapeHtml(l)}</option>`).join("")}</select></div>
    <div><label class="cr-field-lbl">Day</label><select class="sett-select" id="pin-day">${DAYS_ALL.map(d=>`<option value="${d}">${d}</option>`).join("")}</select></div>
    <div><label class="cr-field-lbl">Time</label><input class="sett-input" id="pin-time" type="time" value="09:00"></div>
    <div><label class="cr-field-lbl">Class</label><select class="sett-select" id="pin-class">${classes.map(c=>`<option value="${rvEscapeAttr(c)}">${rvEscapeHtml(displayClass(c))}</option>`).join("")}</select></div>
    <div><label class="cr-field-lbl">Instructor</label><select class="sett-select" id="pin-trainer">${trainers.map(t=>`<option value="${rvEscapeAttr(t)}">${rvEscapeHtml(t)}</option>`).join("")}</select></div>
    <div><label class="cr-field-lbl">Room</label><select class="sett-select" id="pin-room">${settRoomOptions().map(([v,l])=>`<option value="${rvEscapeAttr(v)}">${rvEscapeHtml(l)}</option>`).join("")}</select></div>
    <div><label class="cr-field-lbl">Note</label><input class="sett-input" id="pin-note" placeholder="Optional"></div>
    </div>
    <div class="cr-actions">
      <button class="sett-save-btn" onclick="settAddManualPin()">${editing?"Update Pin":"Pin Class"}</button>
      ${editing?`<button class="sett-ghost-btn" type="button" onclick="settCancelManualPinEdit()">Cancel</button>`:""}
    </div>
  </div>`;
  if(editing)settLoadManualPinToForm(_settSchedConfig?.manual_protected?.[_editingManualPinIdx]);
}

function settAddManualPin(){
  const pin={
    id:"manual-pin-"+Date.now(),
    location:document.getElementById("pin-location")?.value||"",
    day:document.getElementById("pin-day")?.value||"",
    time:document.getElementById("pin-time")?.value||"",
    class:document.getElementById("pin-class")?.value||"",
    trainer:document.getElementById("pin-trainer")?.value||"",
    room:document.getElementById("pin-room")?.value||"",
    note:document.getElementById("pin-note")?.value||"",
  };
  if(!pin.location||!pin.day||!pin.time||!pin.class||!pin.trainer){showToast("Choose studio, day, time, class, and instructor","error");return;}
  if(!_settSchedConfig)_settSchedConfig={};
  if(!_settSchedConfig.manual_protected)_settSchedConfig.manual_protected=[];
  if(_editingManualPinIdx!==null)_settSchedConfig.manual_protected[_editingManualPinIdx]={..._settSchedConfig.manual_protected[_editingManualPinIdx],...pin};
  else _settSchedConfig.manual_protected.push(pin);
  _editingManualPinIdx=null;
  settRenderCustomRules();
  showToast("Pinned class saved — save to persist","");
}

function settRemoveManualPin(idx){
  if(!_settSchedConfig?.manual_protected)return;
  _settSchedConfig.manual_protected.splice(idx,1);
  if(_editingManualPinIdx===idx)_editingManualPinIdx=null;
  settRenderCustomRules();
}

function settLoadManualPinToForm(pin){
  if(!pin)return;
  const map={
    "pin-location":pin.location||"",
    "pin-day":pin.day||pin.day_of_week||"",
    "pin-time":pin.time||"",
    "pin-class":pin.class||pin.class_name||"",
    "pin-trainer":pin.trainer||pin.trainer_1||"",
    "pin-room":pin.room||"",
    "pin-note":pin.note||"",
  };
  Object.entries(map).forEach(([id,val])=>{
    const el=document.getElementById(id);
    if(el)el.value=val;
  });
}

function settEditManualPin(idx){
  _editingManualPinIdx=idx;
  settRenderCustomRules();
}

function settCancelManualPinEdit(){
  _editingManualPinIdx=null;
  settRenderCustomRules();
}

function settSaveCustomRules(){
  if(!_settSchedConfig)_settSchedConfig={};
  _settSchedConfig.custom_rules=_settSchedConfig.custom_rules||[];
  _settSchedConfig.manual_protected=_settSchedConfig.manual_protected||[];
  settSaveCanonicalConfig("customrules","Custom rules and pinned classes saved");
}

// ── AI Chat ─────────────────────────────────────────────────────────────────
let _chatOpen=false;
let _chatHistory=[];
let _chatWaiting=false;
let _chatMode="Ask";

function chatToggle(){
  chatSetOpen(!_chatOpen);
}

function chatEmptyStateHtml(){
  return `<div class="chat-empty"><strong>Ask with dashboard context.</strong>The assistant sees the active studio, iteration, filters, schedule rows, scorecard, and trainer constraints. Use it for trainer swaps, low-fill fixes, class mix gaps, and peak slot opportunities.</div>`;
}

function chatStartFresh(){
  _chatHistory=[];
  _chatWaiting=false;
  chatRemoveTyping();
  const messages=document.getElementById("chat-msgs");
  if(messages)messages.innerHTML=chatEmptyStateHtml();
  const suggestions=document.getElementById("chat-suggestions");
  if(suggestions)suggestions.style.display="";
  const input=document.getElementById("chat-input");
  if(input){
    input.value="";
    input.focus();
  }
  chatSetMode("Ask");
}

function chatSetOpen(open){
  _chatOpen=!!open;
  const drawer=document.getElementById("chat-drawer");
  const badge=document.getElementById("chat-fab-badge");
  if(drawer){
    drawer.classList.toggle("open",_chatOpen);
    drawer.style.display=_chatOpen?"flex":"";
  }
  if(badge)badge.classList.remove("show");
  if(_chatOpen){
    const input=document.getElementById("chat-input");
    if(input)setTimeout(()=>input.focus(),220);
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  const closeBtn=document.querySelector(".chat-close");
  if(closeBtn)closeBtn.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();chatSetOpen(false);});
});

document.addEventListener("pointerdown",e=>{
  if(!_chatOpen)return;
  const drawer=document.getElementById("chat-drawer");
  const fab=document.getElementById("chat-fab");
  if((drawer&&drawer.contains(e.target))||(fab&&fab.contains(e.target)))return;
  chatSetOpen(false);
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&_chatOpen){
    chatSetOpen(false);
    e.stopPropagation();
  }
});

function chatSetMode(mode){
  _chatMode=mode||"Ask";
  document.querySelectorAll(".chat-mode-tab").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.chatMode===_chatMode);
  });
  const input=document.getElementById("chat-input");
  if(input){
    const placeholders={
      Ask:"Ask anything or about schedule, trainers, classes...",
      Analyze:"Ask for evidence-backed schedule analysis...",
      "Optimize Ideas":"Ask for validated optimization ideas...",
      Substitution:"Ask for a safe trainer replacement..."
    };
    input.placeholder=placeholders[_chatMode]||placeholders.Ask;
  }
  const strip=document.getElementById("chat-context-label");
  if(strip)strip.textContent=`${_chatMode} · ${_loc||"All studios"} · ${_iter||"Main"}`;
}

function chatDashboardContext(){
  return {
    mode:_chatMode,
    location:_loc||"",
    iteration:_iter||"Main",
    view:_view||"grid",
    conflicts:_settLastValidation||{errors:[],warnings:[],info:[]},
    filters:{
      days:[..._activeDays],
      bands:[..._activeBands],
      recommendations:[..._activeRecs],
      class:_classFilter||"",
      trainer:_trainerFilter||"",
      room:_roomFilter||"",
      min_score:_minScore||0,
      violations_only:Boolean(_violOnly),
      experimental_only:Boolean(_expOnly)
    }
  };
}

function chatSend(text){
  const input=document.getElementById("chat-input");
  const msg=(text||"").trim()||(input?.value||"").trim();
  if(!msg||_chatWaiting)return;
  if(input)input.value="";
  // NL schedule edit detection
  if(typeof nlEditDetect==="function"&&nlEditDetect(msg)){
    _chatHistory.push({role:"user",content:msg});
    chatAppendMsg("user",msg);
    const sugg=document.getElementById("chat-suggestions");
    if(sugg)sugg.style.display="none";
    chatAppendMsg("bot","🔍 Detected a schedule edit request — opening edit planner…");
    nlEditOpen(msg);
    return;
  }
  _chatHistory.push({role:"user",content:msg});
  chatAppendMsg("user",msg);
  chatShowTyping();
  const sugg=document.getElementById("chat-suggestions");
  if(sugg)sugg.style.display="none";
  _chatWaiting=true;
  schedulerFetch("/api/chat",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:msg,history:_chatHistory.slice(-8),dashboard_context:chatDashboardContext()})
  }).then(r=>r.json()).then(d=>{
    chatRemoveTyping();
    _chatWaiting=false;
    const reply=d.reply||d.error||"No response.";
    _chatHistory.push({role:"assistant",content:reply});
    chatAppendMsg("bot",reply);
    if(d.applied){
      if(typeof nlEditReloadSchedule==="function") nlEditReloadSchedule();
      if(typeof showToast==="function") showToast("Schedule updated from AI Assistant", "success");
    }
  }).catch(e=>{
    chatRemoveTyping();
    _chatWaiting=false;
    chatAppendMsg("bot","Connection error. Make sure the server is running.");
  });
}



function chatAppendMsg(role,text){
  const msgs=document.getElementById("chat-msgs");
  if(!msgs)return;
  const empty=msgs.querySelector(".chat-empty");
  if(empty)empty.remove();
  const now=new Date();
  const time=`${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`;
  const div=document.createElement("div");
  div.className=`chat-msg ${role}`;
  let rendered;
  if(role==="bot"){
    rendered=rvEscapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
      .replace(/\n•\s/g,"<br>&bull;&nbsp;")
      .replace(/\n•/g,"<br>&bull;")
      .replace(/\n/g,"<br>");
  }else{
    rendered=rvEscapeHtml(text);
  }
  div.innerHTML=`<div class="chat-bubble">${rendered}</div><div class="chat-msg-time">${time}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
}

function chatAppendHtml(role,html){
  const msgs=document.getElementById("chat-msgs");
  if(!msgs)return null;
  const empty=msgs.querySelector(".chat-empty");
  if(empty)empty.remove();
  const now=new Date();
  const time=`${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`;
  const div=document.createElement("div");
  div.className=`chat-msg ${role}`;
  div.innerHTML=`<div class="chat-bubble">${html}</div><div class="chat-msg-time">${time}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
  return div;
}

function chatShowTyping(){
  const msgs=document.getElementById("chat-msgs");
  if(!msgs)return;
  const div=document.createElement("div");
  div.className="chat-msg bot chat-typing";
  div.id="chat-typing-indicator";
  div.innerHTML=`<div class="chat-bubble">Thinking…</div>`;
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
}

function chatRemoveTyping(){
  const el=document.getElementById("chat-typing-indicator");
  if(el)el.remove();
}

let _drillTrainerOnly=false;
function drillToggleTrainer(s){
  _drillTrainerOnly=!_drillTrainerOnly;
  const btn=document.getElementById("drill-trainer-toggle");
  if(btn){
    btn.textContent=_drillTrainerOnly?`${s.trainer_1||"Trainer"} only`:"All data";
    btn.style.background=_drillTrainerOnly?"var(--primary-mid)":"var(--surface2)";
    btn.style.color=_drillTrainerOnly?"var(--primary)":"var(--text-2)";
    btn.style.borderColor=_drillTrainerOnly?"var(--primary-mid)":"var(--border)";
  }
  const kpiGrid=document.querySelector(".drill-kpi-grid");
  if(!kpiGrid)return;
  // Re-compute metrics filtered to this trainer
  const trainerName=(s.trainer_1||"").toLowerCase().trim();
  const allRows=drillSessionRows(s);
  const rows=_drillTrainerOnly?allRows.filter(r=>(r.trainer||"").toLowerCase().trim()===trainerName):allRows;
  const sessions=rows.length||0;
  const checked=rows.reduce((a,r)=>a+Number(r.checked_in||0),0);
  const cap=rows.reduce((a,r)=>a+Number(r.capacity||0),0);
  const revenue=rows.reduce((a,r)=>a+Number(r.revenue||0),0);
  const cancels=rows.reduce((a,r)=>a+Number(r.late_cancelled||0),0);
  const booked=rows.reduce((a,r)=>a+Number(r.booked||0),0);
  const nonEmpty=rows.filter(r=>Number(r.checked_in||0)>0).length;
  const avgAttend=sessions?checked/sessions:0;
  const fill=cap?checked/cap:0;
  const cancelRate=booked?cancels/booked:0;
  const revSeat=checked?revenue/checked:0;
  const label=_drillTrainerOnly?`${s.trainer_1} only`:"All trainers";
  kpiGrid.innerHTML=[
    {label:"Sessions",value:sessions},
    {label:"Non-Empty",value:nonEmpty,show:nonEmpty>0},
    {label:"Checked In",value:checked},
    {label:"Avg Attend",value:n1(avgAttend)},
    {label:"Fill Rate",value:pct(fill,1)},
    {label:"Cancel Rate",value:pct(cancelRate,1),show:cancelRate>0},
    {label:"Revenue",value:inr(revenue,0),show:revenue>0},
    {label:"Rev / Seat",value:inr(revSeat,0),show:revSeat>0},
  ].filter(k=>k.always||k.show!==false).map(k=>`<div class="drill-kpi"><span>${k.label}</span><strong>${k.value}</strong><small style="color:#94A3B8">${label}</small></div>`).join("");
}

// ═══════════════════════════════════════════════════════════════
// NATURAL LANGUAGE SCHEDULE EDITOR
// ═══════════════════════════════════════════════════════════════

const NL_EDIT_KEYWORDS = /\b(move|swap|shift|replace|reassign|change|add|populate|remove|delete|cancel|reschedule|put|assign|drop|take off|give|book|schedule|unschedule|rename|swap out|rotate|insert)\b/i;
const NL_TRAINER_WORDS = /\b(trainer|instructor|coach)\b/i;
const NL_SCHEDULE_WORDS = /\b(class|session|slot|block|morning|evening|midday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|week|day)\b/i;

let _nleResult = null;
let _nleInlineBody = null;
let _nleInlineFooter = null;

function nleEl(id){
  const inline=document.getElementById("nle-inline-panel");
  if(inline){
    const found=inline.querySelector(`#${id}`);
    if(found)return found;
  }
  return document.getElementById(id);
}

function nlEditDetect(msg) {
  if (!msg || msg.length < 12) return false;
  // Exclude purely analytical/question messages
  const lower = msg.toLowerCase();
  if (/^(why|what|how|who|where|when|show|list|tell|explain|can you|could you|is there|are there|give me|what's|what is|which)/.test(lower)) return false;
  if (lower.includes("?") && msg.length < 80) return false; // short questions go to chat
  const hasVerb = NL_EDIT_KEYWORDS.test(msg);
  const hasContext = NL_SCHEDULE_WORDS.test(msg) || NL_TRAINER_WORDS.test(msg);
  // Require both a clear action verb AND scheduling context
  return hasVerb && hasContext;
}

function nlEditOpen(instruction) {
  _nleResult = null;
  const node=chatAppendHtml("bot",`<div class="nle-inline" id="nle-inline-panel">
    <div class="nle-hdr" style="padding:0 0 10px;border:0">
      <div class="nle-hdr-main">
        <div class="nle-hdr-title" id="nle-title-inline">Analyzing your instruction…</div>
        <div class="nle-hdr-sub" id="nle-sub-inline">"${rvEscapeHtml(instruction.length > 80 ? instruction.slice(0,80)+"…" : instruction)}"</div>
      </div>
    </div>
    <div class="nle-body" id="nle-body-inline"><div class="nle-loading"><div class="nle-dots"><div class="nle-dot"></div><div class="nle-dot"></div><div class="nle-dot"></div></div><span>Parsing schedule edits — this takes a few seconds…</span></div></div>
    <div class="nle-footer" id="nle-footer-inline" style="display:none"><div class="nle-footer-left" id="nle-footer-left-inline"></div><div class="nle-footer-btns"><button class="nle-btn cancel" onclick="nlEditClose()">Cancel</button><button class="nle-btn apply" id="nle-apply-btn-inline" onclick="nlEditConfirm()">Apply Changes</button></div></div>
  </div>`);
  _nleInlineBody=node?.querySelector("#nle-body-inline")||null;
  _nleInlineFooter=node?.querySelector("#nle-footer-inline")||null;
  nlEditRequest(instruction);
}

function nlEditClose() {
  const overlay = document.getElementById("nle-overlay");
  if (overlay) overlay.classList.remove("open");
  const inline=document.getElementById("nle-inline-panel");
  if(inline)inline.remove();
  _nleResult = null;
  _nleInlineBody = null;
  _nleInlineFooter = null;
}

function nlEditRequest(instruction) {
  const ctx = chatDashboardContext ? chatDashboardContext() : {};
  const scheduleSnapshot = {
    locations: (typeof SCHEDULE_DATA !== "undefined" && SCHEDULE_DATA) ? (SCHEDULE_DATA.locations || {}) : {},
    generated_for_week: (typeof SCHEDULE_DATA !== "undefined" && SCHEDULE_DATA) ? (SCHEDULE_DATA.generated_for_week || "") : "",
  };
  schedulerFetch("/api/nl-edit", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      instruction,
      schedule_snapshot: scheduleSnapshot,
      context: {
        location: ctx.location || "",
        iteration: ctx.iteration || "Main",
        week: scheduleSnapshot.generated_for_week
      },
    }),
  })
  .then(r => r.json())
  .then(result => nlEditRender(result, instruction))
  .catch(err => nlEditRenderError(String(err)));
}

function nlEditRender(result, instruction) {
  const body = _nleInlineBody || document.getElementById("nle-body");
  const footer = _nleInlineFooter || document.getElementById("nle-footer");
  const footerLeft = document.getElementById("nle-footer-left-inline") || document.getElementById("nle-footer-left");
  const title = document.getElementById("nle-title-inline") || document.getElementById("nle-title");
  const sub = document.getElementById("nle-sub-inline") || document.getElementById("nle-sub");
  const applyBtn = document.getElementById("nle-apply-btn-inline") || document.getElementById("nle-apply-btn");

  if (result.error) {
    nlEditRenderError(result.error);
    return;
  }
  // Slot/day optimize — route to AI optimizer with scope
  if (result.route_to_optimizer) {
    nlEditClose();
    const scope = result.optimizer_scope || {};
    const payload = {
      iteration: (typeof _iter !== "undefined" && _iter) ? _iter : "Main",
      location: scope.location || (typeof _loc !== "undefined" ? _loc : ""),
      nl_scope: scope,
      dashboard_context: chatDashboardContext ? chatDashboardContext() : {},
    };
    setOptimizeButtonLoading && setOptimizeButtonLoading(true);
    chatAppendMsg("bot", `🔄 Routing to AI optimizer scoped to ${scope.day || scope.time_from || "active view"}…`);
    schedulerFetch("/api/optimize-schedule", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
      .then(r=>r.json())
      .then(json => {
        setOptimizeButtonLoading && setOptimizeButtonLoading(false);
        const applied=(json.applied||[]).length||json.applied_count||0;
        const rejected=(json.rejected||[]).length||json.rejected_count||0;
        chatAppendMsg("bot", `Optimizer completed: ${applied} change${applied!==1?"s":""} applied, ${rejected} skipped. ${json.summary||""}`);
        nlEditReloadSchedule();
      })
      .catch(err => { setOptimizeButtonLoading && setOptimizeButtonLoading(false); chatAppendMsg("bot","❌ Optimizer error: "+err); });
    return;
  }

  _nleResult = result;
  const edits = result.edits || [];
  const warnings = result.warnings || [];
  const checks = result.constraint_checks || [];
  const conf = parseFloat(result.confidence || 0);
  const confLabel = conf >= 0.8 ? "high" : conf >= 0.55 ? "mid" : "low";
  const confText = conf >= 0.8 ? `High confidence (${Math.round(conf*100)}%)` : conf >= 0.55 ? `Medium confidence (${Math.round(conf*100)}%)` : `Low confidence (${Math.round(conf*100)}%) — review carefully`;

  title.textContent = result.summary || "Schedule edit plan";
  sub.innerHTML = `<span class="nle-confidence ${confLabel}">${confText}</span>`;

  let html = "";

  if (edits.length === 0) {
    html = `<div style="padding:20px 0;color:#64748B;font-size:13px;text-align:center">No specific edits could be identified. Try being more specific about the class name, day, time, or trainer.</div>`;
  } else {
    html += `<div class="nle-section-label">${edits.length} edit${edits.length!==1?"s":""} planned</div><div class="nle-diff">`;
    edits.forEach((edit, editIdx) => {
      const icon = edit.action==="remove" ? "−" : edit.action==="add" ? "+" : "~";
      const loc = edit.location || "?";
      const day = edit.new_day && edit.action==="add" ? edit.new_day : (edit.day || "?");
      const time = edit.new_time && edit.action==="add" ? edit.new_time : (edit.time || "?");
      const cls = edit.new_class || edit.class_name || "?";
      const trainer = edit.new_trainer || edit.trainer_1 || "?";
      const fromStr = (edit.action==="add" && (edit.new_day||edit.new_time)) ? ` (from ${edit.day||"?"} ${edit.time||"?"})` : "";

      const trCandidates = (edit.best_fit_trainer_candidates || []);
      const clsCandidates = (edit.best_fit_class_candidates || []).slice(0, 3);
      const hasBestFit = trCandidates.length > 0 || clsCandidates.length > 0;
      const pendingConfirmation = edit.needs_confirmation === true || edit.new_trainer === "BEST_FIT" || edit.new_class === "BEST_FIT";

      let bestFitHtml = "";
      if (trCandidates.length > 0) {
        bestFitHtml += `<div class="nle-bestfit-wrap">
          <div class="nle-bestfit-label">Choose a trainer to confirm this edit — qualified options are shown even when workload cap makes them a weaker fit</div>
          <select class="nle-bestfit-select" id="nle-tr-select-${editIdx}" onchange="nlEditSelectTrainer(${editIdx}, this.value)">
            <option value="" ${pendingConfirmation ? "selected" : ""} disabled>Select a trainer…</option>
            ${trCandidates.map((c,i) => `<option value="${rvEscapeHtml(c.name)}">${rvEscapeHtml(c.name)} — ${rvEscapeHtml(c.fit_label||"Good fit")} · ${c.assigned_hours||0}h assigned · Tier ${c.tier}</option>`).join("")}
          </select>
          <div class="nle-bestfit-cards">${trCandidates.map((c,i) => `
            <div class="nle-cand-card" id="nle-tr-cand-${editIdx}-${i}" onclick="nlEditPickTrainer(${editIdx},${i})">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="trainer-mgr-avatar" style="width:34px;height:34px">${trainerImage(c.name)?`<img src="${trainerImage(c.name)}" alt="${rvEscapeAttr(c.name)}">`:trainerInitials(c.name)}</span>
                <div style="min-width:0;flex:1">
                  <div class="nle-cand-name">${rvEscapeHtml(c.name)}</div>
                  <div class="nle-cand-meta">${c.avg_fill_rate}% fill · ${c.avg_checkin} check-in · ${c.session_count} sessions · Tier ${c.tier} · ${c.assigned_hours||0}h assigned</div>
                </div>
                <span class="nle-fit-badge ${(c.fit_label||"good fit").toLowerCase().replace(/\s+/g,"-")}">${rvEscapeHtml(c.fit_label||"Good fit")}</span>
              </div>
              ${c.reason ? `<div class="nle-cand-reason">${rvEscapeHtml(c.reason)}</div>` : ""}
            </div>`).join("")}
          </div>
        </div>`;
      }
      if (clsCandidates.length > 0) {
        bestFitHtml += `<div class="nle-bestfit-wrap">
          <div class="nle-bestfit-label">${pendingConfirmation ? "⚠ Choose a class to confirm this edit" : "✨ Best-fit class"} — AI-ranked by historical performance for this slot</div>
          <select class="nle-bestfit-select" id="nle-cls-select-${editIdx}" onchange="nlEditSelectClass(${editIdx}, this.value)">
            <option value="" ${pendingConfirmation ? "selected" : ""} disabled>Select a class…</option>
            ${clsCandidates.map((c,i) => `<option value="${rvEscapeHtml(c.name)}" ${(!pendingConfirmation && edit.new_class===c.name)?"selected":""}>${rvEscapeHtml(c.name)} — ${c.avg_fill_rate}% fill · ${c.avg_checkin} avg</option>`).join("")}
          </select>
          <div class="nle-bestfit-cards">${clsCandidates.map((c,i) => `
            <div class="nle-cand-card ${(!pendingConfirmation && edit.new_class===c.name)?"selected":""}" id="nle-cls-cand-${editIdx}-${i}" onclick="nlEditPickClass(${editIdx},${i})">
              <div class="nle-cand-name">${rvEscapeHtml(c.name)}</div>
              <div class="nle-cand-meta">${c.avg_fill_rate}% fill · ${c.avg_checkin} check-in · ${c.session_count} sessions</div>
              ${c.reason ? `<div class="nle-cand-reason">${rvEscapeHtml(c.reason)}</div>` : ""}
            </div>`).join("")}
          </div>
        </div>`;
      }

      // No historic candidates were found for a requested BEST_FIT — there is
      // no picker to show, so surface a clear message instead of a silent gap
      // or a permanently-stuck confirmation state.
      const unresolvedBestFit = nlEditIsUnresolved(edit);
      if (unresolvedBestFit) {
        bestFitHtml += `<div class="nle-warning"><span>⚠</span><span>No rule-compliant candidate is available for this slot. Adjust the timing, location, class or coverage plan.</span></div>`;
      }

      html += `<div class="nle-edit-card ${edit.action}${hasBestFit?" has-bestfit":""}${pendingConfirmation?" pending-confirmation":""}">
        <div class="nle-edit-badge">${icon}</div>
        <div class="nle-edit-info">
          <div class="nle-edit-title">${rvEscapeHtml(cls)} — ${rvEscapeHtml(trainer)}</div>
          <div class="nle-edit-meta">${rvEscapeHtml(loc)} · ${rvEscapeHtml(day)} at ${rvEscapeHtml(time)}${rvEscapeHtml(fromStr)}</div>
          ${edit.reason ? `<div class="nle-edit-reason">${rvEscapeHtml(edit.reason)}</div>` : ""}
          ${bestFitHtml}
        </div>
      </div>`;
    });
    html += "</div>";
  }

  if (warnings.length) {
    html += `<div class="nle-section-label" style="margin-top:14px">Warnings</div><div class="nle-warnings">`;
    warnings.forEach(w => { html += `<div class="nle-warning"><span>⚠</span><span>${rvEscapeHtml(w)}</span></div>`; });
    html += "</div>";
  }

  if (checks.length) {
    html += `<div class="nle-section-label">Constraint checks</div><div style="display:flex;flex-direction:column;gap:5px">`;
    checks.forEach(c => { html += `<div class="nle-check"><span>✓</span><span>${rvEscapeHtml(c)}</span></div>`; });
    html += "</div>";
  }

  body.innerHTML = html;
  if (footer) footer.style.display = "flex";
  const pendingCount = edits.filter(nlEditIsPending).length;
  if (footerLeft) footerLeft.textContent = `${edits.length} change${edits.length!==1?"s":""} · ${warnings.length} warning${warnings.length!==1?"s":""}${pendingCount ? ` · ${pendingCount} awaiting your pick` : ""}`;
  nlEditUpdateApplyState();
}

// An edit is pending until the user has explicitly picked a candidate. A
// BEST_FIT request with no compliant candidates also stays blocked: sending
// that sentinel to the server can never produce a safe schedule change.
function nlEditIsPending(edit) {
  if (edit.needs_confirmation === true) return true;
  if (edit.new_trainer === "BEST_FIT") return true;
  if (edit.new_class === "BEST_FIT") return true;
  return false;
}

// An edit whose AI plan asked for BEST_FIT but no historic candidates were
// found — there's no picker to show, and it must never be silently applied
// with the literal "BEST_FIT" sentinel (the server also guards against this).
function nlEditIsUnresolved(edit) {
  const trStuck = edit.new_trainer === "BEST_FIT" && (edit.best_fit_trainer_candidates || []).length === 0;
  const clsStuck = edit.new_class === "BEST_FIT" && (edit.best_fit_class_candidates || []).length === 0;
  return trStuck || clsStuck;
}

function nlEditUpdateApplyState() {
  if (!_nleResult) return;
  const edits = _nleResult.edits || [];
  const applyBtn = document.getElementById("nle-apply-btn-inline") || document.getElementById("nle-apply-btn");
  if (applyBtn) applyBtn.disabled = edits.length === 0 || edits.some(nlEditIsPending);
}

function nlEditRenderError(msg) {
  const body = _nleInlineBody || document.getElementById("nle-body");
  const footer = _nleInlineFooter || document.getElementById("nle-footer");
  const title = document.getElementById("nle-title-inline") || document.getElementById("nle-title");
  title.textContent = "Could not parse instruction";
  body.innerHTML = `<div style="padding:14px;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;color:#991B1B;font-size:12px">${rvEscapeHtml(msg)}</div>`;
  if (footer) footer.style.display = "flex";
  const applyBtn = document.getElementById("nle-apply-btn-inline") || document.getElementById("nle-apply-btn");
  if (applyBtn) applyBtn.disabled = true;
}

// ── Best-fit candidate selection helpers ───────────────────────
function nlEditPickTrainer(editIdx, candIdx) {
  if (!_nleResult) return;
  const edit = (_nleResult.edits||[])[editIdx];
  if (!edit) return;
  const cands = edit.best_fit_trainer_candidates || [];
  const chosen = cands[candIdx];
  if (!chosen) return;
  edit.new_trainer = chosen.name;
  edit.needs_confirmation = false;
  // Update select
  const sel = document.getElementById(`nle-tr-select-${editIdx}`);
  if (sel) sel.value = chosen.name;
  // Update card highlights
  cands.forEach((_, i) => {
    const card = document.getElementById(`nle-tr-cand-${editIdx}-${i}`);
    if (card) card.classList.toggle("selected", i === candIdx);
  });
  nlEditUpdateApplyState();
}

function nlEditPickClass(editIdx, candIdx) {
  if (!_nleResult) return;
  const edit = (_nleResult.edits||[])[editIdx];
  if (!edit) return;
  const cands = edit.best_fit_class_candidates || [];
  const chosen = cands[candIdx];
  if (!chosen) return;
  edit.new_class = chosen.name;
  edit.needs_confirmation = false;
  const sel = document.getElementById(`nle-cls-select-${editIdx}`);
  if (sel) sel.value = chosen.name;
  cands.forEach((_, i) => {
    const card = document.getElementById(`nle-cls-cand-${editIdx}-${i}`);
    if (card) card.classList.toggle("selected", i === candIdx);
  });
  nlEditUpdateApplyState();
}

function nlEditSelectTrainer(editIdx, value) {
  if (!_nleResult) return;
  const edit = (_nleResult.edits||[])[editIdx];
  if (!edit) return;
  edit.new_trainer = value;
  edit.needs_confirmation = false;
  const cands = edit.best_fit_trainer_candidates || [];
  cands.forEach((c, i) => {
    const card = document.getElementById(`nle-tr-cand-${editIdx}-${i}`);
    if (card) card.classList.toggle("selected", c.name === value);
  });
  nlEditUpdateApplyState();
}

function nlEditSelectClass(editIdx, value) {
  if (!_nleResult) return;
  const edit = (_nleResult.edits||[])[editIdx];
  if (!edit) return;
  edit.new_class = value;
  edit.needs_confirmation = false;
  const cands = edit.best_fit_class_candidates || [];
  cands.forEach((c, i) => {
    const card = document.getElementById(`nle-cls-cand-${editIdx}-${i}`);
    if (card) card.classList.toggle("selected", c.name === value);
  });
  nlEditUpdateApplyState();
}

function nlEditConfirm() {
  if (!_nleResult) return;
  const edits = _nleResult.edits || [];
  if (!edits.length) { nlEditClose(); return; }

  // Bake in dropdown selections (only for edits the user has actually chosen —
  // the placeholder option has an empty value so untouched pickers are skipped)
  edits.forEach((edit, idx) => {
    const trSel = document.getElementById(`nle-tr-select-${idx}`);
    if (trSel && trSel.value) { edit.new_trainer = trSel.value; edit.needs_confirmation = false; }
    const clsSel = document.getElementById(`nle-cls-select-${idx}`);
    if (clsSel && clsSel.value) { edit.new_class = clsSel.value; edit.needs_confirmation = false; }
  });

  // Hard safety net: an edit still carrying needs_confirmation or the literal
  // "BEST_FIT" sentinel must never reach /api/nl-edit-apply — the user has to
  // explicitly pick a candidate first.
  const pending = edits.filter(nlEditIsPending);
  const readyEdits = edits.filter(e => !nlEditIsPending(e));
  if (pending.length) {
    chatAppendMsg("bot", `⚠️ Pick a candidate for ${pending.length} pending edit${pending.length!==1?"s":""} before applying.`);
    nlEditUpdateApplyState();
    if (!readyEdits.length) return;
  }

  // Disable apply button + show loading
  const applyBtn = document.getElementById("nle-apply-btn-inline") || document.getElementById("nle-apply-btn");
  const footerLeft = document.getElementById("nle-footer-left-inline") || document.getElementById("nle-footer-left");
  if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = "Applying…"; }

  const iteration = (typeof _iter !== "undefined" && _iter) ? _iter : "Main";

  schedulerFetch("/api/nl-edit-apply", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({edits: readyEdits, iteration}),
  })
  .then(r => r.json())
  .then(result => {
    nlEditClose();
    const applied = result.applied || 0;
    const errs = result.errors || [];
    const warns = result.warnings || [];
    const summary = _nleResult ? (_nleResult.summary || "edits applied") : "edits applied";
    if (applied > 0) {
      chatAppendMsg("bot", `✅ Applied ${applied} change${applied!==1?"s":""}: ${summary}${errs.length ? ` (${errs.length} skipped)` : ""}`);
    } else {
      const errMsg = errs.map(e => e.error).join("; ");
      chatAppendMsg("bot", `⚠️ Could not apply edits — ${errMsg || "slots not found in schedule. Try being more specific about location, day, time, class, and trainer."}`);
    }
    warns.forEach(w => chatAppendMsg("bot", w));
    // Reload schedule data from server so UI reflects the saved changes
    nlEditReloadSchedule();
  })
  .catch(err => {
    nlEditClose();
    chatAppendMsg("bot", `❌ Apply failed: ${err}`);
  });
}

function nlEditReloadSchedule() {
  schedulerFetch("/schedule_data.json")
    .then(r => r.json())
    .then(fresh => {
      if (typeof SCHEDULE_DATA !== "undefined" && fresh) {
        Object.assign(SCHEDULE_DATA, fresh);
        if (typeof renderView === "function") renderView();
      }
    })
    .catch(() => {
      // Fallback: just re-render with current data
      if (typeof renderView === "function") renderView();
    });
}

function nlEditApply(_edits) {
  // No-op: apply is now handled by nlEditConfirm → /api/nl-edit-apply
  return 0;
}

// ============================================================
// COMPLIANCE REPORT MODAL
// ============================================================
function openComplianceReportModal(initialLoc){
  const cr=SCHEDULE_DATA&&SCHEDULE_DATA.compliance_report;
  if(!cr||!Object.keys(cr).length){
    const box=document.getElementById("modal-box");
    box.className="modal-box";
    box.innerHTML=`<div class="modal-hdr"><div><div class="modal-class-name">Compliance Report</div><div class="modal-meta">No compliance data available — regenerate schedule</div></div><button class="modal-close" onclick="closeModal()">✕</button></div>`;
    document.getElementById("modal-overlay").classList.add("open");
    return;
  }
  const locs=Object.keys(cr);
  let activeLoc=initialLoc||(locs.includes(_loc)?_loc:locs[0]);

  function statusIcon(s){
    return s==="PASS"?"✓":s==="WARN"?"⚠":"✗";
  }
  function statusCls(s){
    return s==="PASS"?"cr-pass":s==="WARN"?"cr-warn":"cr-fail";
  }
  function catLabel(c){
    return c==="business"?"Business":c==="soft"?"Soft Target":c==="hard"?"Hard Constraint":"Score";
  }
  function catOrder(c){
    return c==="score"?0:c==="business"?1:c==="hard"?2:3;
  }
  function renderReport(loc){
    const r=cr[loc];
    if(!r)return`<div style="padding:32px;color:var(--text-muted);font-size:13px">No data for ${rvEscapeHtml(loc)}</div>`;
    const s=r.summary||{};
    const score=s.score||0;
    const tgt=s.score_target||80;
    const scoreCls=score>=tgt?"cr-pass":score>=tgt*0.9?"cr-warn":"cr-fail";
    const rules=[...(r.rules||[])].sort((a,b)=>{
      const statOrd={FAIL:0,WARN:1,PASS:2};
      const so=(statOrd[a.status]||0)-(statOrd[b.status]||0);
      if(so!==0)return so;
      return catOrder(a.category)-catOrder(b.category);
    });
    const byCategory={};
    for(const rule of rules){
      if(!byCategory[rule.category])byCategory[rule.category]=[];
      byCategory[rule.category].push(rule);
    }
    const catOrder2=["score","business","hard","soft"];
    let rulesHtml="";
    for(const cat of catOrder2){
      const catRules=byCategory[cat];
      if(!catRules||!catRules.length)continue;
      rulesHtml+=`<div class="cr-cat-label">${catLabel(cat)}</div>`;
      for(const rule of catRules){
        const sc=statusCls(rule.status);
        const si=statusIcon(rule.status);
        rulesHtml+=`<div class="cr-rule ${sc}">
          <span class="cr-rule-icon">${si}</span>
          <div class="cr-rule-body">
            <div class="cr-rule-label">${rvEscapeHtml(rule.label)}</div>
            <div class="cr-rule-vals"><span class="cr-actual">Actual: ${rvEscapeHtml(rule.actual||"—")}</span><span class="cr-sep">·</span><span class="cr-expected">Expected: ${rvEscapeHtml(rule.expected||"—")}</span></div>
            ${rule.reason&&rule.status!=="PASS"?`<div class="cr-rule-reason">${rvEscapeHtml(rule.reason)}</div>`:""}
          </div>
          <span class="cr-rule-id">${rvEscapeHtml(rule.id||"")}</span>
        </div>`;
      }
    }
    const slotScores=(r.slot_scores||[]).slice(0,200);
    const belowThreshold=slotScores.filter(s=>s.below_threshold);
    let slotHtml="";
    if(slotScores.length){
      slotHtml=`<div class="cr-section-title">Slot Score Breakdown <span style="color:var(--text-muted);font-weight:400;font-size:11px">(sorted lowest first)</span></div>
      <div class="cr-slot-list">`;
      for(const ss of slotScores){
        const sc=ss.score>=70?"cr-pass":ss.score>=50?"cr-warn":"cr-fail";
        const comps=(ss.components||[]).map(c=>`<span class="cr-comp">${rvEscapeHtml(c.label)}: <b>${c.points}</b>/${c.max_points}</span>`).join("");
        const recency=ss.recency_boost?`<span class="cr-comp">Recency: <b>${ss.recency_boost>0?"+":""}${ss.recency_boost}</b></span>`:"";
        const viols=(ss.violations||[]).length?`<div class="cr-slot-viols">${ss.violations.map(v=>`<span class="cr-viol-badge">${rvEscapeHtml(v)}</span>`).join("")}</div>`:"";
        slotHtml+=`<div class="cr-slot-row ${sc}">
          <div class="cr-slot-hdr">
            <span class="cr-slot-score ${sc}">${ss.score}</span>
            <span class="cr-slot-info">${rvEscapeHtml(ss.day||"")} ${rvEscapeHtml(ss.time||"")} · ${rvEscapeHtml(ss.class||"")} · ${rvEscapeHtml(ss.trainer||"")}</span>
          </div>
          ${comps||recency?`<div class="cr-slot-comps">${comps}${recency}</div>`:""}
          ${viols}
        </div>`;
      }
      slotHtml+="</div>";
    }
    return`<div class="cr-summary">
      <div class="cr-sum-card ${scoreCls}">
        <div class="cr-sum-val">${score}</div><div class="cr-sum-lbl">Score</div>
        <div class="cr-sum-sub">Target ${tgt}</div>
      </div>
      <div class="cr-sum-card cr-pass"><div class="cr-sum-val">${s.passed||0}</div><div class="cr-sum-lbl">Passed</div></div>
      <div class="cr-sum-card cr-warn"><div class="cr-sum-val">${s.warned||0}</div><div class="cr-sum-lbl">Warnings</div></div>
      <div class="cr-sum-card cr-fail"><div class="cr-sum-val">${s.failed||0}</div><div class="cr-sum-lbl">Failed</div></div>
    </div>
    <div class="cr-rules-list">${rulesHtml}</div>
    ${slotHtml}`;
  }

  function build(){
    const tabsHtml=locs.map(l=>`<button class="cr-loc-tab${l===activeLoc?" active":""}" onclick="crSwitchLoc('${rvEscapeAttr(l)}')">${rvEscapeHtml(l.replace(", Kemps Corner","").replace(", Bandra",""))}</button>`).join("");
    const box=document.getElementById("modal-box");
    box.className="modal-box cr-modal";
    box.innerHTML=`
      <div class="cr-modal-hdr">
        <div class="cr-modal-title">
          <span class="cr-modal-icon">📋</span>
          <div>
            <div class="modal-class-name">Schedule Compliance Report</div>
            <div class="modal-meta">Rules met, warnings, and score breakdown for generated schedule</div>
          </div>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="cr-loc-tabs">${tabsHtml}</div>
      <div class="cr-modal-body" id="cr-body">${renderReport(activeLoc)}</div>
    `;
    document.getElementById("modal-overlay").classList.add("open");
  }

  window.crSwitchLoc=function(loc){
    activeLoc=loc;
    const body=document.getElementById("cr-body");
    const tabs=document.querySelectorAll(".cr-loc-tab");
    tabs.forEach(t=>t.classList.toggle("active",t.textContent===loc.replace(", Kemps Corner","").replace(", Bandra","")));
    if(body)body.innerHTML=renderReport(loc);
  };

  build();
}

(function _injectComplianceStyles(){
  if(document.getElementById("cr-styles"))return;
  const s=document.createElement("style");
  s.id="cr-styles";
  s.textContent=`
.cr-modal{max-width:780px;width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}
.cr-modal-hdr{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 24px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
.cr-modal-title{display:flex;align-items:center;gap:12px}
.cr-modal-icon{font-size:22px;line-height:1}
.cr-loc-tabs{display:flex;gap:4px;padding:10px 24px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap}
.cr-loc-tab{padding:5px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text-muted);transition:all .14s}
.cr-loc-tab.active{background:var(--primary);border-color:var(--primary);color:#fff}
.cr-modal-body{overflow-y:auto;padding:20px 24px 28px;flex:1;min-height:0}
.cr-summary{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.cr-sum-card{padding:12px 16px;border-radius:8px;text-align:center;min-width:80px;flex:1;border:1.5px solid transparent}
.cr-sum-card.cr-pass{background:#f0fdf4;border-color:#bbf7d0}
.cr-sum-card.cr-warn{background:#fffbeb;border-color:#fde68a}
.cr-sum-card.cr-fail{background:#fef2f2;border-color:#fecaca}
.cr-sum-val{font-size:26px;font-weight:800;line-height:1}
.cr-sum-card.cr-pass .cr-sum-val{color:#16a34a}
.cr-sum-card.cr-warn .cr-sum-val{color:#d97706}
.cr-sum-card.cr-fail .cr-sum-val{color:#dc2626}
.cr-sum-lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-top:2px}
.cr-sum-sub{font-size:11px;color:var(--text-muted);margin-top:3px}
.cr-cat-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin:16px 0 6px;padding:0 2px}
.cr-rules-list{display:flex;flex-direction:column;gap:4px;margin-bottom:24px}
.cr-rule{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:7px;border:1px solid transparent}
.cr-rule.cr-pass{background:#f0fdf4;border-color:#bbf7d0}
.cr-rule.cr-warn{background:#fffbeb;border-color:#fde68a}
.cr-rule.cr-fail{background:#fef2f2;border-color:#fecaca}
.cr-rule-icon{font-size:13px;font-weight:800;flex-shrink:0;margin-top:1px;width:16px;text-align:center}
.cr-rule.cr-pass .cr-rule-icon{color:#16a34a}
.cr-rule.cr-warn .cr-rule-icon{color:#d97706}
.cr-rule.cr-fail .cr-rule-icon{color:#dc2626}
.cr-rule-body{flex:1;min-width:0}
.cr-rule-label{font-size:12px;font-weight:600;color:var(--text);line-height:1.35}
.cr-rule-vals{display:flex;gap:6px;margin-top:3px;flex-wrap:wrap}
.cr-actual,.cr-expected{font-size:11px;color:var(--text-muted)}
.cr-sep{font-size:11px;color:var(--border-strong)}
.cr-rule-reason{font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.4;font-style:italic}
.cr-rule-id{font-size:10px;color:var(--text-light);flex-shrink:0;align-self:flex-start;margin-top:2px;font-family:monospace}
.cr-section-title{font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.cr-slot-list{display:flex;flex-direction:column;gap:4px}
.cr-slot-row{padding:8px 10px;border-radius:6px;border:1px solid transparent}
.cr-slot-row.cr-pass{background:#f0fdf4;border-color:#bbf7d0}
.cr-slot-row.cr-warn{background:#fffbeb;border-color:#fde68a}
.cr-slot-row.cr-fail{background:#fef2f2;border-color:#fecaca}
.cr-slot-hdr{display:flex;align-items:center;gap:8px}
.cr-slot-score{font-size:13px;font-weight:800;width:34px;text-align:center;flex-shrink:0}
.cr-slot-score.cr-pass{color:#16a34a}
.cr-slot-score.cr-warn{color:#d97706}
.cr-slot-score.cr-fail{color:#dc2626}
.cr-slot-info{font-size:12px;color:var(--text);font-weight:500}
.cr-slot-comps{display:flex;gap:8px;flex-wrap:wrap;margin-top:5px;padding-left:42px}
.cr-comp{font-size:11px;color:var(--text-muted)}
.cr-comp b{color:var(--text)}
.cr-slot-viols{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;padding-left:42px}
.cr-viol-badge{font-size:10px;padding:2px 7px;border-radius:100px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;font-weight:500}
  `;
  document.head.appendChild(s);
})();

// ============================================================
// EXPORT SCHEDULE FUNCTIONS (PDF, CSV, HTML, JSON)
// ============================================================

function getActiveScheduleExportSlots(){
  const locs = typeof getActiveLocations === 'function' ? getActiveLocations() : [];
  const allSlots = locs.flatMap(loc => typeof getSlots === 'function' ? getSlots(loc) : []);
  return typeof filterSlots === 'function' ? filterSlots(allSlots) : allSlots;
}

function toggleExportMenu(e){
  if(e) e.stopPropagation();
  const m = document.getElementById("export-menu");
  if(m) m.style.display = (m.style.display === "none" || !m.style.display) ? "block" : "none";
}

function closeExportMenu(){
  const m = document.getElementById("export-menu");
  if(m) m.style.display = "none";
}
document.addEventListener("click", closeExportMenu);

function exportScheduleCSV(){
  const slots = getActiveScheduleExportSlots();
  if(!slots.length){ if(typeof showToast==='function') showToast("No slots found to export", "warn"); return; }
  const headers = ["Location", "Date", "Day", "Time", "Class Format", "Trainer", "Room", "Capacity", "Fill Rate %", "Projected Attendance", "Historic Sessions", "Class Avg Checkin", "Best Trainer Name", "Score", "Selection Reason"];
  const csvRows = [headers.join(",")];
  slots.forEach(s => {
    const fillPct = (Math.round((s.predicted_fill_rate || s.historical_avg_fill || 0) * 1000) / 10) + "%";
    const attendance = Math.round((s.predicted_fill_rate || s.historical_avg_fill || 0) * (s.capacity || 20));
    const histSessions = s.historical_session_count || s.metric_session_count || s.trainer_slot_session_count || 0;
    const classAvg = Math.round((s.historical_avg_checkin || s.metric_avg_checkin || 0) * 10) / 10;
    const bestTrainer = (Array.isArray(s.slot_top_trainers) && s.slot_top_trainers[0]?.trainer) || s.best_trainer_name || s.top_trainer_name || s.trainer_1 || "—";
    const reason = getCanonicalSelectionReason(s);

    const row = [
      `"${(s.location||'').replace(/"/g, '""')}"`,
      `"${(s.date||'').replace(/"/g, '""')}"`,
      `"${(s.day_of_week||'').replace(/"/g, '""')}"`,
      `"${(s.time||'').replace(/"/g, '""')}"`,
      `"${(s.class_name||'').replace(/"/g, '""')}"`,
      `"${(s.trainer_1||'').replace(/"/g, '""')}"`,
      `"${(s.room||'').replace(/"/g, '""')}"`,
      s.capacity || s.cap || 0,
      `"${fillPct}"`,
      attendance,
      histSessions,
      classAvg,
      `"${bestTrainer.replace(/"/g, '""')}"`,
      Math.round(s.score || 0),
      `"${reason.replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(","));
  });
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const weekStr = document.getElementById("week-badge")?.innerText?.replace(/[^0-9a-zA-Z]/g, "_") || "Schedule";
  link.setAttribute("href", url);
  link.setAttribute("download", `Athena_Schedule_${weekStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if(typeof showToast==='function') showToast("Exported CSV successfully", "success");
}

function exportScheduleJSON(){
  const slots = getActiveScheduleExportSlots();
  if(!slots.length){ if(typeof showToast==='function') showToast("No slots found to export", "warn"); return; }
  const weekStr = document.getElementById("week-badge")?.innerText || "";
  const enrichedSlots = slots.map(s => ({
    ...s,
    selection_reason: getCanonicalSelectionReason(s),
    projected_attendance: Math.round((s.predicted_fill_rate || s.historical_avg_fill || 0) * (s.capacity || 20)),
    historic_sessions: s.historical_session_count || s.metric_session_count || s.trainer_slot_session_count || 0,
    class_avg_checkin: Math.round((s.historical_avg_checkin || s.metric_avg_checkin || 0) * 10) / 10,
    best_trainer_name: (Array.isArray(s.slot_top_trainers) && s.slot_top_trainers[0]?.trainer) || s.best_trainer_name || s.top_trainer_name || s.trainer_1 || "—"
  }));
  const payload = {
    export_timestamp: new Date().toISOString(),
    week_info: weekStr,
    locations: typeof getActiveLocations === 'function' ? getActiveLocations() : [],
    total_classes: slots.length,
    schedule_slots: enrichedSlots
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Athena_Schedule_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if(typeof showToast==='function') showToast("Exported JSON successfully", "success");
}

function exportScheduleHTML(){
  const slots = getActiveScheduleExportSlots();
  if(!slots.length){ if(typeof showToast==='function') showToast("No slots found to export", "warn"); return; }
  const weekStr = document.getElementById("week-badge")?.innerText || "Schedule";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Athena Schedule — ${rvEscapeHtml(weekStr)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #0A0A0C; color: #F9FAFB; padding: 30px; }
  h1 { color: #00F3FF; font-size: 24px; margin-bottom: 6px; }
  .meta { color: #9CA3AF; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; background: #121218; border-radius: 12px; overflow: hidden; font-size: 12px; }
  th { background: #1A1A24; color: #9CA3AF; text-align: left; padding: 12px 14px; border-bottom: 1px solid #222; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
  td { padding: 10px 14px; border-bottom: 1px solid #1E1E28; color: #E5E7EB; }
  tr:hover { background: rgba(0,243,255,0.03); }
  .tag { padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 10px; background: rgba(0,243,255,0.15); color: #00F3FF; display: inline-block; }
  .reason { font-size: 11px; color: #9CA3AF; }
</style>
</head>
<body>
  <h1>Athena Studio Class Schedule</h1>
  <div class="meta">${rvEscapeHtml(weekStr)} · Total Classes: ${slots.length}</div>
  <table>
    <thead>
      <tr>
        <th>Day</th>
        <th>Time</th>
        <th>Location</th>
        <th>Class Format</th>
        <th>Trainer</th>
        <th>Room</th>
        <th>Fill %</th>
        <th>Attendance</th>
        <th>Historic Sessions</th>
        <th>Class Avg</th>
        <th>Best Trainer</th>
        <th>Selection Reason</th>
      </tr>
    </thead>
    <tbody>
      ${slots.map(s => {
        const attendance = Math.round((s.predicted_fill_rate || s.historical_avg_fill || 0) * (s.capacity || 20));
        const histSessions = s.historical_session_count || s.metric_session_count || s.trainer_slot_session_count || 0;
        const classAvg = Math.round((s.historical_avg_checkin || s.metric_avg_checkin || 0) * 10) / 10;
        const bestTrainer = (Array.isArray(s.slot_top_trainers) && s.slot_top_trainers[0]?.trainer) || s.best_trainer_name || s.top_trainer_name || s.trainer_1 || "—";
        return `<tr>
          <td><strong>${rvEscapeHtml(s.day_of_week||'')}</strong></td>
          <td>${rvEscapeHtml(s.time||'')}</td>
          <td>${rvEscapeHtml(s.location||'')}</td>
          <td><strong>${rvEscapeHtml(typeof displayClass==='function'?displayClass(s.class_name):s.class_name)}</strong></td>
          <td>${rvEscapeHtml(s.trainer_1||'')}</td>
          <td>${rvEscapeHtml(s.room||'—')}</td>
          <td><span class="tag">${typeof pct==='function'?pct(s.predicted_fill_rate || s.historical_avg_fill || 0):'0%'}</span></td>
          <td>${attendance}</td>
          <td>${histSessions}</td>
          <td>${classAvg}</td>
          <td>${rvEscapeHtml(bestTrainer)}</td>
          <td class="reason">${rvEscapeHtml(getCanonicalSelectionReason(s))}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Athena_Schedule_${new Date().toISOString().slice(0, 10)}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if(typeof showToast==='function') showToast("Exported HTML report successfully", "success");
}

function exportSchedulePDF(){
  const slots = getActiveScheduleExportSlots();
  if(!slots.length){ if(typeof showToast==='function') showToast("No slots found to export", "warn"); return; }
  const weekStr = document.getElementById("week-badge")?.innerText || "Schedule";
  if(typeof showToast==='function') showToast("Generating PDF…", "");
  schedulerFetch("/api/export-schedule-pdf", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({slots, week_label: weekStr})
  })
    .then(r => { if(!r.ok) throw new Error("PDF generation failed"); return r.blob(); })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule_report_${weekStr.replace(/[^\w-]+/g,"_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    })
    .catch(() => { if(typeof showToast==='function') showToast("Could not generate PDF", "error"); });
}
