// ============================================================
// CONFIGURATOR — People: Trainers, Certifications, Availability, Leave
// ============================================================

const CFG_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const CFG_LOCS = ["Kwality House, Kemps Corner","Supreme HQ, Bandra","Kenkere House","Courtside","Copper & Cloves"];

// ── Register with shell ──────────────────────────────────────
CFG_SECTION_RENDER['trainers']       = cfgRenderTrainers;
CFG_SECTION_RENDER['certifications'] = cfgRenderCertifications;
CFG_SECTION_RENDER['availability']   = cfgRenderAvailability;
CFG_SECTION_RENDER['leave']          = cfgRenderLeave;

// ═══════════════════════════════════════════════════════════
// TRAINERS
// ═══════════════════════════════════════════════════════════

function cfgRenderTrainers(container) {
  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Trainers</div>
        <div class="cfg-section-desc">Manage trainer profiles, tiers, activation status, and location access. Select rows to bulk-edit.</div>
      </div>
      <div class="cfg-section-actions">
        <input class="cfg-search" type="text" placeholder="Search trainers…" oninput="cfgFilterTrainers(this.value)">
        <button class="cfg-action-btn" onclick="cfgAddTrainer()">+ Add Trainer</button>
        <button class="cfg-action-btn primary" onclick="cfgSaveProfiles().then(()=>{cfgMarkClean('trainers');showToast('Trainers saved','success')}).catch(e=>showToast(e.message,'error'))">Save</button>
      </div>
    </div>
    <div id="cfg-trainers-bulk" class="cfg-cert-bulk-area"></div>
    <div class="cfg-table-wrap">
      <table class="cfg-table" id="cfg-trainers-table">
        <thead>
          <tr>
            <th class="cfg-cb-col">
              <input type="checkbox" title="Select all" onchange="cfgTrainerSelectAll(this.checked)">
            </th>
            <th>Name</th>
            <th>Tier</th>
            <th>Active</th>
            <th>Location Access</th>
            <th>Week Off</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="cfg-trainers-tbody"></tbody>
      </table>
    </div>
  `;
  cfgRenderTrainerRows('');
}

function cfgRenderTrainerRows(q) {
  const tbody = document.getElementById('cfg-trainers-tbody');
  if (!tbody || !_profilesDraft) return;
  const list = _profilesDraft.filter(t => !q || (t.name || '').toLowerCase().includes(q.toLowerCase()));
  tbody.innerHTML = list.map((t, i) => {
    const locs = Object.keys(t.locations || {});
    const weekOff = [...new Set(Object.values(t.locations || {}).flatMap(l => l.week_off_days || []))];
    const sel = _cfgSelected.has('trainer-' + i);
    return `<tr class="cfg-tr${sel ? ' selected' : ''}" data-idx="${i}">
      <td class="cfg-cb-col">
        <input type="checkbox" class="cfg-row-cb" ${sel ? 'checked' : ''}
          onchange="cfgBulkToggleRow('trainer-${i}',this.checked);cfgRefreshTrainerBulk()">
      </td>
      <td>
        <div class="cfg-trainer-name-cell">
          <span class="cfg-trainer-avatar">${((t.name||'?')[0]||'?').toUpperCase()}</span>
          <span class="cfg-editable" contenteditable="true"
            onblur="cfgTrainerSetField(${i},'name',this.textContent.trim())"
            onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
          >${rvEscapeHtml(t.name || '')}</span>
        </div>
      </td>
      <td>
        <select class="cfg-tier-select" onchange="cfgTrainerSetField(${i},'tier',parseInt(this.value))">
          <option value="1" ${t.tier === 1 ? 'selected' : ''}>T1</option>
          <option value="2" ${t.tier === 2 ? 'selected' : ''}>T2</option>
          <option value="3" ${t.tier === 3 ? 'selected' : ''}>T3</option>
          <option value="4" ${t.tier === 4 ? 'selected' : ''}>T4</option>
        </select>
      </td>
      <td>
        <label class="cfg-toggle" title="${t.active ? 'Active' : 'Inactive'}">
          <input type="checkbox" ${t.active ? 'checked' : ''}
            onchange="cfgTrainerSetActive(${i},this.checked)">
          <span class="cfg-toggle-track"></span>
        </label>
      </td>
      <td class="cfg-locs-cell">
        <div class="cfg-tag-list">
          ${locs.map(l => `<span class="cfg-tag">${(l.split(',')[0] || l).trim()}</span>`).join('')}
          ${!locs.length ? '<span style="color:#94A3B8;font-size:11px">None assigned</span>' : ''}
        </div>
      </td>
      <td>
        <div class="cfg-tag-list">
          ${weekOff.slice(0, 3).map(d => `<span class="cfg-tag subtle">${d.slice(0, 3)}</span>`).join('')}
          ${weekOff.length > 3 ? `<span class="cfg-tag subtle">+${weekOff.length - 3}</span>` : ''}
        </div>
      </td>
      <td>
        <button class="cfg-row-btn" onclick="cfgSetSection('availability');setTimeout(()=>{const el=document.querySelector('[data-trainer-name=\\'${rvEscapeAttr(t.name||'').replace(/'/g,"\\'")}\\']');if(el){el.classList.add('open');el.scrollIntoView({behavior:'smooth'})}},150)">Edit →</button>
      </td>
    </tr>`;
  }).join('');
}

function cfgFilterTrainers(q) {
  cfgRenderTrainerRows(q);
}

function cfgTrainerSetField(idx, field, value) {
  if (!_profilesDraft[idx]) return;
  _profilesDraft[idx][field] = field === 'tier' ? parseInt(value) : value;
  cfgMarkDirty('trainers');
}

function cfgTrainerSetActive(idx, active) {
  if (!_profilesDraft[idx]) return;
  _profilesDraft[idx].active = active;
  const name = _profilesDraft[idx].name;
  if (!_cfgDraft.inactive_trainers) _cfgDraft.inactive_trainers = [];
  if (!active) {
    if (!_cfgDraft.inactive_trainers.includes(name)) _cfgDraft.inactive_trainers.push(name);
  } else {
    _cfgDraft.inactive_trainers = _cfgDraft.inactive_trainers.filter(n => n !== name);
  }
  cfgMarkDirty('trainers');
}

function cfgTrainerSelectAll(checked) {
  (_profilesDraft || []).forEach((_, i) => {
    if (checked) _cfgSelected.add('trainer-' + i);
    else _cfgSelected.delete('trainer-' + i);
  });
  document.querySelectorAll('.cfg-row-cb').forEach(cb => { cb.checked = checked; });
  cfgRefreshTrainerBulk();
}

function cfgRefreshTrainerBulk() {
  const area = document.getElementById('cfg-trainers-bulk');
  if (!area) return;
  if (_cfgSelected.size === 0) { area.innerHTML = ''; return; }
  area.innerHTML = `<div class="cfg-bulk-bar">
    <span>${_cfgSelected.size} trainer${_cfgSelected.size === 1 ? '' : 's'} selected</span>
    <select id="cfg-btier" class="cfg-inline-select">
      <option value="">Set Tier…</option>
      <option value="1">Tier 1</option>
      <option value="2">Tier 2</option>
      <option value="3">Tier 3</option>
      <option value="4">Tier 4</option>
    </select>
    <button class="cfg-bulk-btn" onclick="cfgBulkTrainerTier()">Apply Tier</button>
    <button class="cfg-bulk-btn" onclick="cfgBulkTrainerActive(true)">Activate</button>
    <button class="cfg-bulk-btn" onclick="cfgBulkTrainerActive(false)">Deactivate</button>
    <button class="cfg-bulk-btn danger" onclick="cfgBulkClearSelection();cfgRenderTrainers(document.getElementById('cfg-content'))">✕ Clear</button>
  </div>`;
}

function cfgBulkTrainerTier() {
  const v = document.getElementById('cfg-btier')?.value;
  if (!v) return;
  const tier = parseInt(v);
  [..._cfgSelected].forEach(id => {
    const idx = parseInt(id.replace('trainer-', ''));
    if (_profilesDraft[idx]) _profilesDraft[idx].tier = tier;
  });
  cfgMarkDirty('trainers');
  const n = _cfgSelected.size;
  cfgBulkClearSelection();
  cfgRenderTrainers(document.getElementById('cfg-content'));
  showToast(`Set Tier ${tier} for ${n} trainer(s)`, 'success');
}

function cfgBulkTrainerActive(active) {
  const n = _cfgSelected.size;
  [..._cfgSelected].forEach(id => {
    const idx = parseInt(id.replace('trainer-', ''));
    if (_profilesDraft[idx]) cfgTrainerSetActive(idx, active);
  });
  cfgMarkDirty('trainers');
  cfgBulkClearSelection();
  cfgRenderTrainers(document.getElementById('cfg-content'));
  showToast(`${active ? 'Activated' : 'Deactivated'} ${n} trainer(s)`, 'success');
}

function cfgAddTrainer() {
  const name = prompt('New trainer name:');
  if (!name || !name.trim()) return;
  if ((_profilesDraft || []).some(t => t.name === name.trim())) {
    showToast('Trainer already exists', 'error'); return;
  }
  if (!_profilesDraft) _profilesDraft = [];
  _profilesDraft.push({
    name: name.trim(), tier: 2, active: true,
    locations: {}, qualifications: {},
    historic_week_off_days: []
  });
  cfgMarkDirty('trainers');
  cfgRenderTrainers(document.getElementById('cfg-content'));
  showToast(`Added ${name.trim()}`, 'success');
}

// ═══════════════════════════════════════════════════════════
// CERTIFICATIONS
// ═══════════════════════════════════════════════════════════

function cfgRenderCertifications(container) {
  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Certifications</div>
        <div class="cfg-section-desc">Control which trainers are certified for each class format. Select trainer rows → bulk grant or revoke. Click column +/− to change all.</div>
      </div>
      <div class="cfg-section-actions">
        <input class="cfg-search" type="text" placeholder="Filter trainers…" oninput="cfgFilterCerts(this.value)">
        <button class="cfg-action-btn primary" onclick="cfgSaveProfiles().then(()=>{cfgMarkClean('certifications');showToast('Certifications saved','success')}).catch(e=>showToast(e.message,'error'))">Save</button>
      </div>
    </div>
    <div class="cfg-cert-bulk-area" id="cfg-cert-bulk"></div>
    <div class="cfg-table-wrap cfg-cert-table-wrap">
      <table class="cfg-table cfg-cert-table" id="cfg-cert-table">
        <thead>
          <tr>
            <th class="cfg-cb-col"><input type="checkbox" onchange="cfgCertSelectAll(this.checked)" title="Select all"></th>
            <th class="cfg-cert-name-col">Trainer</th>
            <th style="min-width:28px">T</th>
            ${QUAL_KEYS.map(k => `<th class="cfg-cert-col" title="${rvEscapeAttr(QUAL_LABELS[k]||k)}">
              <div class="cfg-cert-head">
                <span>${rvEscapeHtml((QUAL_LABELS[k]||k).replace('Studio ',''))}</span>
                <div class="cfg-cert-col-actions">
                  <button onclick="cfgCertColumnAll('${k}',true)" title="Grant all">+</button>
                  <button onclick="cfgCertColumnAll('${k}',false)" title="Revoke all">−</button>
                </div>
              </div>
            </th>`).join('')}
          </tr>
        </thead>
        <tbody id="cfg-cert-tbody"></tbody>
      </table>
    </div>
  `;
  cfgRenderCertRows('');
}

