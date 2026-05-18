/**
 * Contact Page Module
 * Handles contact form submission, validation, and interactions
 */

class ContactPageModule {
  constructor() {
    this.form = document.getElementById('contactForm');
    this.init();
  }

  /**
   * Initialize the module and setup event listeners
   */
  init() {
    if (!this.form) {
      console.warn('Contact form not found');
      return;
    }

    this.setupFormHandlers();
    this.setupCopyToClipboard();
    this.setupPhoneLink();
    this.setupEmailLink();
    this.setupMapLink();
    this.setupIntersectionObserver();

    console.log('Contact page module initialized');
  }

  /**
   * Setup form submission handler
   */
  setupFormHandlers() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // Add input focus effects
    const inputs = this.form.querySelectorAll('input, textarea');
    inputs.forEach((input) => {
      input.addEventListener('focus', () => {
        input.closest('div')?.classList.add('focused');
      });

      input.addEventListener('blur', () => {
        input.closest('div')?.classList.remove('focused');
      });
    });
  }

  /**
   * Handle form submission — saves to Supabase contact_messages table
   */
  async handleFormSubmit() {
    const formData = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      subject: document.getElementById('subject').value,
      message: document.getElementById('message').value,
    };

    // Validate form
    if (!this.validateForm(formData)) {
      return;
    }

    // Disable submit button while saving
    const submitBtn = this.form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span style="opacity:.7">Sending…</span>';
    }

    try {
      // Attempt to save to Supabase
      let saved = false;
      if (window.SupabaseClient && typeof window.SupabaseClient.init === 'function') {
        const client = await window.SupabaseClient.init();
        if (client && typeof client.from === 'function') {
          const { error } = await client.from('contact_messages').insert([{
            name: formData.name.trim(),
            email: formData.email.trim(),
            subject: formData.subject.trim(),
            message: formData.message.trim(),
            status: 'unread',
          }]);
          if (error) {
            console.error('Supabase contact insert error:', error);
            throw error;
          }
          saved = true;
        }
      }

      if (!saved) {
        console.warn('Supabase not available — message not persisted to database');
      }

      // Track submission
      this.trackFormSubmission(formData);

      // Show success message
      this.showSuccessMessage();

      // Reset form
      this.form.reset();
    } catch (err) {
      console.error('Contact form submission failed:', err);
      this.showError('Failed to send message. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  }

  /**
   * Validate form data
   */
  validateForm(data) {
    if (!data.name.trim()) {
      this.showError('Please enter your name');
      return false;
    }

    if (!this.isValidEmail(data.email)) {
      this.showError('Please enter a valid email address');
      return false;
    }

    if (!data.subject.trim()) {
      this.showError('Please enter a subject');
      return false;
    }

    if (!data.message.trim()) {
      this.showError('Please enter your message');
      return false;
    }

    return true;
  }

  /**
   * Check if email is valid
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Show success message — themed toast matching website design
   */
  showSuccessMessage() {
    const toast = document.createElement('div');
    toast.className = 'vrs-toast vrs-toast--success';
    toast.innerHTML = `
      <div class="vrs-toast__icon">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="2"/></svg>
      </div>
      <div class="vrs-toast__content">
        <p class="vrs-toast__title">Message Sent!</p>
        <p class="vrs-toast__desc">We'll get back to you within 24 hours.</p>
      </div>
      <button class="vrs-toast__close" aria-label="Dismiss">&times;</button>
    `;
    this._injectToastStyles();
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('vrs-toast--visible'));
    toast.querySelector('.vrs-toast__close').addEventListener('click', () => this._dismissToast(toast));
    setTimeout(() => this._dismissToast(toast), 5000);
  }

  /**
   * Show error message — themed toast matching website design
   */
  showError(errorText) {
    const toast = document.createElement('div');
    toast.className = 'vrs-toast vrs-toast--error';
    toast.innerHTML = `
      <div class="vrs-toast__icon">
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="2"/><path d="M12 8v4m0 4h.01" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>
      </div>
      <div class="vrs-toast__content">
        <p class="vrs-toast__title">Oops!</p>
        <p class="vrs-toast__desc">${errorText}</p>
      </div>
      <button class="vrs-toast__close" aria-label="Dismiss">&times;</button>
    `;
    this._injectToastStyles();
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('vrs-toast--visible'));
    toast.querySelector('.vrs-toast__close').addEventListener('click', () => this._dismissToast(toast));
    setTimeout(() => this._dismissToast(toast), 4000);
  }

  /**
   * Dismiss a toast with exit animation
   */
  _dismissToast(el) {
    if (!el || !el.parentNode) return;
    el.classList.remove('vrs-toast--visible');
    el.classList.add('vrs-toast--exit');
    setTimeout(() => el.remove(), 300);
  }

  /**
   * Inject toast styles once into the page
   */
  _injectToastStyles() {
    if (document.getElementById('vrs-toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'vrs-toast-styles';
    style.textContent = `
      .vrs-toast {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 320px;
        max-width: 420px;
        padding: 16px 20px;
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.1);
        backdrop-filter: blur(12px);
        transform: translateX(120%);
        opacity: 0;
        transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.35s ease;
        font-family: 'Poppins', sans-serif;
      }
      .vrs-toast--visible {
        transform: translateX(0);
        opacity: 1;
      }
      .vrs-toast--exit {
        transform: translateX(120%);
        opacity: 0;
      }
      .vrs-toast--success {
        background: linear-gradient(135deg, #145f59 0%, #1a7a72 100%);
        border: 1px solid rgba(255,255,255,0.15);
      }
      .vrs-toast--error {
        background: linear-gradient(135deg, #9f3030 0%, #c0392b 100%);
        border: 1px solid rgba(255,255,255,0.15);
      }
      .vrs-toast__icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: rgba(255,255,255,0.15);
      }
      .vrs-toast__content {
        flex: 1;
        min-width: 0;
      }
      .vrs-toast__title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: #fff;
        line-height: 1.2;
      }
      .vrs-toast__desc {
        margin: 2px 0 0;
        font-size: 12px;
        font-weight: 500;
        color: rgba(255,255,255,0.85);
        line-height: 1.4;
      }
      .vrs-toast__close {
        flex-shrink: 0;
        background: rgba(255,255,255,0.15);
        border: none;
        border-radius: 8px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255,255,255,0.8);
        font-size: 18px;
        cursor: pointer;
        transition: background 0.2s, transform 0.2s;
      }
      .vrs-toast__close:hover {
        background: rgba(255,255,255,0.25);
        transform: scale(1.1);
      }
      @media (max-width: 480px) {
        .vrs-toast {
          top: 12px;
          right: 12px;
          left: 12px;
          min-width: auto;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup copy-to-clipboard functionality
   */
  setupCopyToClipboard() {
    const phoneElement = document.querySelector('a[href^="tel:"]');
    const emailElement = document.querySelector('a[href^="mailto:"]');

    if (phoneElement) {
      phoneElement.addEventListener('click', (e) => {
        if (this.isMobile()) {
          return; // Allow default on mobile
        }
        e.preventDefault();
        this.copyToClipboard('+1 (234) 567-890', 'Phone number');
      });
    }

    if (emailElement) {
      emailElement.addEventListener('click', (e) => {
        if (this.isMobile()) {
          return; // Allow default on mobile
        }
        e.preventDefault();
        this.copyToClipboard('info@rentavehicle.com', 'Email address');
      });
    }
  }

  /**
   * Setup phone link tracking
   */
  setupPhoneLink() {
    const phoneLink = document.querySelector('a[href^="tel:"]');
    if (phoneLink) {
      phoneLink.addEventListener('click', () => {
        this.trackInteraction('phone_click');
      });
    }
  }

  /**
   * Setup email link tracking
   */
  setupEmailLink() {
    const emailLink = document.querySelector('a[href^="mailto:"]');
    if (emailLink) {
      emailLink.addEventListener('click', () => {
        this.trackInteraction('email_click');
      });
    }
  }

  /**
   * Setup map link tracking
   */
  setupMapLink() {
    const mapLink = document.querySelector('a[href*="maps.google.com"]');
    if (mapLink) {
      mapLink.addEventListener('click', () => {
        this.trackInteraction('map_click');
      });
    }
  }

  /**
   * Copy text to clipboard
   */
  copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      this.showSuccessMessage(`${label} copied to clipboard!`);
    });
  }

  /**
   * Setup intersection observer for scroll animations
   */
  setupIntersectionObserver() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    }, observerOptions);

    // Observe contact cards
    document.querySelectorAll('.contact-card').forEach((card) => {
      observer.observe(card);
    });
  }

  /**
   * Track form submission
   */
  trackFormSubmission(data) {
    if (window.analytics) {
      window.analytics.track('contact_form_submission', {
        subject: data.subject,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Track user interactions
   */
  trackInteraction(action) {
    if (window.analytics) {
      window.analytics.track('contact_interaction', {
        action: action,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Check if device is mobile
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.ContactPage = new ContactPageModule();
  });
} else {
  window.ContactPage = new ContactPageModule();
}
