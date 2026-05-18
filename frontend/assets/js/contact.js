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
   * Handle form submission
   */
  handleFormSubmit() {
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

    // Track submission
    this.trackFormSubmission(formData);

    // Show success message
    this.showSuccessMessage();

    // Reset form
    this.form.reset();
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
   * Show success message
   */
  showSuccessMessage() {
    const message = document.createElement('div');
    message.className =
      'fixed top-6 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in z-50';
    message.textContent = 'Message sent successfully! We\'ll be in touch soon.';
    document.body.appendChild(message);

    setTimeout(() => {
      message.remove();
    }, 4000);
  }

  /**
   * Show error message
   */
  showError(errorText) {
    const message = document.createElement('div');
    message.className =
      'fixed top-6 right-6 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in z-50';
    message.textContent = errorText;
    document.body.appendChild(message);

    setTimeout(() => {
      message.remove();
    }, 3000);
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
