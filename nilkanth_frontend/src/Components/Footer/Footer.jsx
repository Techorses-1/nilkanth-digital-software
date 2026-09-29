import React from 'react';

const Footer = () => {
  return (
    <footer
      style={{
        backgroundColor: '#ffffff',
        color: '#333333',
        padding: '20px 0',
        borderTop: '1px solid #e0e0e0',
        textAlign: 'center',
        fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: '14px',
      }}
    >
      <p style={{ margin: 0 }}>
        Designed and Developed by{' '}
        <a
          href="https://techorses.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontWeight: 600,
            color: '#333333',
            textDecoration: 'none',
          }}
        >
          Techorses
        </a>
      </p>
    </footer>
  );
};

export default Footer;