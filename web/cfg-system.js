// ============================================================
// CONFIGURATOR — System: AI & Generation, Quality Gates, Locations
// ============================================================

CFG_SECTION_RENDER['ai']        = cfgRenderAI;
CFG_SECTION_RENDER['quality']   = cfgRenderQualityGates;
CFG_SECTION_RENDER['locations'] = cfgRenderLocations;

// ═══════════════════════════════════════════════════════════
// AI & GENERATION
// ═══════════════════════════════════════════════════════════

function cfgRenderAI(container) {
  const opts = _cfgDraft?.settings_options || {};

  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">AI & Generation</div>
        <div class="cfg-section-desc">AI provider, model, API keys, scoring weights, and generation behavior.</div>
      </div>
      <div class="cfg-section-actions">
        <button class="cfg-action-btn primary" onclick="cfgSaveAI()">Save AI Settings</button>
      </div>
    </div>

    <div class="cfg-cards-row">
      <div class="cfg-card">
        <div class="cfg-card-title">Primary AI Provider</div>
        <div class="cfg-form-grid">
          <div class="cfg-form-field">
            <label>Provider</label>
            <select class="cfg-select" id="cfg-ai-provider">
              <option value="openrouter" ${(opts.ai_provider || 'openrouter') === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
              <option value="openai"     ${opts.ai_provider === 'openai'     ? 'selected' : ''}>OpenAI</option>
              <option value="deepseek"   ${opts.ai_provider === 'deepseek'   ? 'selected' : ''}>DeepSeek</option>
            </select>
          </div>
          <div class="cfg-form-field">
            <label>Model ID</label>
            <input class="cfg-input" id="cfg-ai-model"
              value="${rvEscapeHtml(opts.ai_model || 'gpt-4.1-mini')}" placeholder="e.g. gpt-4.1-mini">
          </div>
          <div class="cfg-form-field">
            <label>Backup Model ID</label>
            <input class="cfg-input" id="cfg-ai-backup"
              value="${rvEscapeHtml(opts.ai_backup_model || '')}" placeholder="fallback model">
          </div>
          <div class="cfg-form-field">
            <label>API Key</label>
            <input class="cfg-input" id="cfg-ai-key" type="password"
              value="${opts.ai_api_key ? '••••••••' : ''}"
              placeholder="sk-…" autocomplete="new-password">
          </div>
          <div class="cfg-form-field">
            <label>Base URL (leave blank for default)</label>
            <input class="cfg-input" id="cfg-ai-base-url"
              value="${rvEscapeHtml(opts.ai_base_url || '')}"
              placeholder="https://openrouter.ai/api/v1">
          </div>
        </div>
      </div>

      <div class="cfg-card">
        <div class="cfg-card-title">DeepSeek Configuration</div>
        <div class="cfg-form-grid">
          <div class="cfg-form-field">
            <label>DeepSeek Model</label>
            <input class="cfg-input" id="cfg-ds-model"
              value="${rvEscapeHtml(opts.deepseek_model || 'deepseek-v4-flash')}"
              placeholder="deepseek-v4-flash">
          </div>
          <div class="cfg-form-field">
            <label>DeepSeek API Key</label>
            <input class="cfg-input" id="cfg-ds-key" type="password"
              value="${opts.deepseek_api_key ? '••••••••' : ''}"
              placeholder="sk-…" autocomplete="new-password">
          </div>
          <div class="cfg-form-field">
            <label>DeepSeek Base URL</label>
            <input class="cfg-input" id="cfg-ds-base-url"
              value="${rvEscapeHtml(opts.deepseek_base_url || 'https://api.deepseek.com')}"
              placeholder="https://api.deepseek.com">
          </div>
        </div>
      </div>
    </div>

    <div class="cfg-card" style="margin-top:16px">
      <div class="cfg-card-title">Scoring Weights</div>
      <div style="font-size:12px;color:#64748B;margin-bottom:14px">
        Weights must not need to sum to 1.0 — the optimizer normalises them. Adjust to shift scoring emphasis.
      </div>
      <div class="cfg-weights-grid">
        ${[
          ['score_weight_checkin', 'Avg Check-in Weight',     opts.score_weight_checkin ?? 0.40],
          ['score_weight_fill',    'Fill Rate Weight',         opts.score_weight_fill    ?? 0.30],
          ['score_weight_trend',   'Trend / Recency Weight',  opts.score_weight_trend   ?? 0.15],
          ['score_weight_tier',    'Trainer Tier Weight',     opts.score_weight_tier    ?? 0.15],
        ].map(([key, label, val]) => `
          <div class="cfg-weight-row">
            <span class="cfg-weight-label">${label}</span>
            <input class="cfg-range" type="range" min="0" max="1" step="0.01"
              id="cfg-w-${key}" value="${Number(val).toFixed(2)}"
              oninput="document.getElementById('cfg-wv-${key}').textContent=(parseFloat(this.value)*100).toFixed(0)+'%'">
            <span class="cfg-weight-val" id="cfg-wv-${key}">${(Number(val) * 100).toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="cfg-card" style="margin-top:16px">
      <div class="cfg-card-title">Generation Behavior</div>
      <div class="cfg-form-grid">
        ${[
          ['prefer_tier1_first',       'Prefer Tier 1 trainers first as primary capacity pool',         opts.prefer_tier1_first       !== false],
          ['enforce_am_pm_split',      'Enforce AM/PM split (no trainer in both shifts same day)',       opts.enforce_am_pm_split      !== false],
          ['allow_parallel_rooms',     'Allow parallel room use during peak clusters',                  opts.allow_parallel_rooms     !== false],
          ['auto_pin_high_performers', 'Auto-pin historically high-performing slots (score ≥ 80)',     opts.auto_pin_high_performers !== false],
          ['use_ai_optimization',      'Use AI optimization pass after standard generation',             opts.use_ai_optimization      !== false],
        ].map(([key, label, val]) => `
          <div class="cfg-form-field">
            <label>${label}</label>
            <label class="cfg-toggle">
              <input type="checkbox" id="cfg-gen-${key}" ${val ? 'checked' : ''}>
              <span class="cfg-toggle-track"></span>
            </label>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function cfgSaveAI() {
  if (!_cfgDraft.settings_options) _cfgDraft.settings_options = {};
  const o = _cfgDraft.settings_options;
  o.ai_provider    = document.getElementById('cfg-ai-provider')?.value || 'openrouter';
  o.ai_model       = (document.getElementById('cfg-ai-model')?.value    || '').trim();
  o.ai_backup_model = (document.getElementById('cfg-ai-backup')?.value  || '').trim();
  o.ai_base_url    = (document.getElementById('cfg-ai-base-url')?.value || '').trim();
  o.deepseek_model    = (document.getElementById('cfg-ds-model')?.value    || '').trim();
  o.deepseek_base_url = (document.getElementById('cfg-ds-base-url')?.value || '').trim();
  // Only write API keys if changed (not placeholder)
  const aiKey = document.getElementById('cfg-ai-key')?.value || '';
  if (aiKey && !aiKey.startsWith('••')) o.ai_api_key = aiKey.trim();
  const dsKey = document.getElementById('cfg-ds-key')?.value || '';
  if (dsKey && !dsKey.startsWith('••')) o.deepseek_api_key = dsKey.trim();
  // Weights
  ['score_weight_checkin', 'score_weight_fill', 'score_weight_trend', 'score_weight_tier'].forEach(key => {
    const el = document.getElementById('cfg-w-' + key);
    if (el) o[key] = parseFloat(el.value);
  });
  // Gen behavior
  ['prefer_tier1_first','enforce_am_pm_split','allow_parallel_rooms','auto_pin_high_performers','use_ai_optimization'].forEach(key => {
    const el = document.getElementById('cfg-gen-' + key);
    if (el) o[key] = el.checked;
  });
  try {
    await cfgSaveScheduleConfig();
    cfgMarkClean('ai');
    showToast('AI settings saved', 'success');
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// QUALITY GATES
// ═══════════════════════════════════════════════════════════

function cfgRenderQualityGates(container) {
  const opts = _cfgDraft?.settings_options || {};

  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Quality Gates</div>
        <div class="cfg-section-desc">Thresholds that exclude proven weak historical slots from generated schedules. Slots below both thresholds are not assigned unless manually pinned.</div>
      </div>
      <div class="cfg-section-actions">
        <button class="cfg-action-btn primary" onclick="cfgSaveQuality()">Save Gates</button>
      </div>
    </div>

    <div class="cfg-cards-row">
      <div class="cfg-card">
        <div class="cfg-card-title">Exclusion Thresholds</div>
        <div style="font-size:12px;color:#64748B;margin-bottom:16px">
          Any repeated historical slot below either threshold is excluded from generation. Manually pinned slots bypass this gate.
        </div>

        <div class="cfg-quality-gate-row">
          <div class="cfg-quality-gate-label">
            <div class="cfg-quality-gate-name">Avg Check-in Floor</div>
            <div class="cfg-quality-gate-desc">Exclude slots with avg check-ins below this number (default: 3.0)</div>
          </div>
          <div class="cfg-quality-gate-input">
            <input class="cfg-input" type="number" id="cfg-q-checkin"
              min="0" max="50" step="0.5"
              value="${Number(opts.quality_checkin_floor ?? 3.0)}">
          </div>
        </div>

        <div class="cfg-quality-gate-row">
          <div class="cfg-quality-gate-label">
            <div class="cfg-quality-gate-name">Fill Rate Floor</div>
            <div class="cfg-quality-gate-desc">Exclude slots with fill rate below this percentage (default: 22%)</div>
          </div>
          <div class="cfg-quality-gate-input">
            <input class="cfg-input" type="number" id="cfg-q-fill"
              min="0" max="100" step="1"
              value="${Number(opts.quality_fill_floor ?? 22)}">
          </div>
        </div>

        <div class="cfg-quality-gate-row">
          <div class="cfg-quality-gate-label">
            <div class="cfg-quality-gate-name">Score Floor</div>
            <div class="cfg-quality-gate-desc">Non-pinned generated rows below this score are not accepted as optimized output (default: 50)</div>
          </div>
          <div class="cfg-quality-gate-input">
            <input class="cfg-input" type="number" id="cfg-q-score"
              min="0" max="100" step="1"
              value="${Number(opts.quality_score_floor ?? 50)}">
          </div>
        </div>
      </div>

      <div class="cfg-card">
        <div class="cfg-card-title">CLAUDE.md Defaults</div>
        <div style="font-size:12px;color:#64748B;margin-bottom:12px">Canonical defaults from project rulebook. Saved settings above override these.</div>
        <div class="cfg-info-block">
          <div class="cfg-info-row">
            <span>Avg check-in floor</span>
            <strong>3.0</strong>
          </div>
          <div class="cfg-info-row">
            <span>Fill rate floor</span>
            <strong>22%</strong>
          </div>
          <div class="cfg-info-row">
            <span>Score floor (acceptance)</span>
            <strong>50 / 100</strong>
          </div>
          <div class="cfg-info-row">
            <span>Trainer tier priority</span>
            <strong>Tier 1 first</strong>
          </div>
          <div class="cfg-info-row">
            <span>Max trainer hours / week</span>
            <strong>15h (hard cap)</strong>
          </div>
          <div class="cfg-info-row">
            <span>Max trainer hours / day</span>
            <strong>4h</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function cfgSaveQuality() {
  if (!_cfgDraft.settings_options) _cfgDraft.settings_options = {};
  _cfgDraft.settings_options.quality_checkin_floor = parseFloat(document.getElementById('cfg-q-checkin')?.value) || 3.0;
  _cfgDraft.settings_options.quality_fill_floor    = parseFloat(document.getElementById('cfg-q-fill')?.value)    || 22;
  _cfgDraft.settings_options.quality_score_floor   = parseInt(document.getElementById('cfg-q-score')?.value)     || 50;
  try {
    await cfgSaveScheduleConfig();
    cfgMarkClean('quality');
    showToast('Quality gates saved', 'success');
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// LOCATIONS
// ═══════════════════════════════════════════════════════════

const CFG_LOC_FLOORS = {
  'Kwality House, Kemps Corner': 70,
  'Supreme HQ, Bandra': 65,
  'Kenkere House': 55,
  'Courtside': 7,
  'Copper & Cloves': 7,
};

function cfgRenderLocations(container) {
  const opts = _cfgDraft?.settings_options || {};
  const peakClusters = opts.peak_clusters || {};

  container.innerHTML = `
    <div class="cfg-section-header">
      <div>
        <div class="cfg-section-title">Locations</div>
        <div class="cfg-section-desc">Weekly assignment floors and peak time clusters per studio.</div>
      </div>
      <div class="cfg-section-actions">
        <button class="cfg-action-btn primary" onclick="cfgSaveLocations()">Save Locations</button>
      </div>
    </div>

    <div class="cfg-card" style="margin-bottom:16px">
      <div class="cfg-card-title">Weekly Assignment Floors</div>
      <div style="font-size:12px;color:#64748B;margin-bottom:14px">
        Minimum assignments the optimizer must produce each week per studio. The optimizer may exceed these within daily max caps.
      </div>
      <div class="cfg-table-wrap">
        <table class="cfg-table">
          <thead>
            <tr>
              <th>Studio</th>
              <th style="width:120px">Weekly Min</th>
              <th>CLAUDE.md Default</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${CFG_LOCS_ALL.map(loc => {
              const locKey = 'floor_' + loc.replace(/[^a-z0-9]/gi, '_');
              const savedFloor = opts[locKey] !== undefined ? opts[locKey] : (CFG_LOC_FLOORS[loc] || 0);
              const canonical = CFG_LOC_FLOORS[loc] || 0;
              return `<tr>
                <td>
                  <div class="cfg-loc-name">${rvEscapeHtml(loc.split(',')[0])}</div>
                  <div class="cfg-loc-sub">${rvEscapeHtml(loc)}</div>
                </td>
                <td>
                  <input class="cfg-input" type="number" min="0" max="500"
                    id="cfg-floor-${loc.replace(/[^a-z0-9]/gi,'_')}"
                    value="${savedFloor}" style="width:80px">
                </td>
                <td style="color:#64748B;font-size:12px">${canonical || '—'}</td>
                <td>
                  <span class="cfg-badge ${canonical ? 'blue' : 'grey'}">
                    ${canonical ? 'CLAUDE.md rule' : 'Custom'}
                  </span>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="cfg-card">
      <div class="cfg-card-title">Peak Time Clusters (Mumbai)</div>
      <div style="font-size:12px;color:#64748B;margin-bottom:16px">
        Parallel room usage is prioritized during these time slots. Add times to expand or remove to contract peak windows.
        Only applies to studios with multiple rooms.
      </div>
      ${['Kwality House, Kemps Corner', 'Supreme HQ, Bandra'].map(loc => {
        const locKey = loc.replace(/[^a-z0-9]/gi, '_');
        const times = peakClusters[loc] || ['08:00','08:15','08:30','08:45','11:00','11:15','11:30','11:45','18:00','18:15','18:30','18:45'];
        return `
          <div class="cfg-peak-cluster">
            <div class="cfg-peak-loc-name">${rvEscapeHtml(loc)}</div>
            <div class="cfg-peak-times" id="cfg-peaks-${locKey}">
              ${times.map((t, i) => `<span class="cfg-time-tag">
                ${rvEscapeHtml(t)}
                <button onclick="cfgRemovePeakTime('${rvEscapeAttr(loc)}',${i})" title="Remove">×</button>
              </span>`).join('')}
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
              <input class="cfg-input" type="time" id="cfg-peak-add-${locKey}"
                style="width:120px" step="900">
              <button class="cfg-action-btn" onclick="cfgAddPeakTime('${rvEscapeAttr(loc)}')">Add Time</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function cfgSaveLocations() {
  if (!_cfgDraft.settings_options) _cfgDraft.settings_options = {};
  // Save floors
  CFG_LOCS_ALL.forEach(loc => {
    const key = 'floor_' + loc.replace(/[^a-z0-9]/gi, '_');
    const inp = document.getElementById('cfg-floor-' + loc.replace(/[^a-z0-9]/gi, '_'));
    if (inp) _cfgDraft.settings_options[key] = parseInt(inp.value) || 0;
  });
  try {
    await cfgSaveScheduleConfig();
    cfgMarkClean('locations');
    showToast('Location settings saved', 'success');
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

function cfgAddPeakTime(loc) {
  const locKey = loc.replace(/[^a-z0-9]/gi, '_');
  const inp = document.getElementById('cfg-peak-add-' + locKey);
  if (!inp?.value) { showToast('Enter a time first', ''); return; }
  if (!_cfgDraft.settings_options) _cfgDraft.settings_options = {};
  if (!_cfgDraft.settings_options.peak_clusters) _cfgDraft.settings_options.peak_clusters = {};
  if (!_cfgDraft.settings_options.peak_clusters[loc]) {
    _cfgDraft.settings_options.peak_clusters[loc] = [
      '08:00','08:15','08:30','08:45','11:00','11:15','11:30','11:45','18:00','18:15','18:30','18:45'
    ];
  }
  if (!_cfgDraft.settings_options.peak_clusters[loc].includes(inp.value)) {
    _cfgDraft.settings_options.peak_clusters[loc].push(inp.value);
    _cfgDraft.settings_options.peak_clusters[loc].sort();
  }
  cfgMarkDirty('locations');
  cfgRenderLocations(document.getElementById('cfg-content'));
}

function cfgRemovePeakTime(loc, idx) {
  if (!_cfgDraft.settings_options?.peak_clusters?.[loc]) return;
  _cfgDraft.settings_options.peak_clusters[loc].splice(idx, 1);
  cfgMarkDirty('locations');
  cfgRenderLocations(document.getElementById('cfg-content'));
}
