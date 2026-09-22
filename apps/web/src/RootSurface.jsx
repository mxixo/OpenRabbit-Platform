import {useLocation} from 'react-router-dom';
import App from './App.jsx';
import OnboardingPage from './OnboardingPage.jsx';

export default function RootSurface(){
  const location=useLocation();
  return location.pathname==='/onboarding'?<OnboardingPage/>:<App/>;
}
