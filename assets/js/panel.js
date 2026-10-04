/* Revenant user panel: Supabase login, subscription status and gated download. */

// Fill these in from Supabase -> Project Settings -> API. The anon key is meant to be public.
const PANEL = {
  supabaseUrl: 'https://qxuozdtqpelddmxxwslj.supabase.co',
  supabaseAnonKey: 'sb_publishable_ZsoQxVyiCnEMcxp2424IhA_UscMNbGg', // publishable key
  bucket: 'downloads',
  file: 'revenant.zip', // name of the file you uploaded to the bucket
};

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const toast = (msg) => window.FragLab?.toast?.(msg);

  const views = $$('.pn-view');
  const show = (name) => views.forEach((v) => { v.hidden = v.dataset.view !== name; });
  const setMsg = (el, text, kind = '') => { el.textContent = text; el.dataset.kind = kind; };
  const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('is-busy', on); };
  const fmtDate = (s) => new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  if (!PANEL.supabaseUrl || !PANEL.supabaseAnonKey || !window.supabase) return show('setup');

  const sb = window.supabase.createClient(PANEL.supabaseUrl, PANEL.supabaseAnonKey);
  const here = location.origin + location.pathname;

  const friendly = (error) => {
    const m = error?.message || '';
    if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link.';
    if (/already registered|already exists/i.test(m)) return 'That email already has an account. Log in instead.';
    if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
    if (/failed to fetch|network/i.test(m)) return "Couldn't reach the server. Check your connection.";
    return m || 'Something went wrong. Try again.';
  };

  const invalid = (form) => {
    for (const input of $$('input', form)) {
      if (!input.checkValidity()) {
        input.focus();
        return input.type === 'email' ? 'Enter a valid email.' : 'Password must be at least 6 characters.';
      }
    }
    return '';
  };

  // ---------- Log in / sign up ----------
  const authForm = $('#auth-form');
  const authMsg = $('.pn-msg', authForm);
  const authSubmit = $('#auth-submit');
  let mode = 'login';

  function setMode(next) {
    mode = next;
    $$('.pn-switch-btn').forEach((b) => {
      const on = b.dataset.mode === next;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $('#auth-title').textContent = next === 'login' ? 'Welcome back' : 'Create your account';
    authSubmit.textContent = next === 'login' ? 'Log in' : 'Sign up';
    authForm.elements.password.autocomplete = next === 'login' ? 'current-password' : 'new-password';
    $('#forgot-link').hidden = next !== 'login';
    setMsg(authMsg, '');
  }
  $$('.pn-switch-btn').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = invalid(authForm);
    if (bad) return setMsg(authMsg, bad, 'error');
    const email = authForm.elements.email.value.trim();
    const password = authForm.elements.password.value;

    busy(authSubmit, true);
    setMsg(authMsg, '');
    const { data, error } = mode === 'login'
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { emailRedirectTo: here } });
    busy(authSubmit, false);

    if (error) return setMsg(authMsg, friendly(error), 'error');
    if (mode === 'signup' && !data.session) {
      setMsg(authMsg, 'Account created. Check your email to confirm it, then log in.', 'ok');
    }
  });

  $$('[data-go]').forEach((b) => b.addEventListener('click', () => {
    const view = $(`[data-view="${b.dataset.go}"]`);
    $$('.pn-msg', view).forEach((m) => setMsg(m, ''));
    show(b.dataset.go);
    $('input', view)?.focus();
  }));

  // ---------- Password reset ----------
  const forgotForm = $('#forgot-form');
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('.pn-msg', forgotForm);
    const bad = invalid(forgotForm);
    if (bad) return setMsg(msg, bad, 'error');
    const btn = $('button[type="submit"]', forgotForm);
    busy(btn, true);
    const { error } = await sb.auth.resetPasswordForEmail(forgotForm.elements.email.value.trim(), { redirectTo: here });
    busy(btn, false);
    if (error) return setMsg(msg, friendly(error), 'error');
    setMsg(msg, 'If that email has an account, a reset link is on its way.', 'ok');
  });

  let recovering = /type=recovery/.test(location.hash);
  const recoverForm = $('#recover-form');
  recoverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('.pn-msg', recoverForm);
    const bad = invalid(recoverForm);
    if (bad) return setMsg(msg, bad, 'error');
    const btn = $('button[type="submit"]', recoverForm);
    busy(btn, true);
    const { data, error } = await sb.auth.updateUser({ password: recoverForm.elements.password.value });
    busy(btn, false);
    if (error) return setMsg(msg, friendly(error), 'error');
    recovering = false;
    history.replaceState(null, '', here);
    toast('Password updated');
    loadDash(data.user);
  });

  // ---------- Dashboard ----------
  const PLAN_DAYS = { day: 1, week: 7, month: 30, quarter: 90, year: 365 };
  const dlBtn = $('#dl-btn');
  const dlMsg = $('#dl-msg');

  function renderSub(state, sub) {
    const badge = $('#sub-badge');
    const plan = $('#sub-plan');
    const detail = $('#sub-detail');
    const bar = $('#sub-bar');
    const cta = $('#sub-cta');
    let active = false;

    bar.hidden = true;
    cta.hidden = true;

    if (state === 'loading') {
      badge.textContent = 'Checking';
      badge.dataset.kind = '';
      plan.textContent = '...';
      detail.textContent = '';
    } else if (state === 'error') {
      badge.textContent = 'Unavailable';
      badge.dataset.kind = '';
      plan.textContent = 'Unknown';
      detail.textContent = "Couldn't load your subscription. Refresh to try again.";
    } else if (!sub) {
      badge.textContent = 'None';
      badge.dataset.kind = 'none';
      plan.textContent = 'No plan';
      detail.textContent = "You don't have a subscription yet.";
      cta.hidden = false;
      cta.textContent = 'View plans';
    } else {
      plan.textContent = sub.plan;
      const ends = sub.expires_at ? new Date(sub.expires_at) : null;
      active = !ends || ends > new Date();
      badge.textContent = active ? 'Active' : 'Expired';
      badge.dataset.kind = active ? 'active' : 'expired';
      if (!ends) {
        detail.textContent = 'Lifetime access';
      } else if (active) {
        const left = Math.max(1, Math.ceil((ends - Date.now()) / 86400000));
        detail.textContent = `Expires ${fmtDate(ends)} · ${left} day${left === 1 ? '' : 's'} left`;
        const total = PLAN_DAYS[sub.plan.toLowerCase()] || 30;
        bar.hidden = false;
        $('#sub-bar-fill').style.width = `${Math.min(100, (left / total) * 100)}%`;
      } else {
        detail.textContent = `Expired on ${fmtDate(ends)}`;
        cta.hidden = false;
        cta.textContent = 'Renew';
      }
    }

    dlBtn.disabled = !active;
    $('#dl-note').textContent = active
      ? 'Latest build. Links expire after a minute, so grab a fresh one each time.'
      : 'An active subscription unlocks the download.';
    setMsg(dlMsg, '');
  }

  async function loadDash(user) {
    show('dash');
    $('#dash-name').textContent = user.email.split('@')[0];
    $('#acct-email').textContent = user.email;
    $('#acct-since').textContent = fmtDate(user.created_at);
    renderSub('loading');
    const { data, error } = await sb.from('subscriptions').select('plan, expires_at').eq('user_id', user.id).maybeSingle();
    renderSub(error ? 'error' : 'ready', data);
  }

  dlBtn.addEventListener('click', async () => {
    busy(dlBtn, true);
    setMsg(dlMsg, '');
    const { data, error } = await sb.storage.from(PANEL.bucket).createSignedUrl(PANEL.file, 60, { download: true });
    busy(dlBtn, false);
    if (error || !data?.signedUrl) {
      return setMsg(dlMsg, "Couldn't start the download. Make sure your subscription is active, then try again.", 'error');
    }
    location.href = data.signedUrl;
  });

  $('#logout').addEventListener('click', () => sb.auth.signOut());

  const pwForm = $('#pw-form');
  const pwMsg = $('#pw-msg');
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = invalid(pwForm);
    if (bad) return setMsg(pwMsg, bad, 'error');
    const btn = $('button[type="submit"]', pwForm);
    busy(btn, true);
    const { error } = await sb.auth.updateUser({ password: pwForm.elements.password.value });
    busy(btn, false);
    if (error) return setMsg(pwMsg, friendly(error), 'error');
    pwForm.reset();
    setMsg(pwMsg, 'Password updated.', 'ok');
  });

  // ---------- Routing ----------
  // Supabase recommends not awaiting its own calls inside this callback, hence the setTimeout.
  sb.auth.onAuthStateChange((event, session) => {
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') {
        recovering = true;
        return show('recover');
      }
      if (recovering && session) return show('recover');
      if (!session?.user) return show('auth');
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      loadDash(session.user);
    }, 0);
  });
})();
