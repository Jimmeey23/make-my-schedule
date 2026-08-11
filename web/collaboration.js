let collaborationClient = null;
let collaborationSessionId = "main";
let collaborationUser = null;

async function collaborationAuthToken() {
  const session = (await collaborationClient?.auth.getSession())?.data?.session;
  return session?.access_token || "";
}

function collaborationInitials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function collaborationEscape(value) {
  const node = document.createElement("span");
  node.textContent = String(value || "");
  return node.innerHTML;
}

function collaborationSetGate(open, message = "Sign in to collaborate on live schedules.") {
  const gate = document.getElementById("collaboration-login");
  if (!gate) return;
  gate.hidden = !open;
  const hint = document.getElementById("collaboration-login-hint");
  if (hint) hint.textContent = message;
}

function collaborationRenderPresence(state) {
  const host = document.getElementById("collaboration-presence");
  if (!host) return;
  const peers = Object.values(state || {}).flat().filter(Boolean);
  const unique = [...new Map(peers.map(peer => [peer.id || peer.name, peer])).values()];
  host.innerHTML = unique.map(peer => {
    const label = collaborationEscape(peer.name || "Team member");
    const avatar = peer.avatar_url
      ? `<img src="${collaborationEscape(peer.avatar_url)}" alt="${label}">`
      : collaborationInitials(peer.name);
    return `<span class="collaboration-avatar" title="${label}" aria-label="${label}">${avatar}</span>`;
  }).join("");
  const count = document.getElementById("collaboration-presence-count");
  if (count) count.textContent = unique.length ? `${unique.length} online` : "Working solo";
}

async function collaborationReloadSchedule(scheduleData) {
  const next = scheduleData || await schedulerFetch("/schedule_data.json?ts=" + Date.now()).then(response => response.json());
  if (next?.locations && typeof SCHEDULE_DATA !== "undefined") {
    Object.keys(SCHEDULE_DATA).forEach(key => delete SCHEDULE_DATA[key]);
    Object.assign(SCHEDULE_DATA, next);
    if (typeof renderView === "function") renderView();
    if (typeof showToast === "function") showToast("Schedule updated by a collaborator", "success");
  }
}

async function collaborationLoadSharedSchedule() {
  if (!collaborationClient) return;
  const { data, error } = await collaborationClient
    .from("schedule_sessions")
    .select("schedule_data")
    .eq("id", collaborationSessionId)
    .maybeSingle();
  if (!error && data?.schedule_data?.locations) {
    await collaborationReloadSchedule(data.schedule_data);
  }
}

function collaborationStartRealtime() {
  if (!collaborationClient || !collaborationUser) return;
  collaborationLoadSharedSchedule();
  const channel = collaborationClient.channel(`schedule:${collaborationSessionId}`, {
    config: { presence: { key: collaborationUser.id } }
  });
  channel
    .on("presence", { event: "sync" }, () => collaborationRenderPresence(channel.presenceState()))
    .on("postgres_changes", {
      event: "*", schema: "public", table: "schedule_sessions", filter: `id=eq.${collaborationSessionId}`
    }, payload => collaborationReloadSchedule(payload.new?.schedule_data))
    .subscribe(status => {
      if (status !== "SUBSCRIBED") return;
      channel.track({
        id: collaborationUser.id,
        name: collaborationUser.user_metadata?.full_name || collaborationUser.email || "Team member",
        avatar_url: collaborationUser.user_metadata?.avatar_url || ""
      });
    });
}

async function collaborationSignIn() {
  const button = document.getElementById("collaboration-google-signin");
  if (button) button.disabled = true;
  const { error } = await collaborationClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${window.location.pathname}` }
  });
  if (error) {
    collaborationSetGate(true, error.message);
    if (button) button.disabled = false;
  }
}

async function collaborationRequireAuth() {
  const config = await fetch("/api/collaboration-config").then(response => response.json()).catch(() => ({}));
  if (!config.enabled || !window.supabase?.createClient) {
    collaborationSetGate(false);
    return;
  }
  collaborationSessionId = config.session_id || "main";
  collaborationClient = window.supabase.createClient(config.url, config.anon_key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const { data } = await collaborationClient.auth.getUser();
  collaborationUser = data.user;
  if (!collaborationUser) {
    collaborationSetGate(true);
    return new Promise(resolve => {
      collaborationClient.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) return;
        collaborationUser = session.user;
        collaborationSetGate(false);
        collaborationStartRealtime();
        resolve();
      });
    });
  }
  collaborationSetGate(false);
  collaborationStartRealtime();
}

async function collaborationSignOut() {
  await collaborationClient?.auth.signOut();
  window.location.reload();
}
