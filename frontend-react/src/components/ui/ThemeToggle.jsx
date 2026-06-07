import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="vrs-theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <span className="vrs-theme-toggle__track">
        <span className="vrs-theme-toggle__thumb" />
      </span>
      <span className="vrs-theme-toggle__label">
        {theme === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
