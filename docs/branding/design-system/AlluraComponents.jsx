import React from 'react';
import './components.css';

// ============================================
// ALLURA DESIGN SYSTEM — React Components
// ============================================

export const Button = ({ 
  variant = 'primary', 
  children, 
  onClick, 
  disabled = false,
  className = ''
}) => {
  const variantClass = {
    primary: 'allura-btn-primary',
    secondary: 'allura-btn-secondary',
    tertiary: 'allura-btn-tertiary'
  }[variant] || 'allura-btn-primary';

  return (
    <button 
      className={`allura-btn ${variantClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export const Card = ({ 
  title, 
  children, 
  className = '' 
}) => {
  return (
    <div className={`allura-card ${className}`}>
      {title && <h4 className="allura-card-title">{title}</h4>}
      <p className="allura-card-body">{children}</p>
    </div>
  );
};

export const Badge = ({ 
  variant = 'success', 
  children 
}) => {
  const variantClass = {
    success: 'allura-badge-success',
    info: 'allura-badge-info',
    warning: 'allura-badge-warning'
  }[variant] || 'allura-badge-success';

  return (
    <span className={`allura-badge ${variantClass}`}>
      {children}
    </span>
  );
};

export const Arch = ({ 
  size = 'md', 
  src, 
  alt = '' 
}) => {
  const sizeClass = {
    sm: 'allura-arch-sm',
    md: 'allura-arch-md',
    lg: 'allura-arch-lg'
  }[size] || 'allura-arch-md';

  return (
    <div className={`allura-arch ${sizeClass}`}>
      <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

export const Typography = {
  Hero: ({ children }) => <h1 className="allura-heading-hero">{children}</h1>,
  H1: ({ children }) => <h1 className="allura-heading-1">{children}</h1>,
  H2: ({ children }) => <h2 className="allura-heading-2">{children}</h2>,
  H3: ({ children }) => <h3 className="allura-heading-3">{children}</h3>,
  H4: ({ children }) => <h4 className="allura-heading-4">{children}</h4>,
  BodyLarge: ({ children }) => <p className="allura-body-large">{children}</p>,
  Body: ({ children }) => <p className="allura-body">{children}</p>,
  Caption: ({ children }) => <span className="allura-caption">{children}</span>,
  Overline: ({ children }) => <span className="allura-overline">{children}</span>
};

export const Container = ({ children, className = '' }) => {
  return (
    <div className={`allura-container ${className}`}>
      {children}
    </div>
  );
};

// ============================================
// FORM COMPONENTS
// ============================================

export const Input = ({ 
  label, 
  placeholder = '', 
  type = 'text', 
  value, 
  onChange, 
  error = '', 
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`allura-input-group ${className}`}>
      {label && <label className="allura-input-label">{label}</label>}
      <input
        type={type}
        className={`allura-input ${error ? 'allura-input-error' : ''} ${disabled ? 'allura-input-disabled' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      {error && <span className="allura-input-error-text">{error}</span>}
    </div>
  );
};

export const TextArea = ({ 
  label, 
  placeholder = '', 
  value, 
  onChange, 
  rows = 4,
  error = '', 
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`allura-input-group ${className}`}>
      {label && <label className="allura-input-label">{label}</label>}
      <textarea
        className={`allura-input allura-textarea ${error ? 'allura-input-error' : ''} ${disabled ? 'allura-input-disabled' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
        disabled={disabled}
      />
      {error && <span className="allura-input-error-text">{error}</span>}
    </div>
  );
};

export const Select = ({ 
  label, 
  options = [], 
  value, 
  onChange, 
  placeholder = 'Select...',
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`allura-input-group ${className}`}>
      {label && <label className="allura-input-label">{label}</label>}
      <select
        className={`allura-input allura-select ${disabled ? 'allura-input-disabled' : ''}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

export const Checkbox = ({ 
  label, 
  checked = false, 
  onChange, 
  disabled = false,
  className = ''
}) => {
  return (
    <label className={`allura-checkbox ${disabled ? 'allura-checkbox-disabled' : ''} ${className}`}>
      <input
        type="checkbox"
        className="allura-checkbox-input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="allura-checkbox-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {label && <span className="allura-checkbox-label">{label}</span>}
    </label>
  );
};

export const Toggle = ({ 
  label, 
  checked = false, 
  onChange, 
  disabled = false,
  className = ''
}) => {
  return (
    <label className={`allura-toggle ${disabled ? 'allura-toggle-disabled' : ''} ${className}`}>
      {label && <span className="allura-toggle-label">{label}</span>}
      <input
        type="checkbox"
        className="allura-toggle-input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="allura-toggle-slider" />
    </label>
  );
};

// ============================================
// DATA DISPLAY COMPONENTS
// ============================================

export const Avatar = ({ 
  src, 
  alt = '', 
  size = 'md',
  fallback = ''
}) => {
  const sizeClass = {
    sm: 'allura-avatar-sm',
    md: 'allura-avatar-md',
    lg: 'allura-avatar-lg',
    xl: 'allura-avatar-xl'
  }[size] || 'allura-avatar-md';

  const [error, setError] = React.useState(false);

  return (
    <div className={`allura-avatar ${sizeClass}`}>
      {!error && src ? (
        <img src={src} alt={alt} onError={() => setError(true)} />
      ) : (
        <span className="allura-avatar-fallback">{fallback || alt.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
};

export const Tooltip = ({ 
  children, 
  text, 
  position = 'top'
}) => {
  return (
    <div className={`allura-tooltip allura-tooltip-${position}`}>
      {children}
      <span className="allura-tooltip-text">{text}</span>
    </div>
  );
};

export const Alert = ({ 
  variant = 'info', 
  title = '', 
  children,
  onClose,
  className = ''
}) => {
  const variantClass = {
    info: 'allura-alert-info',
    success: 'allura-alert-success',
    warning: 'allura-alert-warning',
    error: 'allura-alert-error'
  }[variant] || 'allura-alert-info';

  return (
    <div className={`allura-alert ${variantClass} ${className}`} role="alert">
      <div className="allura-alert-content">
        {title && <h4 className="allura-alert-title">{title}</h4>}
        <p className="allura-alert-body">{children}</p>
      </div>
      {onClose && (
        <button className="allura-alert-close" onClick={onClose} aria-label="Close alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};

export const ProgressBar = ({ 
  value = 0, 
  max = 100, 
  size = 'md',
  label = '',
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const sizeClass = {
    sm: 'allura-progress-sm',
    md: 'allura-progress-md',
    lg: 'allura-progress-lg'
  }[size] || 'allura-progress-md';

  return (
    <div className={`allura-progress ${sizeClass} ${className}`}>
      {label && <span className="allura-progress-label">{label}</span>}
      <div className="allura-progress-track">
        <div 
          className="allura-progress-fill" 
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};

// ============================================
// NAVIGATION COMPONENTS
// ============================================

export const NavItem = ({ 
  href = '#', 
  children, 
  active = false,
  className = ''
}) => {
  return (
    <a 
      href={href} 
      className={`allura-nav-item ${active ? 'allura-nav-item-active' : ''} ${className}`}
    >
      {children}
    </a>
  );
};

export const Navbar = ({ 
  logo, 
  children,
  className = ''
}) => {
  return (
    <nav className={`allura-navbar ${className}`}>
      <div className="allura-navbar-inner">
        <div className="allura-navbar-logo">{logo}</div>
        <div className="allura-navbar-links">{children}</div>
      </div>
    </nav>
  );
};

// ============================================
// LAYOUT / SECTION COMPONENTS
// ============================================

export const Hero = ({ 
  overline = '', 
  headline, 
  subheadline = '', 
  cta,
  className = ''
}) => {
  return (
    <section className={`allura-hero ${className}`}>
      <Container>
        <div className="allura-hero-content">
          {overline && <Typography.Overline>{overline}</Typography.Overline>}
          <Typography.Hero>{headline}</Typography.Hero>
          {subheadline && <Typography.BodyLarge>{subheadline}</Typography.BodyLarge>}
          {cta && <div className="allura-hero-cta">{cta}</div>}
        </div>
      </Container>
    </section>
  );
};

export const FeatureCard = ({ 
  icon, 
  title, 
  description,
  className = ''
}) => {
  return (
    <div className={`allura-feature-card ${className}`}>
      <div className="allura-feature-icon">{icon}</div>
      <h3 className="allura-feature-title">{title}</h3>
      <p className="allura-feature-description">{description}</p>
    </div>
  );
};

export const Footer = ({ 
  logo, 
  links = [], 
  copyright = '',
  className = ''
}) => {
  return (
    <footer className={`allura-footer ${className}`}>
      <Container>
        <div className="allura-footer-inner">
          <div className="allura-footer-brand">{logo}</div>
          <div className="allura-footer-links">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="allura-footer-link">{link.label}</a>
            ))}
          </div>
          {copyright && <p className="allura-footer-copyright">{copyright}</p>}
        </div>
      </Container>
    </footer>
  );
};