function cfgRenderCertRows(q) {
  const tbody = document.getElementById('cfg-cert-tbody');
  if (!tbody || !_profilesDraft) return;
  const list = _profilesDraft.filter(t => !q || (t.name || '').toLowerCase().includes(q.toLowerCase()));
  tbody.innerHTML = list.map((t, i) => {
    const sel = _cfgSelected.has('cert-' + i);
    return `<tr class="cfg-tr${sel ? ' selected' : ''}" data-cert-idx="${i}">
      <td class="cfg-cb-col">
        <input type="checkbox" class="cfg-cert-cb" ${sel ? 'checked' : ''}
          onchange="cfgBulkToggleRow('cert-${i}',this.checked);cfgRefreshCertBulk()">
      </td>
      <td class="cfg-cert-name-col">
        <div class="cfg-trainer-name-cell">
          <span class="cfg-trainer-avatar">${((t.name||'?')[0]||'?').toUpperCase()}</span>
          <span style="font-size:11px;font-weight:600">${rvEscapeHtml(t.name || '')}</span>
        </div>
      </td>
      <td><span class="cfg-tier-badge">T${t.tier || '?'}</span></td>
      ${QUAL_KEYS.map(k => `<td class="cfg-cert-cell">
        <input type="checkbox" class="cfg-cert-check" data-idx="${i}" data-key="${k}"
          ${(t.qualifications || {})[k] ? 'checked' : ''}
          onchange="cfgCertToggle(${i},'${k}',this.checked)">
      </td>`).join('')}
    </tr>`;
  }).join('');
}

