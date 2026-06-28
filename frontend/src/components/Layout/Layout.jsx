import React from 'react';

const Layout = ({ children }) => {
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <h2>Yakkay Tech</h2>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
};

export default Layout;
