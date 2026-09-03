import { NavProvider, useNav } from './navigation/navigator';
import { LoginScreen } from './screens/LoginScreen';
import { RegistroScreen } from './screens/RegistroScreen';

function Routes() {
  const { route } = useNav();
  return route.name === 'Registro' ? <RegistroScreen /> : <LoginScreen />;
}

/** Flujo sin sesión: registro / inicio de sesión. */
export function AuthFlow() {
  return (
    <NavProvider initial={{ name: 'Registro' }}>
      <Routes />
    </NavProvider>
  );
}
