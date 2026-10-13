import { useEffect } from 'react';

// Global UX: after ANY form submit that leaves invalid fields, scroll to the first
// one, focus it, and shake it. Works for every React-Bootstrap form that uses
// `isInvalid` (which adds the `.is-invalid` class) — no per-form wiring needed.
export default function FormErrorEffects() {
  useEffect(() => {
    const onSubmit = () => {
      // Wait for React to render the validation state, then find the first error.
      setTimeout(() => {
        const el = document.querySelector('.is-invalid, [aria-invalid="true"]');
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof el.focus === 'function') {
          try { el.focus({ preventScroll: true }); } catch { /* ignore */ }
        }
        el.classList.remove('field-shake');
        // reflow so the animation can replay on repeated submits
        // eslint-disable-next-line no-unused-expressions
        el.offsetWidth;
        el.classList.add('field-shake');
        el.addEventListener('animationend', () => el.classList.remove('field-shake'), { once: true });
      }, 60);
    };
    document.addEventListener('submit', onSubmit, true);
    return () => document.removeEventListener('submit', onSubmit, true);
  }, []);

  return null;
}
