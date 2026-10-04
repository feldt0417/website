/* FragLab — site chrome: navigation, tabs, toasts, reveal animations. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  document.documentElement.classList.remove('no-js');

  // ---------- Toast ----------
  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2200);
  }

  // ---------- Clipboard + downloads ----------
  async function copy(text, message = 'Copied to clipboard') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      ta.remove();
    }
    toast(message);
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Downloaded ${filename}`);
  }

  // ---------- Header: scroll state, mobile menu, dropdowns ----------
  const header = $('.site-header');
  const navToggle = $('.nav-toggle');
  const navMenu = $('#nav-menu');

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    if (open) navMenu.style.setProperty('--menu-top', `${Math.round(header.getBoundingClientRect().bottom)}px`);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navMenu.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  }
  navToggle.addEventListener('click', () => setMenu(navToggle.getAttribute('aria-expanded') !== 'true'));

  function closeDropdowns(except) {
    $$('.has-dropdown').forEach((dd) => {
      if (dd === except) return;
      dd.classList.remove('is-open');
      $('.nav-link', dd).setAttribute('aria-expanded', 'false');
    });
  }
  $$('.has-dropdown').forEach((dd) => {
    const btn = $('.nav-link', dd);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !dd.classList.contains('is-open');
      closeDropdowns(dd);
      dd.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.has-dropdown')) closeDropdowns();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeDropdowns();
    if (navMenu.classList.contains('is-open')) {
      setMenu(false);
      navToggle.focus();
    }
  });

  // Close the mobile menu after following any in-page link.
  $$('#nav-menu a[href^="#"]').forEach((a) =>
    a.addEventListener('click', () => {
      setMenu(false);
      closeDropdowns();
    })
  );

  // ---------- Tool tabs ----------
  const tabs = $$('.tool-tab');

  function openTool(name, { scroll = false, focus = false } = {}) {
    const target = tabs.find((t) => t.dataset.tool === name);
    if (!target) return;
    tabs.forEach((tab) => {
      const selected = tab === target;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $('#' + tab.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) target.focus();
    if (scroll) $('#tools').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.dispatchEvent(new CustomEvent('fraglab:tool', { detail: name }));
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => openTool(tab.dataset.tool));
    tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        openTool(next.dataset.tool, { focus: true });
      }
    });
  });

  // Any link with data-tool-link jumps to that tool.
  $$('[data-tool-link]').forEach((link) =>
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openTool(link.dataset.toolLink, { scroll: true });
      history.replaceState(null, '', link.getAttribute('href'));
    })
  );

  // Deep links like /#tool-sens open the right tab on load.
  const hashTool = location.hash.match(/^#tool-(\w+)$/);
  if (hashTool) {
    openTool(hashTool[1]);
    requestAnimationFrame(() => $('#tools').scrollIntoView());
  }

  // ---------- Reveal on scroll ----------
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    document.documentElement.classList.add('no-observer');
  }

  // ---------- Misc ----------
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  window.FragLab = { toast, copy, download, openTool };
})();
