/**
 * Allura Brand Kit - Tailwind Configuration
 * Synced from Figma: https://www.figma.com/design/PAQpnxQZENNwbhmk5qxOjR/allura-gpt
 * Client: allura-memory
 * Updated: April 24, 2026 — Allura Primitives collection sync
 *
 * Usage: Merge this config with your project's tailwind.config.js
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  // IMPORTANT: Add this to your existing tailwind.config.js theme.extend
  theme: {
    extend: {
      // ============================================
      // COLORS - Brand Palette
      // Source: Figma / Allura Primitives + Semantic
      // ============================================
      colors: {
        // Primitive Brand Colors
        brand: {
          'deep-navy': '#1A2B4A',
          'coral': '#E85A3C',
          'trust-green': '#4CAF50',
          'clarity-blue': '#5B8DB8',
          'pure-white': '#F5F5F5',
          'ink-black': '#1A1A1A',
          'warm-gray': '#737373',
        },

        // Semantic Action Colors
        action: {
          primary: '#E85A3C',    // coral
          secondary: '#1A2B4A',  // deep-navy
          tertiary: '#4CAF50',   // trust-green
        },

        // Surface Colors
        surface: {
          primary: '#F5F5F5',    // pure-white
          secondary: '#5B8DB8',  // clarity-blue
          inverted: '#1A2B4A',   // deep-navy
          elevated: '#FFFFFF',
        },

        // Status Colors
        status: {
          success: '#4CAF50',    // trust-green
          info: '#5B8DB8',       // clarity-blue
          warning: '#E85A3C',    // coral
          error: '#E74C3C',
        },
      },

      // ============================================
      // TYPOGRAPHY
      // ============================================
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Inconsolata', 'monospace'],
      },
      
      fontSize: {
        // Major Third Scale (1.25)
        'hero': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        'display': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        'h1': ['2.5rem', { lineHeight: '1.25', letterSpacing: '-0.025em' }],
        'h2': ['2rem', { lineHeight: '1.25', letterSpacing: '-0.025em' }],
        'h3': ['1.5rem', { lineHeight: '1.25' }],
        'h4': ['1.25rem', { lineHeight: '1.25' }],
        'h5': ['1.125rem', { lineHeight: '1.5' }],
        'h6': ['1rem', { lineHeight: '1.5' }],
        'body': ['1rem', { lineHeight: '1.5' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'caption': ['0.75rem', { lineHeight: '1.5' }],
        'overline': ['0.6875rem', { lineHeight: '1.5', letterSpacing: '0.1em' }],
      },
      
      fontWeight: {
        light: '300',
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        black: '900',
      },
      
      lineHeight: {
        'tight': '1.1',
        'snug': '1.25',
        'normal': '1.5',
        'relaxed': '1.625',
        'loose': '2',
      },
      
      letterSpacing: {
        'tight': '-0.025em',
        'normal': '0',
        'wide': '0.025em',
        'wider': '0.05em',
        'widest': '0.1em',
      },

      // ============================================
      // SPACING - 8px Base Grid
      // ============================================
      spacing: {
        '0.5': '0.125rem',   // 2px
        '1': '0.25rem',      // 4px
        '2': '0.5rem',       // 8px
        '3': '0.75rem',      // 12px
        '4': '1rem',         // 16px
        '5': '1.25rem',      // 20px
        '6': '1.5rem',       // 24px
        '8': '2rem',         // 32px
        '10': '2.5rem',      // 40px
        '12': '3rem',        // 48px
        '16': '4rem',        // 64px
        '20': '5rem',        // 80px
        '24': '6rem',        // 96px
        '32': '8rem',        // 128px
        '40': '10rem',       // 160px
        '48': '12rem',       // 192px
        '56': '14rem',       // 224px
        '64': '16rem',       // 256px
      },

      // ============================================
      // BORDER RADIUS
      // ============================================
      borderRadius: {
        'sm': '0.25rem',     // 4px
        'md': '0.5rem',      // 8px
        'lg': '0.75rem',     // 12px
        'xl': '1rem',        // 16px
        '2xl': '1.5rem',     // 24px
        '3xl': '2rem',       // 32px
        'full': '9999px',
      },

      // ============================================
      // SHADOWS - Layered Depth System
      // ============================================
      boxShadow: {
        // Ambient Shadows
        'ambient-sm': '0 1px 2px rgba(20, 35, 41, 0.05)',
        'ambient-md': '0 4px 6px rgba(20, 35, 41, 0.05)',
        'ambient-lg': '0 10px 15px rgba(20, 35, 41, 0.05)',
        'ambient-xl': '0 20px 25px rgba(20, 35, 41, 0.05)',
        
        // Directional Shadows
        'directional-sm': '0 1px 3px rgba(20, 35, 41, 0.1)',
        'directional-md': '0 4px 6px rgba(20, 35, 41, 0.1)',
        'directional-lg': '0 10px 15px rgba(20, 35, 41, 0.1)',
        'directional-xl': '0 20px 25px rgba(20, 35, 41, 0.1)',
        
        // Combined Shadows
        'sm': '0 1px 2px rgba(20, 35, 41, 0.05), 0 1px 3px rgba(20, 35, 41, 0.1)',
        'md': '0 4px 6px rgba(20, 35, 41, 0.05), 0 4px 6px rgba(20, 35, 41, 0.1)',
        'lg': '0 10px 15px rgba(20, 35, 41, 0.05), 0 10px 15px rgba(20, 35, 41, 0.1)',
        'xl': '0 20px 25px rgba(20, 35, 41, 0.05), 0 20px 25px rgba(20, 35, 41, 0.1)',
        
        // Elevation Shadows
        'elevation-1': '0 1px 2px rgba(20, 35, 41, 0.08)',
        'elevation-2': '0 2px 4px rgba(20, 35, 41, 0.08), 0 1px 2px rgba(20, 35, 41, 0.04)',
        'elevation-3': '0 4px 8px rgba(20, 35, 41, 0.08), 0 2px 4px rgba(20, 35, 41, 0.04)',
        'elevation-4': '0 8px 16px rgba(20, 35, 41, 0.08), 0 4px 8px rgba(20, 35, 41, 0.04)',
        'elevation-5': '0 16px 32px rgba(20, 35, 41, 0.08), 0 8px 16px rgba(20, 35, 41, 0.04)',
        
        // Focus Rings
        'focus': '0 0 0 3px rgba(232, 90, 60, 0.3)',
        'focus-error': '0 0 0 3px rgba(231, 76, 60, 0.3)',
      },

      // ============================================
      // TRANSITIONS
      // ============================================
      transitionDuration: {
        'instant': '0ms',
        'fast': '100ms',
        'normal': '200ms',
        'slow': '300ms',
        'slower': '500ms',
      },
      
      transitionTimingFunction: {
        'linear': 'linear',
        'in': 'cubic-bezier(0.4, 0, 1, 1)',
        'out': 'cubic-bezier(0, 0, 0.2, 1)',
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },

      // ============================================
      // Z-INDEX
      // ============================================
      zIndex: {
        'dropdown': '100',
        'sticky': '200',
        'fixed': '300',
        'modal-backdrop': '400',
        'modal': '500',
        'popover': '600',
        'tooltip': '700',
        'toast': '800',
      },
    },
  },
  
  // ============================================
  // DARK MODE SUPPORT
  // ============================================
  darkMode: 'class', // or 'media' for prefers-color-scheme
  
  // ============================================
  // SAFELIST (Optional - for dynamic classes)
  // ============================================
  safelist: [
    'bg-brand-deep-navy',
    'bg-brand-coral',
    'bg-brand-trust-green',
    'bg-brand-clarity-blue',
    'bg-brand-pure-white',
    'bg-brand-ink-black',
    'bg-brand-warm-gray',
    'text-brand-deep-navy',
    'text-brand-coral',
    'text-brand-trust-green',
    'text-brand-clarity-blue',
    'text-brand-pure-white',
    'text-brand-ink-black',
    'text-brand-warm-gray',
  ],
};

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// Colors
<div className="bg-action-primary text-text-inverted">
  Primary Action Button
</div>

<div className="bg-surface-primary text-text-primary">
  Card with primary surface
</div>

// Typography
<h1 className="text-h1 font-bold text-text-primary">
  Page Title
</h1>

<p className="text-body text-text-primary">
  Body text content
</p>

// Spacing
<div className="p-6 gap-4">
  Content with spacing
</div>

// Shadows
<div className="shadow-md hover:shadow-lg transition-shadow">
  Card with elevation
</div>

// Border Radius
<button className="rounded-md px-4 py-2">
  Button with medium radius
</button>

<div className="rounded-3xl overflow-hidden">
  Feature card with large radius
</div>

// Focus States
<input className="focus:shadow-focus focus:outline-none" />

// Dark Mode
<div className="bg-surface-primary dark:bg-surface-inverted">
  Theme-aware surface
</div>
*/
