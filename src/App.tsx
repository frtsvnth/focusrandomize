import { useEffect } from 'react';
import { useAppState } from './state/store';
import PresenterMode from './components/presenter/PresenterMode';
import AdminMode from './components/admin/AdminMode';

function Router() {
  const { state, dispatch } = useAppState();

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'admin') dispatch({ type: 'SET_MODE', payload: 'admin' });
      else dispatch({ type: 'SET_MODE', payload: 'presenter' });
    };
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, [dispatch]);

  useEffect(() => {
    const desired = state.ui.mode === 'admin' ? '#admin' : '#presenter';
    if (window.location.hash !== desired) {
      window.location.hash = desired;
    }
  }, [state.ui.mode]);

  return (
    <div className="gradient-bg" style={{ minHeight: '100vh' }}>
      {state.ui.mode === 'admin' ? <AdminMode /> : <PresenterMode />}
    </div>
  );
}

export default function App() {
  return <Router />;
}
