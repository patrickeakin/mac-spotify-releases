import React from 'react';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => (
  <main className="login-container">
    <div className="login">
      <img
        className="logo"
        src="./numu-logo-white.svg"
        alt="NUMU Logo"
        onClick={onLogin}
        data-testid="login-logo"
      />
      <p className="login-instructions">CLICK TO LOGIN</p>
    </div>
  </main>
);
