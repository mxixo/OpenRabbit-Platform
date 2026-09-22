import ReactDOM from 'react-dom/client';
import {StrictMode} from 'react';
import {BrowserRouter,useLocation} from 'react-router-dom';
import App from './App.jsx';
import OnboardingPage from './OnboardingPage.jsx';
import './ConnectionsPage.jsx';
import './styles.css';

function RootSurface(){
  const location=useLocation();
  return location.pathname==='/onboarding'?<OnboardingPage/>:<App/>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><RootSurface/></BrowserRouter></StrictMode>);
