// ============================================================
// CONFIGURATOR — Schedule: Targets, Class Mix, Formats
// ============================================================

CFG_SECTION_RENDER['targets']  = cfgRenderTargets;
CFG_SECTION_RENDER['classmix'] = cfgRenderClassMix;
CFG_SECTION_RENDER['formats']  = cfgRenderFormats;

const CFG_DAYS_ALL  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const CFG_LOCS_ALL  = ["Kwality House, Kemps Corner","Supreme HQ, Bandra","Kenkere House","Courtside","Copper & Cloves"];
const CFG_LOC_SHORT = {
  "Kwality House, Kemps Corner": "Kwality",
  "Supreme HQ, Bandra":         "Supreme HQ",
  "Kenkere House":               "Kenkere",
  "Courtside":                   "Courtside",
  "Copper & Cloves":             "Copper & Cloves",
};
const CFG_CLASS_LIST = [
  "Studio Barre 57","Studio Cardio Barre","Studio Cardio Barre Express","Studio Cardio Barre Plus",
  "Studio Mat 57","Studio Mat 57 Express","Studio PowerCycle","Studio PowerCycle Express",
  "Studio Strength Lab","Studio FIT","Studio FIT Express","Studio Amped Up!","Studio HIIT",
  "Studio Recovery","Studio Back Body Blaze","Studio Foundations","Studio Barre 57 Express",
  "Studio Barre Flow","Studio Trainer's Choice",
];

let _cfgCopyTargetFromLoc = null;
let _cfgMixCurrentLoc = null;

// ═══════════════════════════════════════════════════════════
// DAILY TARGETS
// ═══════════════════════════════════════════════════════════

