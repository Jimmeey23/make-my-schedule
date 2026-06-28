// ============================================================
// CONFIGURATOR — Rules: Custom Rules, Pins
// ============================================================

CFG_SECTION_RENDER['customrules'] = cfgRenderCustomRules;
CFG_SECTION_RENDER['pins']        = cfgRenderPins;

const CFG_RULE_TYPES = [
  { id: 'trainer_availability',      label: 'Trainer Availability — limit when/where a trainer can be assigned' },
  { id: 'daily_target',             label: 'Daily Target — set class count for a specific day' },
  { id: 'weekly_class_mix',         label: 'Weekly Class Mix — cap how often a format appears' },
  { id: 'class_time_restriction',   label: 'Class Time Restriction — block a class at a specific time' },
  { id: 'class_location_restriction', label: 'Class Location Restriction — restrict a class to/from a location' },
];

// ═══════════════════════════════════════════════════════════
// CUSTOM RULES
// ═══════════════════════════════════════════════════════════

function cfgRenderCustomRules(container) {
  const rules = _cfgDraft?.custom_rules || [];
  const trainerOpts = (_profilesDraft || []).map(t =>
    `<option value="${rvEscapeAttr(t.name||'')}">${rvEscapeHtml(t.name||'')}</option>`).join('');

  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Custom Rules</div>
        <div class="cfg-section-desc">Hard rules are binding constraints. Soft rules are scoring guidance. All rules persist to config/schedule_config.json.</div>
      </div>
      <div class="cfg-section-actions">
        <button class="cfg-action-btn primary"
          onclick="cfgSaveScheduleConfig().then(()=>{cfgMarkClean('customrules');showToast('Rules saved','success')}).catch(e=>showToast(e.message,'error'))">
          Save
        </button>
      </div>
    </div>

    <div class="cfg-card" style="margin-bottom:20px">
      <div class="cfg-card-title">Add Custom Rule</div>
      <div class="cfg-form-grid">
        <div class="cfg-form-field" style="grid-column:1/-1">
          <label>Rule Goal</label>
          <select class="cfg-select" id="cfg-nr-type">
            ${CFG_RULE_TYPES.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="cfg-form-field">
          <label>Trainer (optional)</label>
          <select class="cfg-select" id="cfg-nr-trainer">
            <option value="">Any trainer</option>
            ${trainerOpts}
          </select>
        </div>
        <div class="cfg-form-field">
          <label>Studio (optional)</label>
          <select class="cfg-select" id="cfg-nr-location">
            <option value="">All studios</option>
            ${CFG_LOCS_ALL.map(l => `<option value="${rvEscapeAttr(l)}">${rvEscapeHtml(l)}</option>`).join('')}
          </select>
        </div>
        <div class="cfg-form-field">
          <label>Class (optional)</label>
          <select class="cfg-select" id="cfg-nr-class">
            <option value="">Any class</option>
            ${CFG_CLASS_LIST.map(c => `<option value="${rvEscapeAttr(c)}">${rvEscapeHtml(c)}</option>`).join('')}
          </select>
        </div>
        <div class="cfg-form-field">
          <label>Day (optional)</label>
          <select class="cfg-select" id="cfg-nr-day">
            <option value="">Any day</option>
            ${CFG_DAYS_ALL.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>
        <div class="cfg-form-field">
          <label>Time (optional)</label>
          <input class="cfg-input" id="cfg-nr-time" type="time">
        </div>
        <div class="cfg-form-field">
          <label>Operator</label>
          <select class="cfg-select" id="cfg-nr-operator">
            <option value="exactly">exactly</option>
            <option value="max">max</option>
            <option value="min">min</option>
            <option value="only">only</option>
            <option value="never">never</option>
            <option value="at_least">at least</option>
          </select>
        </div>
        <div class="cfg-form-field">
          <label>Value</label>
          <input class="cfg-input" id="cfg-nr-value" type="number" min="0" max="100" value="1">
        </div>
        <div class="cfg-form-field">
          <label>Strength</label>
          <select class="cfg-select" id="cfg-nr-priority">
            <option value="hard">Hard — binding constraint</option>
            <option value="soft">Soft — scoring guidance</option>
          </select>
        </div>
      </div>
      <button class="cfg-action-btn primary" style="margin-top:14px" onclick="cfgAddCustomRule()">+ Add Rule</button>
    </div>

    <div class="cfg-card">
      <div class="cfg-card-title">Active Rules (${rules.length})</div>
      ${rules.length ? `
        <div class="cfg-table-toolbar">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" onchange="cfgRuleSelectAll(this.checked)"> Select All
          </label>
          <div id="cfg-rules-bulk-actions" style="display:none;display:flex;gap:6px">
            <button class="cfg-bulk-btn" onclick="cfgBulkEnableRules(true)">Enable</button>
            <button class="cfg-bulk-btn" onclick="cfgBulkEnableRules(false)">Disable</button>
            <button class="cfg-bulk-btn danger" onclick="cfgBulkDeleteRules()">Delete</button>
          </div>
        </div>
        <div class="cfg-table-wrap">
          <table class="cfg-table">
            <thead>
              <tr>
                <th class="cfg-cb-col"></th>
                <th>Summary</th>
                <th>Studio</th>
                <th>Trainer</th>
                <th>Priority</th>
                <th>Enabled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rules.map((r, i) => `<tr>
                <td class="cfg-cb-col">
                  <input type="checkbox" class="cfg-rule-cb" data-idx="${i}" onchange="cfgRuleCheckChange()">
                </td>
                <td style="max-width:260px;font-size:12px">${rvEscapeHtml(cfgRuleSummary(r))}</td>
                <td style="font-size:11px;color:#64748B">${rvEscapeHtml(r.location || 'All')}</td>
                <td style="font-size:11px;color:#64748B">${rvEscapeHtml(r.trainer || '—')}</td>
                <td><span class="cfg-badge ${r.priority === 'hard' ? 'red' : 'blue'}">${r.priority || 'soft'}</span></td>
                <td>
                  <label class="cfg-toggle">
                    <input type="checkbox" ${r.enabled !== false ? 'checked' : ''}
                      onchange="cfgToggleRule(${i},this.checked)">
                    <span class="cfg-toggle-track"></span>
                  </label>
                </td>
                <td>
                  <button class="cfg-row-btn danger" onclick="cfgRemoveRule(${i})">Remove</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="cfg-empty">No custom rules yet. Add one above.</div>'}
    </div>
  `;

  // Show bulk actions element properly
  const bulkEl = document.getElementById('cfg-rules-bulk-actions');
  if (bulkEl) bulkEl.style.display = 'none';
}

function cfgRuleSummary(r) {
  const subject = r.trainer || r.class_name || 'Schedule';
  if (r.rule_type === 'trainer_availability') {
    return `${subject} — ${r.operator || 'only'} ${[r.day, r.time].filter(Boolean).join(' ')||'any day'}`;
  }
  if (r.rule_type === 'daily_target') {
    return `${r.day || 'Any day'}: ${r.operator || 'exactly'} ${r.value || 0} classes${r.location ? ' at ' + r.location.split(',')[0] : ''}`;
  }
  if (r.rule_type === 'weekly_class_mix') {
    return `${subject}: ${r.operator || 'max'} ${r.value || 0} per week`;
  }
  if (r.rule_type === 'class_time_restriction') {
    return `${subject} ${r.operator || 'never'} at ${r.time || '—'}`;
  }
  if (r.rule_type === 'class_location_restriction') {
    return `${subject} ${r.operator || 'only'} at ${r.location || '—'}`;
  }
  return `${subject}: ${r.operator || 'rule'} ${r.value !== undefined ? r.value : ''}`.trim();
}

function cfgAddCustomRule() {
  const rule = {
    id: 'custom-rule-' + Date.now(),
    rule_type:  document.getElementById('cfg-nr-type')?.value || 'trainer_availability',
    trainer:    document.getElementById('cfg-nr-trainer')?.value || '',
    location:   document.getElementById('cfg-nr-location')?.value || '',
    class_name: document.getElementById('cfg-nr-class')?.value || '',
    day:        document.getElementById('cfg-nr-day')?.value || '',
    time:       document.getElementById('cfg-nr-time')?.value || '',
    operator:   document.getElementById('cfg-nr-operator')?.value || 'exactly',
    value:      parseInt(document.getElementById('cfg-nr-value')?.value) || 1,
    priority:   document.getElementById('cfg-nr-priority')?.value || 'hard',
    enabled: true,
  };
  if (!_cfgDraft.custom_rules) _cfgDraft.custom_rules = [];
  _cfgDraft.custom_rules.push(rule);
  cfgMarkDirty('customrules');
  cfgRenderCustomRules(document.getElementById('cfg-content'));
  showToast('Rule added', 'success');
}

function cfgToggleRule(i, enabled) {
  if (_cfgDraft.custom_rules?.[i]) {
    _cfgDraft.custom_rules[i].enabled = enabled;
    cfgMarkDirty('customrules');
  }
}

function cfgRemoveRule(i) {
  _cfgDraft.custom_rules.splice(i, 1);
  cfgMarkDirty('customrules');
  cfgRenderCustomRules(document.getElementById('cfg-content'));
}

function cfgRuleSelectAll(checked) {
  document.querySelectorAll('.cfg-rule-cb').forEach(cb => { cb.checked = checked; });
  cfgRuleCheckChange();
}

function cfgRuleCheckChange() {
  const any = [...document.querySelectorAll('.cfg-rule-cb')].some(cb => cb.checked);
  const el = document.getElementById('cfg-rules-bulk-actions');
  if (el) el.style.display = any ? 'flex' : 'none';
}

function cfgBulkEnableRules(enabled) {
  document.querySelectorAll('.cfg-rule-cb:checked').forEach(cb => {
    const i = parseInt(cb.dataset.idx);
    if (_cfgDraft.custom_rules?.[i]) _cfgDraft.custom_rules[i].enabled = enabled;
  });
  cfgMarkDirty('customrules');
  cfgRenderCustomRules(document.getElementById('cfg-content'));
}

function cfgBulkDeleteRules() {
  const toDelete = new Set([...document.querySelectorAll('.cfg-rule-cb:checked')].map(cb => parseInt(cb.dataset.idx)));
  _cfgDraft.custom_rules = (_cfgDraft.custom_rules || []).filter((_, i) => !toDelete.has(i));
  cfgMarkDirty('customrules');
  cfgRenderCustomRules(document.getElementById('cfg-content'));
}

// ═══════════════════════════════════════════════════════════
// PINS
// ═══════════════════════════════════════════════════════════

function cfgRenderPins(container) {
  const pins = _cfgDraft?.manual_protected || [];
  const trainerListItems = (_profilesDraft || []).map(t =>
    `<option value="${rvEscapeAttr(t.name||'')}"></option>`).join('');

  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Pinned Classes</div>
        <div class="cfg-section-desc">Manually pinned classes guaranteed to appear in generated schedules. Pins override optimization scoring.</div>
      </div>
      <div class="cfg-section-actions">
        <input class="cfg-search" type="text" id="cfg-pin-search"
          placeholder="Filter by trainer, class…" oninput="cfgFilterPins(this.value)">
        <button class="cfg-action-btn primary"
          onclick="cfgSaveScheduleConfig().then(()=>{cfgMarkClean('pins');showToast('Pins saved','success')}).catch(e=>showToast(e.message,'error'))">
          Save
        </button>
      </div>
    </div>

    <datalist id="cfg-pin-trainer-dl">${trainerListItems}</datalist>

    <div class="cfg-card" style="margin-bottom:16px">
      <div class="cfg-card-title">Add Pin</div>
      <div class="cfg-form-grid">
        <div class="cfg-form-field">
          <label>Studio</label>
          <select class="cfg-select" id="cfg-pin-loc">
            ${CFG_LOCS_ALL.map(l => `<option value="${rvEscapeAttr(l)}">${rvEscapeHtml(l)}</option>`).join('')}
          </select>
        </div>
        <div class="cfg-form-field">
          <label>Day</label>
          <select class="cfg-select" id="cfg-pin-day">
            ${CFG_DAYS_ALL.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>
        <div class="cfg-form-field">
          <label>Time</label>
          <input class="cfg-input" id="cfg-pin-time" type="time" value="08:00">
        </div>
        <div class="cfg-form-field">
          <label>Class Format</label>
          <select class="cfg-select" id="cfg-pin-class">
            ${CFG_CLASS_LIST.map(f => `<option value="${rvEscapeAttr(f)}">${rvEscapeHtml(f)}</option>`).join('')}
          </select>
        </div>
        <div class="cfg-form-field">
          <label>Trainer</label>
          <input class="cfg-input" id="cfg-pin-trainer" list="cfg-pin-trainer-dl" placeholder="Trainer name">
        </div>
        <div class="cfg-form-field">
          <label>Note (optional)</label>
          <input class="cfg-input" id="cfg-pin-note" placeholder="e.g. High-performance slot">
        </div>
      </div>
      <button class="cfg-action-btn primary" style="margin-top:14px" onclick="cfgAddPin()">+ Add Pin</button>
    </div>

    <div class="cfg-card">
      <div class="cfg-card-title">All Pins (${pins.length})</div>
      ${pins.length ? `
        <div class="cfg-table-toolbar">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" onchange="cfgPinSelectAll(this.checked)"> Select All
          </label>
          <div id="cfg-pins-bulk-actions" style="display:none;gap:6px">
            <button class="cfg-bulk-btn" onclick="cfgBulkEnablePins(true)">Enable</button>
            <button class="cfg-bulk-btn" onclick="cfgBulkEnablePins(false)">Disable</button>
            <button class="cfg-bulk-btn danger" onclick="cfgBulkDeletePins()">Delete</button>
          </div>
        </div>
        <div class="cfg-table-wrap">
          <table class="cfg-table" id="cfg-pins-table">
            <thead>
              <tr>
                <th class="cfg-cb-col"></th>
                <th>Studio</th>
                <th>Day</th>
                <th>Time</th>
                <th>Class</th>
                <th>Trainer</th>
                <th>Enabled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${pins.map((p, i) => `<tr class="cfg-pin-row"
                data-search="${rvEscapeAttr(((p.trainer||'')+' '+(p.class||'')).toLowerCase())}">
                <td class="cfg-cb-col">
                  <input type="checkbox" class="cfg-pin-cb" data-idx="${i}" onchange="cfgPinCheckChange()">
                </td>
                <td><span class="cfg-badge blue">${rvEscapeHtml((p.location||'').split(',')[0]||p.location||'')}</span></td>
                <td style="white-space:nowrap">${rvEscapeHtml(p.day||'')}</td>
                <td style="font-weight:700">${rvEscapeHtml(p.time||'')}</td>
                <td style="font-size:11px;max-width:180px">${rvEscapeHtml(p.class||'')}</td>
                <td style="font-weight:600">${rvEscapeHtml(p.trainer||'')}</td>
                <td>
                  <label class="cfg-toggle">
                    <input type="checkbox" ${p.enabled !== false ? 'checked' : ''}
                      onchange="cfgTogglePin(${i},this.checked)">
                    <span class="cfg-toggle-track"></span>
                  </label>
                </td>
                <td>
                  <button class="cfg-row-btn danger" onclick="cfgRemovePin(${i})">Remove</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="cfg-empty">No pins configured. Add one above.</div>'}
    </div>
  `;

  const bulkEl = document.getElementById('cfg-pins-bulk-actions');
  if (bulkEl) bulkEl.style.display = 'none';
}

function cfgFilterPins(q) {
  document.querySelectorAll('.cfg-pin-row').forEach(row => {
    const text = row.dataset.search || '';
    row.style.display = (!q || text.includes(q.toLowerCase())) ? '' : 'none';
  });
}

function cfgAddPin() {
  const trainer = (document.getElementById('cfg-pin-trainer')?.value || '').trim();
  const loc     = document.getElementById('cfg-pin-loc')?.value || '';
  const day     = document.getElementById('cfg-pin-day')?.value || '';
  const time    = document.getElementById('cfg-pin-time')?.value || '';
  const cls     = document.getElementById('cfg-pin-class')?.value || '';
  const note    = (document.getElementById('cfg-pin-note')?.value || '').trim();
  if (!loc || !day || !trainer) {
    showToast('Studio, day, and trainer are required', 'error'); return;
  }
  if (!_cfgDraft.manual_protected) _cfgDraft.manual_protected = [];
  _cfgDraft.manual_protected.push({
    id: 'pin-' + Date.now(),
    location: loc, day, time, class: cls, trainer,
    note: note || 'Manual pin', enabled: true,
  });
  cfgMarkDirty('pins');
  cfgRenderPins(document.getElementById('cfg-content'));
  showToast('Pin added', 'success');
}

function cfgTogglePin(i, enabled) {
  if (_cfgDraft.manual_protected?.[i]) {
    _cfgDraft.manual_protected[i].enabled = enabled;
    cfgMarkDirty('pins');
  }
}

function cfgRemovePin(i) {
  _cfgDraft.manual_protected.splice(i, 1);
  cfgMarkDirty('pins');
  cfgRenderPins(document.getElementById('cfg-content'));
}

function cfgPinSelectAll(checked) {
  document.querySelectorAll('.cfg-pin-cb').forEach(cb => { cb.checked = checked; });
  cfgPinCheckChange();
}

function cfgPinCheckChange() {
  const any = [...document.querySelectorAll('.cfg-pin-cb')].some(cb => cb.checked);
  const el = document.getElementById('cfg-pins-bulk-actions');
  if (el) el.style.display = any ? 'flex' : 'none';
}

function cfgBulkEnablePins(enabled) {
  document.querySelectorAll('.cfg-pin-cb:checked').forEach(cb => {
    const i = parseInt(cb.dataset.idx);
    if (_cfgDraft.manual_protected?.[i]) _cfgDraft.manual_protected[i].enabled = enabled;
  });
  cfgMarkDirty('pins');
  cfgRenderPins(document.getElementById('cfg-content'));
}

function cfgBulkDeletePins() {
  const toDelete = new Set([...document.querySelectorAll('.cfg-pin-cb:checked')].map(cb => parseInt(cb.dataset.idx)));
  _cfgDraft.manual_protected = (_cfgDraft.manual_protected || []).filter((_, i) => !toDelete.has(i));
  cfgMarkDirty('pins');
  cfgRenderPins(document.getElementById('cfg-content'));
}
