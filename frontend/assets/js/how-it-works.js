/**
 * How it Works Section - Interactive Module
 * Handles animations and interactivity for the "How it Works" section
 */

class HowItWorksModule {
  constructor() {
    this.section = document.querySelector('section[class*="bg-\\[#F2F3F1\\]"]');
    this.stepCards = document.querySelectorAll('.step-card');
    this.init();
  }

  /**
   * Initialize the module and setup event listeners
   */
  init() {
    if (!this.section) return;
    
    // Add smooth scroll behavior
    this.setupScrollObserver();
    
    // Setup interactive step cards
    this.setupStepCardInteractions();
    
  }

  /**
   * Setup Intersection Observer for scroll animations
   */
  setupScrollObserver() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    }, observerOptions);

    this.stepCards.forEach(card => {
      observer.observe(card);
    });
  }

  /**
   * Setup interactive hover effects for step cards
   */
  setupStepCardInteractions() {
    this.stepCards.forEach((card, index) => {
      // Add hover effect
      card.addEventListener('mouseenter', () => {
        this.highlightStep(index);
      });

      card.addEventListener('mouseleave', () => {
        this.removeHighlight();
      });
    });
  }

  /**
   * Highlight a specific step
   * @param {number} stepIndex - The index of the step to highlight
   */
  highlightStep(stepIndex) {
    this.stepCards.forEach((card, index) => {
      if (index === stepIndex) {
        card.classList.add('highlighted');
      } else {
        card.classList.remove('highlighted');
      }
    });
  }

  /**
   * Remove all highlights
   */
  removeHighlight() {
    this.stepCards.forEach(card => {
      card.classList.remove('highlighted');
    });
  }

  /**
   * Get step information
   * @returns {Array} Array of step data
   */
  getStepData() {
    return [
      {
        step: 1,
        title: 'Choose Location',
        description: 'Select your pickup location from our available branches'
      },
      {
        step: 2,
        title: 'Pick-Up Date',
        description: 'Select your preferred date and time for vehicle pickup'
      },
      {
        step: 3,
        title: 'Book Your Car',
        description: 'Complete your booking and get instant confirmation'
      }
    ];
  }

  /**
   * Track user interaction with the section
   * Useful for analytics
   */
  trackInteraction(action, stepNumber = null) {
    if (window.analytics) {
      window.analytics.track('how_it_works_interaction', {
        action: action,
        step: stepNumber,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.HowItWorks = new HowItWorksModule();
  });
} else {
  window.HowItWorks = new HowItWorksModule();
}
