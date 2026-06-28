// ============================================================
// CONFIGURATOR — Shell: layout, nav, state, save
// ============================================================

let _cfgDraft = null;
let _profilesDraft = null;
let _cfgDirty = new Set();
let _cfgSection = 'trainers';
let _cfgSelected = new Set();

const CFG_NAV = [
  { group: 'PEOPLE', items: [
    { id: 'trainers',       label: 'Trainers',        icon: '👥' },
    { id: 'certifications', label: 'Certifications',  icon: '🏅' },
    { id: 'availability',   label: 'Availability',    icon: '🗓'  },
    { id: 'leave',          label: 'Leave & Off Days', icon: '🏖' },
  ]},
  { group: 'SCHEDULE', items: [
    { id: 'targets',   label: 'Daily Targets', icon: '🎯' },
    { id: 'classmix',  label: 'Class Mix',     icon: '📊' },
    { id: 'formats',   label: 'Formats',       icon: '📋' },
  ]},
  { group: 'RULES', items: [
    { id: 'customrules', label: 'Custom Rules',    icon: '⚙️' },
    { id: 'pins',        label: 'Pinned Classes',  icon: '📌' },
  ]},
  { group: 'SYSTEM', items: [
    { id: 'ai',        label: 'AI & Generation', icon: '🤖' },
    { id: 'quality',   label: 'Quality Gates',   icon: '🔒' },
    { id: 'locations', label: 'Locations',       icon: '🏢' },
  ]},
];

const CFG_SECTION_RENDER = {};

async function renderConfigurator(area) {
  area.innerHTML = `
    <div class="cfg-shell" id="cfg-shell">
      <aside class="cfg-rail">
        <div class="cfg-rail-header">
          <div class="cfg-rail-title">Configurator</div>
          <div class="cfg-rail-sub">Source of truth for all generation</div>
        </div>
        <nav class="cfg-rail-nav" id="cfg-rail-nav"></nav>
        <div class="cfg-rail-footer">
          <button class="cfg-save-all-btn" onclick="cfgSaveAll()">Save All Changes</button>
          <button class="cfg-export-btn" onclick="cfgExportAll()">Export JSON</button>
        </div>
      </aside>
      <div class="cfg-content-wrap">
        <div class="cfg-content" id="cfg-content">
          <div class="cfg-loading">Loading configuration…</div>
        </div>
      </div>
    </div>
  `;
  cfgRenderNav();
  await cfgLoadData();
  cfgSetSection(_cfgSection);
}

async function cfgLoadData() {
  try {
    const [cfg, profiles] = await Promise.all([
      schedulerFetch('/api/schedule-config').then(r => r.json()).catch(() => ({})),
      schedulerFetch('/api/trainer-profiles').then(r => r.json()).catch(() => []),
    ]);
    _cfgDraft = (cfg && !cfg.error) ? cfg : {
      targets: {}, manual_protected: [], manual_excluded: [],
      custom_rules: [], leave_periods: [], off_days: [],
      inactive_trainers: [], class_mix: {}, settings_options: {}
    };
    _profilesDraft = Array.isArray(profiles) ? profiles : [];
    // Keep existing globals in sync so other parts of app still work
    if (typeof _settSchedConfig !== 'undefined') _settSchedConfig = _cfgDraft;
    if (typeof _settTrainerProfiles !== 'undefined') _settTrainerProfiles = _profilesDraft;
    _cfgDirty.clear();
    cfgRenderNav();
  } catch (e) {
    console.error('cfgLoadData', e);
    showToast('Failed to load config', 'error');
  }
}

function cfgRenderNav() {
  const nav = document.getElementById('cfg-rail-nav');
  if (!nav) return;
  nav.innerHTML = CFG_NAV.map(g => `
    <div class="cfg-nav-group">${g.group}</div>
    ${g.items.map(item => `
      <button class="cfg-nav-item ${_cfgSection === item.id ? 'active' : ''}"
        onclick="cfgSetSection('${item.id}')">
        <span class="cfg-nav-icon">${item.icon}</span>
        <span class="cfg-nav-label">${item.label}</span>
        ${_cfgDirty.has(item.id) ? '<span class="cfg-dirty-dot"></span>' : ''}
      </button>
    `).join('')}
  `).join('');
}

function cfgSetSection(id) {
  _cfgSection = id;
  _cfgSelected.clear();
  cfgRenderNav();
  const content = document.getElementById('cfg-content');
  if (!content) return;
  const fn = CFG_SECTION_RENDER[id];
  if (fn) {
    fn(content);
  } else {
    content.innerHTML = `<div class="cfg-loading">Section "${id}" not yet loaded.</div>`;
  }
}

function cfgMarkDirty(section) {
  _cfgDirty.add(section);
  cfgRenderNav();
  const btn = document.querySelector('.cfg-save-all-btn');
  if (btn) btn.classList.add('has-changes');
}

function cfgMarkClean(section) {
  if (section === '*') {
    _cfgDirty.clear();
  } else {
    _cfgDirty.delete(section);
  }
  if (_cfgDirty.size === 0) {
    const btn = document.querySelector('.cfg-save-all-btn');
    if (btn) btn.classList.remove('has-changes');
  }
  cfgRenderNav();
}

async function cfgSaveAll() {
  const btn = document.querySelector('.cfg-save-all-btn');
  if (btn) btn.disabled = true;
  try {
    const dirty = [..._cfgDirty];
    if (!dirty.length) { showToast('No unsaved changes', ''); return; }
    const scheduleDirtySections = ['targets','classmix','customrules','pins','leave','quality','locations','ai'];
    const profileDirtySections = ['trainers','certifications','availability'];
    const needsSchedule = dirty.some(s => scheduleDirtySections.includes(s) || s === 'leave');
    const needsProfiles = dirty.some(s => profileDirtySections.includes(s));
    const saves = [];
    if (needsSchedule) saves.push(cfgSaveScheduleConfig());
    if (needsProfiles) saves.push(cfgSaveProfiles());
    await Promise.all(saves);
    cfgMarkClean('*');
    showToast('All changes saved', 'success');
  } catch (e) {
    showToast('Save failed: ' + (e.message || e), 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function cfgSaveScheduleConfig() {
  const r = await schedulerFetch('/api/save-schedule-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(_cfgDraft),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'Schedule config save failed');
  if (typeof _settSchedConfig !== 'undefined') _settSchedConfig = _cfgDraft;
}

async function cfgSaveProfiles() {
  const r = await schedulerFetch('/api/save-trainer-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(_profilesDraft),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'Trainer profiles save failed');
  if (typeof _settTrainerProfiles !== 'undefined') _settTrainerProfiles = _profilesDraft;
}

function cfgBulkToggleRow(id, checked) {
  if (checked) _cfgSelected.add(id);
  else _cfgSelected.delete(id);
}

function cfgBulkClearSelection() {
  _cfgSelected.clear();
  document.querySelectorAll('.cfg-row-cb, .cfg-cert-cb, .cfg-pin-cb, .cfg-rule-cb').forEach(cb => { cb.checked = false; });
}

function cfgExportAll() {
  const data = { schedule_config: _cfgDraft, trainer_profiles: _profilesDraft };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'configurator-export-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Config exported', 'success');
}
