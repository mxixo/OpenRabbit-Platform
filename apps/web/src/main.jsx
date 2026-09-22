import ReactDOM from 'react-dom/client';
import {StrictMode} from 'react';
import {BrowserRouter} from 'react-router-dom';
import RootSurface from './RootSurface.jsx';
import './ConnectionsPage.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><RootSurface/></BrowserRouter></StrictMode>);