function cfgFilterCerts(q) { cfgRenderCertRows(q); }

function cfgCertToggle(idx, key, val) {
  if (!_profilesDraft[idx]) return;
  if (!_profilesDraft[idx].qualifications) _profilesDraft[idx].qualifications = {};
  _profilesDraft[idx].qualifications[key] = val;
  cfgMarkDirty('certifications');
}

function cfgCertSelectAll(checked) {
  _cfgSelected.clear();
  if (checked) (_profilesDraft || []).forEach((_, i) => _cfgSelected.add('cert-' + i));
  document.querySelectorAll('.cfg-cert-cb').forEach(cb => { cb.checked = checked; });
  cfgRefreshCertBulk();
}

function cfgRefreshCertBulk() {
  const area = document.getElementById('cfg-cert-bulk');
  if (!area) return;
  if (_cfgSelected.size === 0) { area.innerHTML = ''; return; }
  area.innerHTML = `<div class="cfg-bulk-bar">
    <span>${_cfgSelected.size} trainer${_cfgSelected.size === 1 ? '' : 's'} selected</span>
    <select id="cfg-bcert" class="cfg-inline-select">
      <option value="">Choose format…</option>
      ${QUAL_KEYS.map(k => `<option value="${k}">${rvEscapeHtml(QUAL_LABELS[k] || k)}</option>`).join('')}
    </select>
    <button class="cfg-bulk-btn" onclick="cfgBulkCert(true)">Grant</button>
    <button class="cfg-bulk-btn danger" onclick="cfgBulkCert(false)">Revoke</button>
    <button class="cfg-bulk-btn" onclick="cfgCertSelectAll(false)">✕ Clear</button>
  </div>`;
}

