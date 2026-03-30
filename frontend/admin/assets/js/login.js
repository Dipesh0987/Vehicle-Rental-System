const state = {
  submitting: false,
};

const form = document.getElementById('adminLoginForm');
const usernameInput = document.getElementById('adminUsername');
const passwordInput = document.getElementById('adminPassword');
const submitButton = document.getElementById('adminLoginSubmit');
const submitLabel = document.getElementById('adminLoginSubmitLabel');
const banner = document.getElementById('adminLoginBanner');
const passwordToggle = document.getElementById('adminPasswordToggle');
const eyeOpenIcon = document.getElementById('adminEyeOpenIcon');
const eyeOffIcon = document.getElementById('adminEyeOffIcon');

init();

async function init() {
  const auth = window.AdminAuthService;

  if (usernameInput) {
    usernameInput.value = auth?.defaultUsername || 'admin';
  }

  bindPasswordToggle();

  if (!auth || typeof auth.signInWithUsername !== 'function') {
    showBanner('Admin authentication runtime is unavailable on this page.', 'error');
    return;
  }

  form?.addEventListener('submit', onSubmit);
}

async function onSubmit(event) {
  event.preventDefault();

  if (state.submitting) {
    return;
  }

  const auth = window.AdminAuthService;
  if (!auth || typeof auth.signInWithUsername !== 'function') {
    showBanner('Admin authentication service is unavailable.', 'error');
    return;
  }

  const username = String(usernameInput?.value || '').trim();
  const password = String(passwordInput?.value || '');

  if (!username || !password) {
    showBanner('Enter both username and password to continue.', 'error');
    return;
  }

  setSubmitting(true);
  hideBanner();

  try {
    await auth.signInWithUsername({ username, password });
    showBanner('Login successful. Redirecting to admin dashboard...', 'success');

    window.setTimeout(() => {
      window.location.replace(getNextPath());
    }, 320);
  } catch (error) {
    showBanner(auth.toPublicError(error, 'Unable to sign in to admin dashboard.'), 'error');
  } finally {
    setSubmitting(false);
  }
}

function getNextPath() {
  const params = new URLSearchParams(window.location.search);
  const rawNext = params.get('next') || 'index.html';

  const auth = window.AdminAuthService;
  if (auth) {
    const safeNext = typeof auth.sanitizeNextPath === 'function' ? auth.sanitizeNextPath(rawNext) : rawNext;

    if (typeof auth.buildAdminUrl === 'function') {
      return auth.buildAdminUrl(safeNext);
    }

    return safeNext;
  }

  try {
    return new URL('index.html', window.location.href).toString();
  } catch (_error) {
    return 'index.html';
  }
}

function setSubmitting(isSubmitting) {
  state.submitting = isSubmitting;

  if (submitButton) {
    submitButton.disabled = isSubmitting;
  }

  if (submitLabel) {
    submitLabel.textContent = isSubmitting ? 'Signing In...' : 'Sign In to Admin';
  }
}

function hideBanner() {
  if (!banner) {
    return;
  }

  banner.classList.add('hidden');
  banner.textContent = '';
}

function showBanner(message, variant = 'info') {
  if (!banner) {
    return;
  }

  const styleMap = {
    info: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-200',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    error: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300',
  };

  banner.className = `rounded-2xl border px-4 py-3 text-sm font-semibold ${styleMap[variant] || styleMap.info}`;
  banner.textContent = String(message || 'Unable to continue right now.');
}

function bindPasswordToggle() {
  passwordToggle?.addEventListener('click', () => {
    if (!passwordInput) {
      return;
    }

    const currentType = passwordInput.getAttribute('type') === 'password' ? 'password' : 'text';
    const nextType = currentType === 'password' ? 'text' : 'password';

    passwordInput.setAttribute('type', nextType);
    passwordToggle.setAttribute('aria-label', nextType === 'password' ? 'Show password' : 'Hide password');

    eyeOpenIcon?.classList.toggle('hidden', nextType === 'text');
    eyeOffIcon?.classList.toggle('hidden', nextType === 'password');
  });
}
