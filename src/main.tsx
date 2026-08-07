import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { SplashScreen } from './components/pwa/SplashScreen';

function removeBootSplash() {
  document.getElementById('boot-splash')?.remove();
}

function Root() {
  const [splashDone, setSplashDone] = useState(false);

  const handleSplashDone = () => {
    removeBootSplash();
    setSplashDone(true);
  };

  return (
    <>
      {!splashDone && <SplashScreen onDone={handleSplashDone} />}
      {splashDone && (
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