function cfgBulkCert(grant) {
  const key = document.getElementById('cfg-bcert')?.value;
  if (!key) { showToast('Choose a format first', ''); return; }
  const n = _cfgSelected.size;
  [..._cfgSelected].forEach(id => {
    const idx = parseInt(id.replace('cert-', ''));
    if (!_profilesDraft[idx]) return;
    if (!_profilesDraft[idx].qualifications) _profilesDraft[idx].qualifications = {};
    _profilesDraft[idx].qualifications[key] = grant;
  });
  cfgMarkDirty('certifications');
  cfgRenderCertRows('');
  showToast(`${grant ? 'Granted' : 'Revoked'} ${QUAL_LABELS[key] || key} for ${n} trainer(s)`, 'success');
}

function cfgCertColumnAll(key, val) {
  document.querySelectorAll(`.cfg-cert-check[data-key="${key}"]`).forEach(cb => {
    const idx = parseInt(cb.dataset.idx);
    if (!_profilesDraft[idx]) return;
    if (!_profilesDraft[idx].qualifications) _profilesDraft[idx].qualifications = {};
    _profilesDraft[idx].qualifications[key] = val;
    cb.checked = val;
  });
  cfgMarkDirty('certifications');
  showToast(`${val ? 'Granted' : 'Revoked'} ${QUAL_LABELS[key] || key} for all visible trainers`, 'success');
}

