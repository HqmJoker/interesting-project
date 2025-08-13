(function(){
  'use strict';

  const $ = (sel)=>document.querySelector(sel);

  // Elements
  const elCurrent = $('#currentTime');
  const elRemainToday = $('#remainingToday');
  const elBarDay = $('#barDay');
  const elBarWeek = $('#barWeek');
  const elBarMonth = $('#barMonth');
  const elBarYear = $('#barYear');
  const elDayPct = $('#dayPct');
  const elWeekPct = $('#weekPct');
  const elMonthPct = $('#monthPct');
  const elYearPct = $('#yearPct');
  const elYearNow = $('#yearNow');

  const elBirth = $('#birthDate');
  const elExp = $('#expectancy');
  const elGradAge = $('#gradAge');
  const elRetireAge = $('#retireAge');
  const elChildAge = $('#childAge');
  const elChildYears = $('#childYears');
  const elSleep = $('#sleepHours');
  const elWork = $('#workHours');
  const elKidH = $('#kidHours');

  const elDaysLived = $('#daysLived');
  const elDaysLeft = $('#daysLeft');
  const elLifePct = $('#lifePct');
  const elLifeGrid = $('#lifeGrid');
  const elSummary = $('#summaryText');
  const elThemeToggle = document.getElementById('themeToggle');

  const alloc = {
    total:{ sleep:$('#allocTotalSleep'), work:$('#allocTotalWork'), kid:$('#allocTotalKid'), free:$('#allocTotalFree'), legend:$('#allocTotalLegend') },
    remain:{ sleep:$('#allocRemainSleep'), work:$('#allocRemainWork'), kid:$('#allocRemainKid'), free:$('#allocRemainFree'), legend:$('#allocRemainLegend') },
  };

  // add cache holder for allocations
  let allocationsCache = null;

  const btnApply = $('#applyBtn');
  const btnReset = $('#resetBtn');

  // Theme helpers
  function getSystemPref(){
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function getSavedTheme(){
    try{ return localStorage.getItem('life_theme') || ''; }catch(e){ return ''; }
  }
  function saveTheme(theme){
    try{ localStorage.setItem('life_theme', theme); }catch(e){}
  }
  function applyTheme(theme){
    const root = document.documentElement;
    if(theme){
      root.setAttribute('data-theme', theme);
    }else{
      root.removeAttribute('data-theme');
    }
    if(elThemeToggle){
      const effective = theme || getSystemPref();
      elThemeToggle.textContent = effective === 'light' ? '切换为暗色' : '切换为亮色';
      elThemeToggle.setAttribute('aria-label', elThemeToggle.textContent);
    }
  }
  function toggleTheme(){
    const currentAttr = document.documentElement.getAttribute('data-theme');
    let next;
    if(!currentAttr){
      // Following system now; toggle to the opposite of system to force
      next = getSystemPref() === 'light' ? 'dark' : 'light';
    }else{
      next = currentAttr === 'light' ? 'dark' : 'light';
    }
    saveTheme(next);
    applyTheme(next);
  }

  // Utils
  const MS = {
    hour: 3600*1000,
    day: 24*3600*1000,
    week: 7*24*3600*1000,
  };
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const pad2 = (n)=>String(n).padStart(2,'0');
  const fmtPct = (v)=>`${(v*100).toFixed(1)}%`;
  const fmtInt = (n)=>new Intl.NumberFormat('zh-CN').format(Math.max(0,Math.floor(n)));
  const addYears = (date, years)=>{
    const d = new Date(date.getTime());
    d.setFullYear(d.getFullYear()+years);
    return d;
  };
  const daysBetween = (a,b)=> (b.getTime() - a.getTime())/MS.day;

  function getSettings(){
    return {
      birth: new Date(elBirth.value || '2000-01-01T00:00:00'),
      expectancy: parseFloat(elExp.value||'80'),
      gradAge: parseFloat(elGradAge.value||'22'),
      retireAge: parseFloat(elRetireAge.value||'60'),
      childAge: parseFloat(elChildAge.value||'28'),
      childYears: parseFloat(elChildYears.value||'18'),
      sleepHours: parseFloat(elSleep.value||'8'),
      workHours: parseFloat(elWork.value||'8'),
      kidHours: parseFloat(elKidH.value||'2'),
    };
  }

  function saveSettings(){
    const s = getSettings();
    localStorage.setItem('life_settings', JSON.stringify({
      birth: elBirth.value,
      expectancy: s.expectancy,
      gradAge: s.gradAge,
      retireAge: s.retireAge,
      childAge: s.childAge,
      childYears: s.childYears,
      sleepHours: s.sleepHours,
      workHours: s.workHours,
      kidHours: s.kidHours,
    }));
  }

  function loadSettings(){
    try{
      const raw = localStorage.getItem('life_settings');
      if(!raw) return;
      const o = JSON.parse(raw);
      if(o.birth) elBirth.value = o.birth;
      if(o.expectancy!=null) elExp.value = o.expectancy;
      if(o.gradAge!=null) elGradAge.value = o.gradAge;
      if(o.retireAge!=null) elRetireAge.value = o.retireAge;
      if(o.childAge!=null) elChildAge.value = o.childAge;
      if(o.childYears!=null) elChildYears.value = o.childYears;
      if(o.sleepHours!=null) elSleep.value = o.sleepHours;
      if(o.workHours!=null) elWork.value = o.workHours;
      if(o.kidHours!=null) elKidH.value = o.kidHours;
    }catch(e){/* ignore */}
  }

  // NOW section
  function startOfDay(d){ const t = new Date(d); t.setHours(0,0,0,0); return t; }
  function endOfDay(d){ const t = new Date(d); t.setHours(24,0,0,0); return t; }
  function startOfWeekMon(d){
    const t = startOfDay(d);
    const day = (t.getDay()+6)%7; // Mon=0
    t.setDate(t.getDate() - day);
    return t;
  }
  function startOfMonth(d){ const t = new Date(d.getFullYear(), d.getMonth(), 1); return t; }
  function startOfYear(d){ const t = new Date(d.getFullYear(), 0, 1); return t; }

  function updateNow(){
    const now = new Date();
    elCurrent.textContent = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;

    const sod = startOfDay(now), eod = endOfDay(now);
    const remainMs = Math.max(0, eod.getTime() - now.getTime());
    const rh = Math.floor(remainMs/MS.hour);
    const rm = Math.floor((remainMs - rh*MS.hour)/60000);
    const rs = Math.floor((remainMs - rh*MS.hour - rm*60000)/1000);
    elRemainToday.textContent = `${pad2(rh)}:${pad2(rm)}:${pad2(rs)}`;

    const dayPct = clamp((now.getTime() - sod.getTime())/(eod.getTime() - sod.getTime()), 0, 1);
    elBarDay.style.width = fmtPct(dayPct);
    elDayPct.textContent = fmtPct(dayPct);

    const sow = startOfWeekMon(now);
    const eow = new Date(sow.getTime()+MS.week);
    const weekPct = clamp((now.getTime() - sow.getTime())/(eow.getTime() - sow.getTime()), 0, 1);
    elBarWeek.style.width = fmtPct(weekPct);
    elWeekPct.textContent = fmtPct(weekPct);

    const som = startOfMonth(now);
    const nextMonth = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const monthPct = clamp((now.getTime() - som.getTime())/(nextMonth.getTime() - som.getTime()), 0, 1);
    elBarMonth.style.width = fmtPct(monthPct);
    elMonthPct.textContent = fmtPct(monthPct);

    const soy = startOfYear(now);
    const nextYear = new Date(now.getFullYear()+1, 0, 1);
    const yearPct = clamp((now.getTime() - soy.getTime())/(nextYear.getTime() - soy.getTime()), 0, 1);
    elBarYear.style.width = fmtPct(yearPct);
    elYearPct.textContent = fmtPct(yearPct);

    elYearNow.textContent = String(now.getFullYear());
  }

  // Life stats and grid
  function computeStatsAndRender(){
    const s = getSettings();
    const now = new Date();

    const death = addYears(s.birth, s.expectancy);
    const totalMs = Math.max(0, death.getTime() - s.birth.getTime());
    const livedMs = Math.max(0, now.getTime() - s.birth.getTime());
    const leftMs = Math.max(0, death.getTime() - now.getTime());

    const livedDays = Math.floor(livedMs / MS.day);
    const leftDays = Math.floor(leftMs / MS.day);
    const lifeProgress = totalMs>0 ? livedMs/totalMs : 1;

    elDaysLived.textContent = fmtInt(livedDays);
    elDaysLeft.textContent = fmtInt(leftDays);
    elLifePct.textContent = (lifeProgress*100).toFixed(1);

    renderLifeGrid(s, now, death);
    renderAllocations(s, now, death);
    renderSummary(s, now, death);
  }

  function renderLifeGrid(s, now, death){
    elLifeGrid.innerHTML = '';
    const totalWeeks = Math.max(1, Math.ceil((death.getTime() - s.birth.getTime())/MS.week));

    const gradDate = addYears(s.birth, s.gradAge);
    const retireDate = addYears(s.birth, s.retireAge);
    const childBirthDate = addYears(s.birth, s.childAge);
    const childEndDate = addYears(childBirthDate, s.childYears);

    for(let i=0;i<totalWeeks;i++){
      const weekStart = new Date(s.birth.getTime() + i*MS.week);
      const cell = document.createElement('div');
      cell.className = 'cell';

      const isPast = weekStart < now;
      const inWork = weekStart >= gradDate && weekStart < retireDate;
      const inKid = weekStart >= childBirthDate && weekStart < childEndDate;
      const isRetired = weekStart >= retireDate;

      if(isPast){
        cell.classList.add('past');
      } else {
        if(inKid){
          cell.classList.add('kid');
        } else if(inWork){
          cell.classList.add('work');
        } else if(isRetired){
          cell.classList.add('retired');
        }
      }

      // marks: choose the nearest week to the event to add a marker dot
      const markNear = (date)=>{
        const idx = Math.round((date.getTime() - s.birth.getTime())/MS.week);
        return idx === i;
      };
      if(markNear(gradDate)){ cell.classList.add('mark','grad'); }
      if(markNear(childBirthDate)){ cell.classList.add('mark','child'); }
      if(markNear(retireDate)){ cell.classList.add('mark','retire'); }

      const labels = [];
      labels.push(weekStart.toISOString().slice(0,10));
      if(isPast) labels.push('已过去'); else {
        if(inKid) labels.push('陪伴孩子期');
        else if(inWork) labels.push('工作期');
        else if(isRetired) labels.push('退休期');
        else labels.push('未来');
      }
      if(cell.classList.contains('grad')) labels.push('毕业/工作');
      if(cell.classList.contains('child')) labels.push('孩子出生');
      if(cell.classList.contains('retire')) labels.push('退休');
      cell.title = labels.join(' · ');

      elLifeGrid.appendChild(cell);
    }
  }

  // Allocation bars
  function intersectDays(a1,a2,b1,b2){
    const start = Math.max(a1.getTime(), b1.getTime());
    const end = Math.min(a2.getTime(), b2.getTime());
    return Math.max(0, (end - start)/MS.day);
  }

  function renderAllocations(s, now, death){
    const birth = s.birth;
    const totalDaysLife = Math.max(0, daysBetween(birth, death));
    const totalHoursLife = totalDaysLife * 24;

    const remainDays = Math.max(0, daysBetween(now, death));
    const remainHours = remainDays * 24;

    // Periods
    const workStart = addYears(birth, s.gradAge);
    const workEnd = addYears(birth, s.retireAge);
    const kidStart = addYears(birth, s.childAge);
    const kidEnd = addYears(kidStart, s.childYears);

    // Sleep across entire life
    const sleepHoursTotal = s.sleepHours * totalDaysLife;
    const sleepHoursRemain = s.sleepHours * remainDays;

    // Work only within working window
    const workDaysTotal = intersectDays(birth, death, workStart, workEnd);
    const workDaysRemain = intersectDays(now, death, workStart, workEnd);
    const workHoursTotal = s.workHours * workDaysTotal;
    const workHoursRemain = s.workHours * workDaysRemain;

    // Kid companionship only within kid window
    const kidDaysTotal = intersectDays(birth, death, kidStart, kidEnd);
    const kidDaysRemain = intersectDays(now, death, kidStart, kidEnd);
    const kidHoursTotal = s.kidHours * kidDaysTotal;
    const kidHoursRemain = s.kidHours * kidDaysRemain;

    const freeHoursTotal = Math.max(0, totalHoursLife - sleepHoursTotal - workHoursTotal - kidHoursTotal);
    const freeHoursRemain = Math.max(0, remainHours - sleepHoursRemain - workHoursRemain - kidHoursRemain);

    // Update bars
    function setBars(scope, totalHours, vals){
      const sum = Math.max(1, totalHours);
      scope.sleep.style.width = `${(vals.sleep/sum*100).toFixed(2)}%`;
      scope.work.style.width = `${(vals.work/sum*100).toFixed(2)}%`;
      scope.kid.style.width = `${(vals.kid/sum*100).toFixed(2)}%`;
      scope.free.style.width = `${(vals.free/sum*100).toFixed(2)}%`;
    }
    setBars(alloc.total, totalHoursLife, {sleep:sleepHoursTotal, work:workHoursTotal, kid:kidHoursTotal, free:freeHoursTotal});
    setBars(alloc.remain, remainHours, {sleep:sleepHoursRemain, work:workHoursRemain, kid:kidHoursRemain, free:freeHoursRemain});

    // Legends
    function legend(scope, vals){
      scope.legend.innerHTML = '';
      const items = [
        {label:'睡觉', hours: vals.sleep, color:'linear-gradient(90deg,#334155,#64748b)'},
        {label:'工作/学习', hours: vals.work, color:'linear-gradient(90deg,#92400e,#f59e0b)'},
        {label:'陪伴孩子', hours: vals.kid, color:'linear-gradient(90deg,#065f46,#22c55e)'},
        {label:'其他自由时间', hours: vals.free, color:'linear-gradient(90deg,#4c1d95,#7c3aed)'},
      ];
      items.forEach(it=>{
        const el = document.createElement('span');
        el.className = 'item';
        const sw = document.createElement('i');
        sw.className = 'swatch';
        sw.style.background = it.color;
        const txt = document.createElement('span');
        const hrs = it.hours;
        const days = hrs/24;
        const years = days/365.25;
        txt.textContent = `${it.label}: ${fmtInt(hrs)} 小时 ≈ ${years.toFixed(1)} 年`;
        el.appendChild(sw); el.appendChild(txt);
        scope.legend.appendChild(el);
      });
    }
    legend(alloc.total, {sleep:sleepHoursTotal, work:workHoursTotal, kid:kidHoursTotal, free:freeHoursTotal});
    legend(alloc.remain, {sleep:sleepHoursRemain, work:workHoursRemain, kid:kidHoursRemain, free:freeHoursRemain});

    // Store for summary
    allocationsCache = {
      total:{ sleep:sleepHoursTotal, work:workHoursTotal, kid:kidHoursTotal, free:freeHoursTotal, sum: totalHoursLife },
      remain:{ sleep:sleepHoursRemain, work:workHoursRemain, kid:kidHoursRemain, free:freeHoursRemain, sum: remainHours },
    };
  }

  function renderSummary(s, now, death){
    const cache = allocationsCache;
    if(!cache){ elSummary.textContent=''; return; }
    const freeHoursRemain = cache.remain.free;
    const freeDays = freeHoursRemain/24;
    const freeYears = freeDays/365.25;

    const lifePct = ((now.getTime() - s.birth.getTime()) / Math.max(1, (death.getTime() - s.birth.getTime()))) * 100;

    const tips = [];
    tips.push(`若以 ${s.expectancy} 岁为限，你已走过约 ${lifePct.toFixed(1)}%。`);
    tips.push(`在剩余的人生中，真正自由可支配的时间约 ${freeYears.toFixed(1)} 年（约 ${fmtInt(freeHoursRemain)} 小时）。`);

    // contextual nudge
    const workStart = addYears(s.birth, s.gradAge);
    const workEnd = addYears(s.birth, s.retireAge);
    if(now < workStart){ tips.push('珍惜当下的学习与探索，建立长期的能力与热情。'); }
    else if(now >= workStart && now < workEnd){ tips.push('在工作与生活之间留白，把时间花在最重要的人和事上。'); }
    else { tips.push('放慢脚步，回望来路，也别忘了拥抱热爱的事物。'); }

    elSummary.textContent = tips.join(' ');
  }

  function apply(){ saveSettings(); computeStatsAndRender(); }
  function reset(){ localStorage.removeItem('life_settings'); window.location.reload(); }

  // Init
  function init(){
    // Theme init
    const saved = getSavedTheme();
    if(saved){ applyTheme(saved); } else { applyTheme('light'); }
    if(elThemeToggle){ elThemeToggle.addEventListener('click', toggleTheme); }

    loadSettings();
    updateNow();
    computeStatsAndRender();
    setInterval(updateNow, 1000);

    // Recompute on apply
    btnApply.addEventListener('click', ()=>{ apply(); });
    btnReset.addEventListener('click', ()=>{ reset(); });

    // Live recompute when inputs change slightly
    document.querySelectorAll('#settingsForm input').forEach(inp=>{
      inp.addEventListener('change', ()=>{ apply(); });
      inp.addEventListener('blur', ()=>{ apply(); });
    });

    // Re-render grid on window resize if needed (no-op, layout is CSS-based)
  }

  document.addEventListener('DOMContentLoaded', init);
})(); 