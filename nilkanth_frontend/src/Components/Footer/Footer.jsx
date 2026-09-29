import React from 'react';
import { useLocation } from 'react-router-dom';

const Footer = () => {
  const location = useLocation();

  // ❌ Hide footer on the login page
  if (location.pathname === '/login') return null;

  return (
    <footer
      style={{
        backgroundColor: '#ffffff',
        color: '#8a93a6',
        padding: '20px 0 10px',
        borderTop: '1px solid #e0e0e0',
        textAlign: 'center',
        fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: '13px',
        letterSpacing: '0.2px',
      }}
    >
      <p style={{ margin: 0 }}>
        Designed and Developed by{' '}
        <a
          href="https://techorses.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#4a6cf7',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#7b9dfc';
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#4a6cf7';
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          Techorses
        </a>
      </p>
    </footer>
  );
};

export default Footer;