function cfgRenderTargets(container) {
  const targets = _cfgDraft?.targets || {};
  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Daily Targets</div>
        <div class="cfg-section-desc">Min and max classes per day per studio. Edit inline. Use Copy Row to mirror a location to others.</div>
      </div>
      <div class="cfg-section-actions">
        <button class="cfg-action-btn primary"
          onclick="cfgSaveScheduleConfig().then(()=>{cfgMarkClean('targets');showToast('Targets saved','success')}).catch(e=>showToast(e.message,'error'))">
          Save
        </button>
      </div>
    </div>

    <div class="cfg-table-wrap" style="margin-bottom:16px">
      <table class="cfg-table cfg-grid-table">
        <thead>
          <tr>
            <th>Studio</th>
            ${CFG_DAYS_ALL.map(d => `<th style="text-align:center">${d.slice(0,3)}</th>`).join('')}
            <th style="text-align:center">Week Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${CFG_LOCS_ALL.map(loc => {
            const lT = targets[loc] || {};
            const wkTotal = CFG_DAYS_ALL.reduce((s, d) => s + (Number(lT[d]?.target) || 0), 0);
            return `<tr data-loc="${rvEscapeAttr(loc)}">
              <td class="cfg-grid-rowhead">
                <div class="cfg-loc-name">${CFG_LOC_SHORT[loc] || loc}</div>
                <div class="cfg-loc-sub">${rvEscapeHtml(loc)}</div>
              </td>
              ${CFG_DAYS_ALL.map(day => {
                const dt = lT[day] || {};
                const invalid = Number(dt.target || 0) > Number(dt.max || 0);
                return `<td>
                  <div class="cfg-target-cell${invalid ? ' invalid' : ''}">
                    <input class="cfg-target-input" type="number" min="0" max="30"
                      value="${Number(dt.target || 0)}"
                      title="Min (target)"
                      data-loc="${rvEscapeAttr(loc)}" data-day="${day}" data-field="target"
                      onchange="cfgTargetChange(this)">
                    <span class="cfg-target-sep">/</span>
                    <input class="cfg-target-input" type="number" min="0" max="35"
                      value="${Number(dt.max || 0)}"
                      title="Max"
                      data-loc="${rvEscapeAttr(loc)}" data-day="${day}" data-field="max"
                      onchange="cfgTargetChange(this)">
                  </div>
                </td>`;
              }).join('')}
              <td class="cfg-weekly-total" id="cfg-wk-${loc.replace(/[^a-z0-9]/gi,'_')}">${wkTotal}</td>
              <td><button class="cfg-row-btn" onclick="cfgTargetCopyRow('${rvEscapeAttr(loc)}')">Copy →</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div id="cfg-target-copy-panel" style="display:none">
      <div class="cfg-card">
        <div class="cfg-card-title">Copy daily targets from <span id="cfg-tgt-copy-name" style="color:#1D4ED8"></span> to:</div>
        <div class="cfg-copy-loc-list" id="cfg-tgt-copy-dest"></div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="cfg-action-btn primary" onclick="cfgTargetApplyCopy()">Apply</button>
          <button class="cfg-action-btn" onclick="document.getElementById('cfg-target-copy-panel').style.display='none'">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function cfgTargetChange(inp) {
  const { loc, day, field } = inp.dataset;
  if (!_cfgDraft.targets) _cfgDraft.targets = {};
  if (!_cfgDraft.targets[loc]) _cfgDraft.targets[loc] = {};
  if (!_cfgDraft.targets[loc][day]) _cfgDraft.targets[loc][day] = {};
  _cfgDraft.targets[loc][day][field] = parseInt(inp.value) || 0;
  _cfgDraft.targets[loc][day].source = 'settings';
  // Validate
  const t = _cfgDraft.targets[loc][day];
  const cell = inp.closest('.cfg-target-cell');
  if (cell) cell.classList.toggle('invalid', Number(t.target || 0) > Number(t.max || 0));
  // Update weekly total
  const wkTotal = CFG_DAYS_ALL.reduce((s, d) => s + (Number(_cfgDraft.targets[loc]?.[d]?.target) || 0), 0);
  const el = document.getElementById('cfg-wk-' + loc.replace(/[^a-z0-9]/gi, '_'));
  if (el) el.textContent = wkTotal;
  cfgMarkDirty('targets');
}

function cfgTargetCopyRow(loc) {
  _cfgCopyTargetFromLoc = loc;
  document.getElementById('cfg-tgt-copy-name').textContent = CFG_LOC_SHORT[loc] || loc;
  const dest = document.getElementById('cfg-tgt-copy-dest');
  if (dest) {
    dest.innerHTML = CFG_LOCS_ALL.filter(l => l !== loc).map(l => `
      <label class="cfg-copy-loc-item">
        <input type="checkbox" class="cfg-tgt-copy-cb" value="${rvEscapeAttr(l)}">
        ${rvEscapeHtml(l)}
      </label>`).join('');
  }
  document.getElementById('cfg-target-copy-panel').style.display = '';
  document.getElementById('cfg-target-copy-panel').scrollIntoView({ behavior: 'smooth' });
}

function cfgTargetApplyCopy() {
  if (!_cfgCopyTargetFromLoc) return;
  const srcTargets = _cfgDraft.targets?.[_cfgCopyTargetFromLoc] || {};
  let count = 0;
  document.querySelectorAll('.cfg-tgt-copy-cb:checked').forEach(cb => {
    const dest = cb.value;
    if (!_cfgDraft.targets) _cfgDraft.targets = {};
    _cfgDraft.targets[dest] = JSON.parse(JSON.stringify(srcTargets));
    count++;
  });
  if (!count) { showToast('Select at least one destination', ''); return; }
  cfgMarkDirty('targets');
  document.getElementById('cfg-target-copy-panel').style.display = 'none';
  cfgRenderTargets(document.getElementById('cfg-content'));
  showToast(`Targets copied to ${count} location(s)`, 'success');
}

// ═══════════════════════════════════════════════════════════
// CLASS MIX
// ═══════════════════════════════════════════════════════════

function cfgRenderClassMix(container) {
  const mix = _cfgDraft?.class_mix || {};
  const tabLocs = CFG_LOCS_ALL.filter(l => mix[l] || true);
  _cfgMixCurrentLoc = _cfgMixCurrentLoc || tabLocs[0];

  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Class Mix</div>
        <div class="cfg-section-desc">Min and max classes per format per studio per week. Switch studio tabs. Use Copy to mirror a location's profile.</div>
      </div>
      <div class="cfg-section-actions">
        <button class="cfg-action-btn primary"
          onclick="cfgSaveScheduleConfig().then(()=>{cfgMarkClean('classmix');showToast('Class mix saved','success')}).catch(e=>showToast(e.message,'error'))">
          Save
        </button>
      </div>
    </div>

    <div class="cfg-mix-tabs" id="cfg-mix-tabs">
      ${tabLocs.map(l => `
        <button class="cfg-mix-tab ${l === _cfgMixCurrentLoc ? 'active' : ''}"
          onclick="cfgMixSwitchTab(this,'${rvEscapeAttr(l)}')">
          ${rvEscapeHtml(CFG_LOC_SHORT[l] || l)}
        </button>`).join('')}
    </div>

    <div id="cfg-mix-panel"></div>
  `;
  cfgMixRenderLoc(_cfgMixCurrentLoc);
}

function cfgMixSwitchTab(btn, loc) {
  document.querySelectorAll('.cfg-mix-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  _cfgMixCurrentLoc = loc;
  cfgMixRenderLoc(loc);
}

function cfgMixRenderLoc(loc) {
  const panel = document.getElementById('cfg-mix-panel');
  if (!panel) return;
  const locMix = _cfgDraft?.class_mix?.[loc] || {};

  panel.innerHTML = `
    <div class="cfg-mix-toolbar">
      <span style="font-size:11px;color:#64748B">${rvEscapeHtml(loc)}</span>
      <div style="display:flex;gap:8px">
        <button class="cfg-action-btn" onclick="cfgMixShowCopy('${rvEscapeAttr(loc)}')">Copy to Other Locations →</button>
        <button class="cfg-action-btn" onclick="if(confirm('Zero all min/max for ${rvEscapeAttr(loc)}?'))cfgMixZeroAll('${rvEscapeAttr(loc)}')">Zero All</button>
      </div>
    </div>

    <div class="cfg-table-wrap">
      <table class="cfg-table">
        <thead>
          <tr>
            <th>Class Format</th>
            <th style="width:100px;text-align:center">Min / week</th>
            <th style="width:100px;text-align:center">Max / week</th>
            <th style="width:80px;text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${CFG_CLASS_LIST.map(fmt => {
            const entry = locMix[fmt] || { min: 0, max: 0 };
            const disabled = Number(entry.max || 0) === 0;
            return `<tr style="${disabled ? 'opacity:0.5' : ''}">
              <td>${rvEscapeHtml(fmt)}</td>
              <td style="text-align:center">
                <input class="cfg-mix-input" type="number" min="0" max="100"
                  value="${Number(entry.min || 0)}"
                  data-loc="${rvEscapeAttr(loc)}" data-fmt="${rvEscapeAttr(fmt)}" data-field="min"
                  onchange="cfgMixChange(this)">
              </td>
              <td style="text-align:center">
                <input class="cfg-mix-input" type="number" min="0" max="100"
                  value="${Number(entry.max || 0)}"
                  data-loc="${rvEscapeAttr(loc)}" data-fmt="${rvEscapeAttr(fmt)}" data-field="max"
                  onchange="cfgMixChange(this)">
              </td>
              <td style="text-align:center">
                <span class="cfg-badge ${disabled ? 'grey' : 'green'}">${disabled ? 'Off' : 'On'}</span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div id="cfg-mix-copy-panel" style="display:none;margin-top:16px">
      <div class="cfg-card">
        <div class="cfg-card-title">Copy class mix from <strong>${rvEscapeHtml(CFG_LOC_SHORT[loc] || loc)}</strong> to:</div>
        <div class="cfg-copy-loc-list">
          ${CFG_LOCS_ALL.filter(l => l !== loc).map(l => `
            <label class="cfg-copy-loc-item">
              <input type="checkbox" class="cfg-mix-copy-cb" value="${rvEscapeAttr(l)}">
              ${rvEscapeHtml(l)}
            </label>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="cfg-action-btn primary" onclick="cfgMixApplyCopy('${rvEscapeAttr(loc)}')">Apply</button>
          <button class="cfg-action-btn" onclick="document.getElementById('cfg-mix-copy-panel').style.display='none'">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function cfgMixChange(inp) {
  const { loc, fmt, field } = inp.dataset;
  if (!_cfgDraft.class_mix) _cfgDraft.class_mix = {};
  if (!_cfgDraft.class_mix[loc]) _cfgDraft.class_mix[loc] = {};
  if (!_cfgDraft.class_mix[loc][fmt]) _cfgDraft.class_mix[loc][fmt] = { min: 0, max: 0, source: 'settings' };
  _cfgDraft.class_mix[loc][fmt][field] = parseInt(inp.value) || 0;
  _cfgDraft.class_mix[loc][fmt].source = 'settings';
  // Update disabled styling
  const row = inp.closest('tr');
  if (row) {
    const entry = _cfgDraft.class_mix[loc][fmt];
    const disabled = Number(entry.max || 0) === 0;
    row.style.opacity = disabled ? '0.5' : '';
    const badge = row.querySelector('.cfg-badge');
    if (badge) { badge.className = `cfg-badge ${disabled ? 'grey' : 'green'}`; badge.textContent = disabled ? 'Off' : 'On'; }
  }
  cfgMarkDirty('classmix');
}

function cfgMixShowCopy(loc) {
  const panel = document.getElementById('cfg-mix-copy-panel');
  if (panel) panel.style.display = '';
}

function cfgMixApplyCopy(loc) {
  const srcMix = _cfgDraft?.class_mix?.[loc] || {};
  let count = 0;
  document.querySelectorAll('.cfg-mix-copy-cb:checked').forEach(cb => {
    const dest = cb.value;
    if (!_cfgDraft.class_mix) _cfgDraft.class_mix = {};
    _cfgDraft.class_mix[dest] = JSON.parse(JSON.stringify(srcMix));
    count++;
  });
  if (!count) { showToast('Select at least one destination', ''); return; }
  cfgMarkDirty('classmix');
  document.getElementById('cfg-mix-copy-panel').style.display = 'none';
  showToast(`Class mix copied to ${count} location(s)`, 'success');
}

function cfgMixZeroAll(loc) {
  if (!_cfgDraft.class_mix) _cfgDraft.class_mix = {};
  _cfgDraft.class_mix[loc] = {};
  CFG_CLASS_LIST.forEach(fmt => {
    _cfgDraft.class_mix[loc][fmt] = { min: 0, max: 0, source: 'settings' };
  });
  cfgMarkDirty('classmix');
  cfgMixRenderLoc(loc);
}

// ═══════════════════════════════════════════════════════════
// FORMATS (read-only metadata reference)
// ═══════════════════════════════════════════════════════════

function cfgRenderFormats(container) {
  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Class Formats</div>
        <div class="cfg-section-desc">Format reference. Min/max per week and eligible locations are set in Class Mix. For deep format changes (duration, preferred slots, certification families) edit <code>rules/class_formats.json</code> directly.</div>
      </div>
    </div>

    <div class="cfg-card">
      <div class="cfg-card-title">All Formats (${CFG_CLASS_LIST.length})</div>
      <div class="cfg-table-wrap">
        <table class="cfg-table">
          <thead>
            <tr>
              <th>Format Name</th>
              <th>Allowed at Kwality</th>
              <th>Allowed at Supreme</th>
              <th>Allowed at Kenkere</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${CFG_CLASS_LIST.map(fmt => {
              const isPowerCycle = fmt.toLowerCase().includes('powercycle') || fmt.toLowerCase().includes('cycle');
              const isStrengthLab = fmt.toLowerCase().includes('strength');
              const isPrePost = fmt.toLowerCase().includes('natal');
              const kwaOK = !isPrePost;
              const supOK = !isStrengthLab && !isPrePost;
              const kenOK = !isPowerCycle && !isStrengthLab && !isPrePost;
              const note = isPrePost ? 'Pinned only' : isPowerCycle ? 'Mumbai only' : isStrengthLab ? 'Kwality only' : '';
              return `<tr>
                <td><strong style="font-size:12px">${rvEscapeHtml(fmt)}</strong></td>
                <td style="text-align:center">${kwaOK ? '✅' : '—'}</td>
                <td style="text-align:center">${supOK ? '✅' : '—'}</td>
                <td style="text-align:center">${kenOK ? '✅' : '—'}</td>
                <td style="font-size:11px;color:#64748B">${note}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="font-size:11px;color:#94A3B8;margin-top:12px">
        Source: <code>rules/class_formats.json</code> + CLAUDE.md guardrails.
        Certification requirements are managed in the Certifications section.
      </div>
    </div>
  `;
}
