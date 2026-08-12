let collaborationClient = null;
let collaborationSessionId = "main";
let collaborationUser = null;
let collaborationChannelStarted = false;

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

function collaborationSetLogoutVisible(visible) {
  const logoutBtn = document.getElementById("collaboration-logout-btn");
  if (logoutBtn) logoutBtn.hidden = !visible;
}

function collaborationSetAuthFeedback(message = "", type = "") {
  const feedback = document.getElementById("collaboration-auth-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = `collaboration-auth-feedback ${type}`;
}

function collaborationSetAuthBusy(busy) {
  document.querySelectorAll(".collaboration-auth-action").forEach(button => { button.disabled = busy; });
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
  if (!collaborationClient || !collaborationUser || collaborationChannelStarted) return;
  collaborationChannelStarted = true;
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
  collaborationSetAuthBusy(true);
  const { error } = await collaborationClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${window.location.pathname}` }
  });
  if (error) {
    collaborationSetAuthFeedback(error.message, "error");
    collaborationSetAuthBusy(false);
  }
}

async function collaborationEmailSignIn(event) {
  event.preventDefault();
  const email = document.getElementById("collaboration-email")?.value.trim();
  const password = document.getElementById("collaboration-password")?.value;
  if (!email || !password) return collaborationSetAuthFeedback("Enter your email and password.", "error");
  collaborationSetAuthBusy(true);
  const { error } = await collaborationClient.auth.signInWithPassword({ email, password });
  collaborationSetAuthBusy(false);
  if (error) collaborationSetAuthFeedback(error.message, "error");
}

async function collaborationEmailSignUp() {
  const email = document.getElementById("collaboration-email")?.value.trim();
  const password = document.getElementById("collaboration-password")?.value;
  if (!email || !password) return collaborationSetAuthFeedback("Enter your email and password to create an account.", "error");
  collaborationSetAuthBusy(true);
  const { data, error } = await collaborationClient.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
  });
  collaborationSetAuthBusy(false);
  if (error) return collaborationSetAuthFeedback(error.message, "error");
  collaborationSetAuthFeedback(
    data.session ? "Account created and signed in." : "Check your email to confirm your account, then return here to sign in.",
    "success"
  );
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
  collaborationClient.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      collaborationUser = null;
      collaborationSetLogoutVisible(false);
      collaborationSetGate(true);
      return;
    }
    collaborationUser = session.user;
    collaborationSetGate(false);
    collaborationSetLogoutVisible(true);
    collaborationStartRealtime();
  });
  const { data } = await collaborationClient.auth.getSession();
  collaborationUser = data.session?.user || null;
  if (collaborationUser) {
    collaborationSetGate(false);
    collaborationSetLogoutVisible(true);
    collaborationStartRealtime();
  } else {
    collaborationSetGate(true);
    collaborationSetLogoutVisible(false);
  }
}

async function collaborationSignOut() {
  await collaborationClient?.auth.signOut();
  window.location.reload();
}
