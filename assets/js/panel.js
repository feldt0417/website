/* Revenant user panel: login, subscription, crypto store, license keys and gated download. */

// From Supabase -> Project Settings -> API. The publishable key is meant to be public.
const PANEL = {
  supabaseUrl: 'https://qxuozdtqpelddmxxwslj.supabase.co',
  supabaseAnonKey: 'sb_publishable_ZsoQxVyiCnEMcxp2424IhA_UscMNbGg',
  bucket: 'downloads',
  file: 'revenant.zip', // name of the file you uploaded to the bucket
};

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const toast = (msg) => window.FragLab?.toast?.(msg);
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* storage unavailable */ } },
    del: (k) => { try { sessionStorage.removeItem(k); } catch { /* storage unavailable */ } },
  };

  const views = $$('.pn-view');
  const show = (name) => views.forEach((v) => { v.hidden = v.dataset.view !== name; });
  const setMsg = (el, text, kind = '') => { el.textContent = text; el.dataset.kind = kind; };
  const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('is-busy', on); };
  const fmtDate = (s) => new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!PANEL.supabaseUrl || !PANEL.supabaseAnonKey || !window.supabase) return show('setup');

  const sb = window.supabase.createClient(PANEL.supabaseUrl, PANEL.supabaseAnonKey);
  const here = location.origin + location.pathname;

  // ---------- Links coming back from the site and from NOWPayments ----------
  const params = new URLSearchParams(location.search);
  if (params.get('buy')) store.set('rv-buy', params.get('buy'));
  if (UUID.test(params.get('paid') || '')) store.set('rv-paid', params.get('paid'));
  if (params.has('cancelled')) {
    store.del('rv-paid');
    setTimeout(() => toast('Payment cancelled'), 300);
  }
  if (params.has('buy') || params.has('paid') || params.has('cancelled')) {
    history.replaceState(null, '', here + location.hash);
  }

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
        if (input.type === 'email') return 'Enter a valid email.';
        if (input.type === 'password') return 'Password must be at least 6 characters.';
        return 'Fill this in first.';
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

  function showAuth() {
    const want = store.get('rv-buy');
    const note = $('#auth-buy-note');
    const name = { week: 'Week', month: 'Month', lifetime: 'Lifetime' }[want];
    note.hidden = !name;
    if (name) note.textContent = `Log in or create an account to buy the ${name} plan. It activates on this account.`;
    show('auth');
  }

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

  // ---------- Dashboard state ----------
  const PLAN_DAYS = { day: 1, week: 7, month: 30, quarter: 90, year: 365 };
  const dlBtn = $('#dl-btn');
  const dlMsg = $('#dl-msg');
  let currentUser = null;
  let currentSub = null;
  let plans = [];

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
        const total = Math.max(PLAN_DAYS[sub.plan.toLowerCase()] || 30, left);
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

  async function loadSub() {
    renderSub('loading');
    const { data, error } = await sb.from('subscriptions').select('plan, expires_at').eq('user_id', currentUser.id).maybeSingle();
    currentSub = error ? null : data;
    renderSub(error ? 'error' : 'ready', data);
    renderStore();
  }

  async function loadDash(user) {
    currentUser = user;
    show('dash');
    $('#dash-name').textContent = user.email.split('@')[0];
    $('#acct-email').textContent = user.email;
    $('#acct-since').textContent = fmtDate(user.created_at);
    await loadPlans();
    await Promise.all([loadSub(), loadKeys()]);
    resumePayment();
    const want = store.get('rv-buy');
    if (want) {
      store.del('rv-buy');
      highlightPlan(want);
    }
  }

  // ---------- Download ----------
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

  // ---------- Store ----------
  const storeMsg = $('#store-msg');
  const perLabel = (days) => (days == null ? 'one time' : days === 7 ? '/ week' : days === 30 ? '/ month' : `/ ${days} days`);

  async function loadPlans() {
    if (plans.length) return;
    const { data } = await sb.from('plans').select('id, name, price_usd, days').eq('active', true).order('sort');
    plans = data || [];
  }

  function renderStore() {
    const wrap = $('#store-plans');
    const lifetime = currentSub && !currentSub.expires_at;
    if (!plans.length) {
      wrap.replaceChildren();
      setMsg(storeMsg, "The store isn't available right now. Refresh to try again.", 'error');
      return;
    }
    setMsg(storeMsg, lifetime ? 'You already have lifetime access, so there is nothing more to buy.' : '', lifetime ? 'ok' : '');
    wrap.replaceChildren(...plans.map((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${p.id === 'month' ? 'btn-primary' : 'btn-ghost'} pn-full`;
      btn.textContent = 'Pay with crypto';
      btn.disabled = lifetime;
      btn.addEventListener('click', () => checkout(p.id, btn));

      const card = document.createElement('div');
      card.className = 'pn-plan-card';
      card.dataset.plan = p.id;
      const name = document.createElement('p');
      name.className = 'pn-plan-name';
      name.textContent = p.name;
      const price = document.createElement('p');
      price.className = 'pn-plan-price';
      const num = document.createElement('span');
      num.textContent = `$${Number(p.price_usd).toFixed(2)}`;
      const per = document.createElement('span');
      per.className = 'pn-plan-per';
      per.textContent = perLabel(p.days);
      price.append(num, per);
      card.append(name, price, btn);
      return card;
    }));
  }

  function highlightPlan(id) {
    const card = $(`.pn-plan-card[data-plan="${CSS.escape(id)}"]`);
    if (!card) return;
    card.classList.add('is-pick');
    $('#store').scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.querySelector('button')?.focus({ preventScroll: true });
  }

  async function checkout(planId, btn) {
    $$('.pn-plan-card button').forEach((b) => { b.disabled = true; });
    btn.classList.add('is-busy');
    btn.textContent = 'Opening checkout...';
    setMsg(storeMsg, '');

    const { data, error } = await sb.functions.invoke('create-checkout', { body: { plan: planId } });
    let url = data?.url || '';
    try {
      const host = new URL(url).hostname;
      if (host !== 'nowpayments.io' && !host.endsWith('.nowpayments.io')) url = '';
    } catch { url = ''; }

    if (error || !url) {
      let msg = "Couldn't open the checkout. Try again in a minute.";
      try {
        const body = await error?.context?.json?.();
        if (body?.error) msg = body.error;
      } catch { /* keep the default message */ }
      renderStore();
      return setMsg(storeMsg, msg, 'error');
    }
    if (UUID.test(data.order_id || '')) store.set('rv-paid', data.order_id);
    location.href = url;
  }

  // ---------- Payment progress ----------
  const banner = $('#pay-banner');
  let pollTimer = 0;
  const PAY_TEXT = {
    pending: ['Waiting for your payment', "Finish paying on the NOWPayments page. If you've already sent it, this updates by itself."],
    waiting: ['Waiting for your payment', "Finish paying on the NOWPayments page. If you've already sent it, this updates by itself."],
    confirming: ['Payment found', 'Waiting for blockchain confirmations. This usually takes a few minutes.'],
    confirmed: ['Payment confirmed', 'Almost done, activating your plan...'],
    sending: ['Payment confirmed', 'Almost done, activating your plan...'],
    partially_paid: ['Payment too small', 'Less than the full amount arrived. Send the rest from the same payment page.'],
    review: ['Payment under review', "Your payment needs a quick manual check. Your plan will be activated once it's sorted."],
    expired: ['Payment expired', 'No payment arrived in time. You can start a new checkout below.'],
    failed: ['Payment failed', 'The payment did not go through. You can start a new checkout below.'],
    refunded: ['Payment refunded', 'This payment was refunded.'],
  };
  const FINAL = new Set(['paid', 'expired', 'failed', 'refunded', 'review']);

  function setBanner(kind, title, text, spinning) {
    banner.hidden = false;
    banner.dataset.kind = kind;
    $('#pay-title').textContent = title;
    $('#pay-text').textContent = text;
    $('#pay-spin').hidden = !spinning;
  }

  async function watchOrder(orderId) {
    clearTimeout(pollTimer);
    const started = Date.now();
    const tick = async () => {
      const { data } = await sb.from('orders').select('status, plan_id').eq('id', orderId).maybeSingle();
      if (!data) {
        store.del('rv-paid');
        banner.hidden = true;
        return;
      }
      if (data.status === 'paid') {
        store.del('rv-paid');
        const name = plans.find((p) => p.id === data.plan_id)?.name || 'Your';
        setBanner('ok', 'Payment received', `${name} plan is active. Your key is listed under Your keys.`, false);
        toast('Plan activated');
        await Promise.all([loadSub(), loadKeys()]);
        return;
      }
      const [title, text] = PAY_TEXT[data.status] || PAY_TEXT.pending;
      const final = FINAL.has(data.status);
      setBanner(final ? 'warn' : 'wait', title, text, !final);
      if (final) {
        store.del('rv-paid');
        return;
      }
      if (Date.now() - started > 60 * 60 * 1000) {
        setBanner('wait', title, 'Still waiting. Refresh this page later to check again.', false);
        return;
      }
      pollTimer = setTimeout(tick, 8000);
    };
    tick();
  }

  async function resumePayment() {
    const fromCheckout = store.get('rv-paid');
    if (fromCheckout && UUID.test(fromCheckout)) return watchOrder(fromCheckout);
    const since = new Date(Date.now() - 2 * 86400000).toISOString();
    const { data } = await sb
      .from('orders')
      .select('id')
      .in('status', ['confirming', 'confirmed', 'sending', 'partially_paid'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data?.[0]) watchOrder(data[0].id);
    else banner.hidden = true;
  }

  // ---------- Keys ----------
  async function loadKeys() {
    const list = $('#keys-list');
    const { data, error } = await sb
      .from('license_keys')
      .select('key, plan_id, redeemed_at, order_id')
      .order('redeemed_at', { ascending: false });
    if (error) {
      const li = document.createElement('li');
      li.className = 'pn-key-empty';
      li.textContent = "Couldn't load your keys. Refresh to try again.";
      return list.replaceChildren(li);
    }
    if (!data?.length) {
      const li = document.createElement('li');
      li.className = 'pn-key-empty';
      li.textContent = 'No keys yet. Buy a plan above and your key shows up here.';
      return list.replaceChildren(li);
    }
    list.replaceChildren(...data.map((k) => {
      const li = document.createElement('li');
      li.className = 'pn-key';
      const code = document.createElement('code');
      code.textContent = k.key;
      const meta = document.createElement('span');
      meta.className = 'pn-key-meta';
      const planName = plans.find((p) => p.id === k.plan_id)?.name || k.plan_id;
      meta.textContent = `${planName} · ${k.order_id ? 'Bought' : 'Redeemed'} ${fmtDate(k.redeemed_at)}`;
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'pn-copy';
      copy.setAttribute('aria-label', `Copy key ${k.key}`);
      copy.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-copy"/></svg>';
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(k.key);
          toast('Key copied');
        } catch {
          toast("Couldn't copy, select the key instead");
        }
      });
      const text = document.createElement('div');
      text.append(code, meta);
      li.append(text, copy);
      return li;
    }));
  }

  const redeemForm = $('#redeem-form');
  const redeemMsg = $('#redeem-msg');
  redeemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = invalid(redeemForm);
    if (bad) return setMsg(redeemMsg, 'Paste your key first.', 'error');
    const btn = $('button[type="submit"]', redeemForm);
    busy(btn, true);
    setMsg(redeemMsg, '');
    const { data, error } = await sb.rpc('redeem_key', { p_key: redeemForm.elements.key.value });
    busy(btn, false);
    if (error) {
      const m = error.message || '';
      return setMsg(redeemMsg, /invalid or already used|log in/i.test(m) ? m : "Couldn't redeem that key. Try again.", 'error');
    }
    redeemForm.reset();
    setMsg(redeemMsg, `Key redeemed. ${data?.plan || 'Your'} plan added.`, 'ok');
    toast('Key redeemed');
    await Promise.all([loadSub(), loadKeys()]);
  });

  // ---------- Account ----------
  $('#logout').addEventListener('click', () => {
    clearTimeout(pollTimer);
    sb.auth.signOut();
  });

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
      if (!session?.user) {
        clearTimeout(pollTimer);
        currentUser = null;
        return showAuth();
      }
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      if (currentUser?.id === session.user.id && event === 'SIGNED_IN') return;
      loadDash(session.user);
    }, 0);
  });
})();