// ═══════════════════════════════════════════════════════════
// AVAILABILITY
// ═══════════════════════════════════════════════════════════

function cfgRenderAvailability(container) {
  if (!_profilesDraft) { container.innerHTML = '<div class="cfg-loading">Loading…</div>'; return; }
  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Availability</div>
        <div class="cfg-section-desc">Set trainer assignment days, time windows, and week-off days per location. Click a trainer card to expand.</div>
      </div>
      <div class="cfg-section-actions">
        <input class="cfg-search" type="text" placeholder="Filter trainers…" oninput="cfgFilterAvail(this.value)">
        <button class="cfg-action-btn primary" onclick="cfgSaveProfiles().then(()=>{cfgMarkClean('availability');showToast('Availability saved','success')}).catch(e=>showToast(e.message,'error'))">Save</button>
      </div>
    </div>
    <div id="cfg-avail-list">
      ${(_profilesDraft || []).map((t, i) => cfgAvailCard(t, i)).join('')}
    </div>
  `;
}

function cfgFilterAvail(q) {
  document.querySelectorAll('.cfg-avail-card').forEach(c => {
    const name = (c.dataset.trainerName || '').toLowerCase();
    c.style.display = (!q || name.includes(q.toLowerCase())) ? '' : 'none';
  });
}

function cfgAvailCard(t, i) {
  const locs = Object.entries(t.locations || {});
  const summary = locs.map(([l, v]) =>
    `${(l.split(',')[0] || l).trim()}: ${(v.available_days || []).map(d => d.slice(0, 3)).join('/')}`
  ).join(' · ');

  return `<div class="cfg-avail-card" data-trainer-name="${rvEscapeAttr((t.name || '').toLowerCase())}" data-idx="${i}">
    <div class="cfg-avail-card-header" onclick="this.closest('.cfg-avail-card').classList.toggle('open')">
      <div class="cfg-trainer-name-cell">
        <span class="cfg-trainer-avatar">${((t.name||'?')[0]||'?').toUpperCase()}</span>
        <strong style="font-size:13px">${rvEscapeHtml(t.name || '')}</strong>
        <span class="cfg-tier-badge">T${t.tier || '?'}</span>
        <span class="cfg-avail-summary">${rvEscapeHtml(summary || 'No locations configured')}</span>
      </div>
      <span class="cfg-chevron">▾</span>
    </div>
    <div class="cfg-avail-card-body">
      ${locs.length ? locs.map(([loc, ld]) => cfgAvailLocRow(i, loc, ld)).join('') :
        `<div style="color:#94A3B8;font-size:12px;padding:8px 0">No locations assigned. Go to Trainers to add location access.</div>`}
    </div>
  </div>`;
}

function cfgAvailLocRow(i, loc, ld) {
  const avDays = ld.available_days || [];
  const wkOff = ld.week_off_days || [];
  const startTime = ld.time_window?.start || '07:00';
  const endTime = ld.time_window?.end || '21:00';
  return `<div class="cfg-avail-loc-row">
    <div class="cfg-avail-loc-name">${rvEscapeHtml(loc)}</div>
    <div class="cfg-avail-loc-controls">
      <span class="cfg-avail-label">Assignment Days</span>
      <div class="cfg-day-pills">
        ${CFG_DAYS.map(d => `<label class="cfg-day-pill ${avDays.includes(d) ? 'active' : ''}">
          <input type="checkbox" style="display:none" ${avDays.includes(d) ? 'checked' : ''}
            onchange="cfgAvailDay(${i},'${loc}','${d}',this.checked,this.closest('label'))">
          ${d.slice(0, 3)}
        </label>`).join('')}
      </div>
      <span class="cfg-avail-label" style="margin-top:8px">Week Off</span>
      <div class="cfg-day-pills">
        ${CFG_DAYS.map(d => `<label class="cfg-day-pill week-off ${wkOff.includes(d) ? 'active' : ''}">
          <input type="checkbox" style="display:none" ${wkOff.includes(d) ? 'checked' : ''}
            onchange="cfgAvailWeekOff(${i},'${loc}','${d}',this.checked,this.closest('label'))">
          ${d.slice(0, 3)}
        </label>`).join('')}
      </div>
      <div class="cfg-avail-time-row" style="margin-top:8px">
        <label class="cfg-avail-label">From
          <input class="cfg-time-input" type="time" value="${startTime}"
            onchange="cfgAvailTime(${i},'${loc}','start',this.value)">
        </label>
        <label class="cfg-avail-label">To
          <input class="cfg-time-input" type="time" value="${endTime}"
            onchange="cfgAvailTime(${i},'${loc}','end',this.value)">
        </label>
      </div>
    </div>
  </div>`;
}

function cfgAvailDay(idx, loc, day, checked, pill) {
  const ld = _profilesDraft[idx]?.locations?.[loc];
  if (!ld) return;
  if (!ld.available_days) ld.available_days = [];
  if (checked) { if (!ld.available_days.includes(day)) ld.available_days.push(day); }
  else ld.available_days = ld.available_days.filter(d => d !== day);
  if (pill) pill.classList.toggle('active', checked);
  cfgMarkDirty('availability');
}

function cfgAvailWeekOff(idx, loc, day, checked, pill) {
  const ld = _profilesDraft[idx]?.locations?.[loc];
  if (!ld) return;
  if (!ld.week_off_days) ld.week_off_days = [];
  if (checked) { if (!ld.week_off_days.includes(day)) ld.week_off_days.push(day); }
  else ld.week_off_days = ld.week_off_days.filter(d => d !== day);
  if (pill) pill.classList.toggle('active', checked);
  cfgMarkDirty('availability');
}

function cfgAvailTime(idx, loc, field, value) {
  const ld = _profilesDraft[idx]?.locations?.[loc];
  if (!ld) return;
  if (!ld.time_window) ld.time_window = { start: '07:00', end: '21:00' };
  ld.time_window[field] = value;
  cfgMarkDirty('availability');
}

// ═══════════════════════════════════════════════════════════
// LEAVE & OFF DAYS
// ═══════════════════════════════════════════════════════════

function cfgRenderLeave(container) {
  const periods = _cfgDraft?.leave_periods || [];
  const offDays = _cfgDraft?.off_days || [];
  const trainerOptions = (_profilesDraft || []).map(t =>
    `<option value="${rvEscapeAttr(t.name || '')}"></option>`).join('');

  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Leave & Off Days</div>
        <div class="cfg-section-desc">Dated leave periods and one-off off days. Both are binding — trainer will not be assigned during these periods.</div>
      </div>
      <div class="cfg-section-actions">
        <button class="cfg-action-btn primary"
          onclick="cfgSaveScheduleConfig().then(()=>{cfgMarkClean('leave');showToast('Leave saved','success')}).catch(e=>showToast(e.message,'error'))">
          Save
        </button>
      </div>
    </div>

    <div class="cfg-leave-layout">
      <div class="cfg-card">
        <div class="cfg-card-title">Add Leave Period</div>
        <datalist id="cfg-leave-dl">${trainerOptions}</datalist>
        <div class="cfg-form-grid">
          <div class="cfg-form-field">
            <label>Trainer</label>
            <input class="cfg-input" id="cfg-lv-trainer" list="cfg-leave-dl" placeholder="Trainer name">
          </div>
          <div class="cfg-form-field">
            <label>From</label>
            <input class="cfg-input" id="cfg-lv-from" type="date">
          </div>
          <div class="cfg-form-field">
            <label>To</label>
            <input class="cfg-input" id="cfg-lv-to" type="date">
          </div>
          <div class="cfg-form-field">
            <label>Note (optional)</label>
            <input class="cfg-input" id="cfg-lv-note" placeholder="e.g. Annual leave">
          </div>
        </div>
        <button class="cfg-action-btn primary" style="margin-top:12px" onclick="cfgAddLeave()">Add Leave Period</button>
      </div>

      <div class="cfg-card">
        <div class="cfg-card-title">Add Off Day</div>
        <div class="cfg-form-grid">
          <div class="cfg-form-field">
            <label>Trainer</label>
            <input class="cfg-input" id="cfg-od-trainer" list="cfg-leave-dl" placeholder="Trainer name">
          </div>
          <div class="cfg-form-field">
            <label>Date</label>
            <input class="cfg-input" id="cfg-od-date" type="date">
          </div>
          <div class="cfg-form-field">
            <label>Note (optional)</label>
            <input class="cfg-input" id="cfg-od-note" placeholder="e.g. Personal day">
          </div>
        </div>
        <button class="cfg-action-btn primary" style="margin-top:12px" onclick="cfgAddOffDay()">Add Off Day</button>
      </div>
    </div>

    <div class="cfg-card" style="margin-top:16px">
      <div class="cfg-card-title">Leave Periods (${periods.length})</div>
      ${periods.length ? `<table class="cfg-table">
        <thead><tr><th>Trainer</th><th>From</th><th>To</th><th>Note</th><th></th></tr></thead>
        <tbody>
          ${periods.map((p, i) => `<tr>
            <td><strong>${rvEscapeHtml(p.trainer || '')}</strong></td>
            <td>${p.from || ''}</td>
            <td>${p.to || ''}</td>
            <td style="color:#64748B;font-size:11px">${rvEscapeHtml(p.note || '')}</td>
            <td><button class="cfg-row-btn danger" onclick="cfgRemoveLeave(${i})">Remove</button></td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<div class="cfg-empty">No leave periods recorded.</div>'}
    </div>

    <div class="cfg-card" style="margin-top:16px">
      <div class="cfg-card-title">Off Days (${offDays.length})</div>
      ${offDays.length ? `<table class="cfg-table">
        <thead><tr><th>Trainer</th><th>Date</th><th>Note</th><th></th></tr></thead>
        <tbody>
          ${offDays.map((o, i) => `<tr>
            <td><strong>${rvEscapeHtml(o.trainer || '')}</strong></td>
            <td>${o.date || ''}</td>
            <td style="color:#64748B;font-size:11px">${rvEscapeHtml(o.note || '')}</td>
            <td><button class="cfg-row-btn danger" onclick="cfgRemoveOffDay(${i})">Remove</button></td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<div class="cfg-empty">No off days recorded.</div>'}
    </div>
  `;
}

function cfgAddLeave() {
  const trainer = (document.getElementById('cfg-lv-trainer')?.value || '').trim();
  const from = document.getElementById('cfg-lv-from')?.value;
  const to = document.getElementById('cfg-lv-to')?.value;
  const note = (document.getElementById('cfg-lv-note')?.value || '').trim();
  if (!trainer || !from || !to) { showToast('Trainer, from and to required', 'error'); return; }
  if (!_cfgDraft.leave_periods) _cfgDraft.leave_periods = [];
  _cfgDraft.leave_periods.push({ trainer, from, to, note });
  cfgMarkDirty('leave');
  cfgRenderLeave(document.getElementById('cfg-content'));
  showToast('Leave period added', 'success');
}

function cfgAddOffDay() {
  const trainer = (document.getElementById('cfg-od-trainer')?.value || '').trim();
  const date = document.getElementById('cfg-od-date')?.value;
  const note = (document.getElementById('cfg-od-note')?.value || '').trim();
  if (!trainer || !date) { showToast('Trainer and date required', 'error'); return; }
  if (!_cfgDraft.off_days) _cfgDraft.off_days = [];
  _cfgDraft.off_days.push({ trainer, date, note });
  cfgMarkDirty('leave');
  cfgRenderLeave(document.getElementById('cfg-content'));
  showToast('Off day added', 'success');
}

function cfgRemoveLeave(i) {
  _cfgDraft.leave_periods.splice(i, 1);
  cfgMarkDirty('leave');
  cfgRenderLeave(document.getElementById('cfg-content'));
}

function cfgRemoveOffDay(i) {
  _cfgDraft.off_days.splice(i, 1);
  cfgMarkDirty('leave');
  cfgRenderLeave(document.getElementById('cfg-content'));
}
