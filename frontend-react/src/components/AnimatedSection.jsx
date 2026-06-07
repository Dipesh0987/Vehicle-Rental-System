import { useEffect, useState } from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

export function AnimatedSection({ 
  children, 
  className = '', 
  animation = 'fadeUp',
  delay = 0,
  duration = 800,
  threshold = 0.15
}) {
  const { ref, isVisible } = useScrollAnimation({ threshold });

  const animations = {
    fadeUp: {
      initial: { opacity: 0, transform: 'translateY(60px)' },
      animate: { opacity: 1, transform: 'translateY(0)' }
    },
    fadeDown: {
      initial: { opacity: 0, transform: 'translateY(-60px)' },
      animate: { opacity: 1, transform: 'translateY(0)' }
    },
    fadeLeft: {
      initial: { opacity: 0, transform: 'translateX(-60px)' },
      animate: { opacity: 1, transform: 'translateX(0)' }
    },
    fadeRight: {
      initial: { opacity: 0, transform: 'translateX(60px)' },
      animate: { opacity: 1, transform: 'translateX(0)' }
    },
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 }
    },
    scaleUp: {
      initial: { opacity: 0, transform: 'scale(0.8)' },
      animate: { opacity: 1, transform: 'scale(1)' }
    },
    rotateIn: {
      initial: { opacity: 0, transform: 'rotate(-10deg) scale(0.9)' },
      animate: { opacity: 1, transform: 'rotate(0deg) scale(1)' }
    }
  };

  const selectedAnimation = animations[animation] || animations.fadeUp;

  const style = {
    ...selectedAnimation.initial,
    transition: `all ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms`,
    willChange: 'opacity, transform'
  };

  if (isVisible) {
    Object.assign(style, selectedAnimation.animate);
  }

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

export function StaggerContainer({ children, className = '', staggerDelay = 100 }) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <div ref={ref} className={className}>
      {Array.isArray(children) ? children.map((child, index) => (
        <div
          key={index}
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
            transition: `all 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * staggerDelay}ms`,
            willChange: 'opacity, transform'
          }}
        >
          {child}
        </div>
      )) : children}
    </div>
  );
}

export function ParallaxWrapper({ children, speed = 0.5, className = '' }) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0 });
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const scrolled = window.innerHeight - rect.top;
      setOffset(scrolled * speed * 0.1);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return (
    <div 
      ref={ref} 
      className={className}
      style={{
        transform: `translateY(${offset}px)`,
        transition: 'transform 0.1s linear',
        willChange: 'transform'
      }}
    >
      {children}
    </div>
  );
}
