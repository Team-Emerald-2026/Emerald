import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './components/Home';
import Attractions from './components/Attractions';
import Restaurants from './components/Restaurants';
import Map from './components/Map';
import NotFound from './components/NotFound';
import StoreLogin from './components/store/StoreLogin';
import StorePos from './components/store/StorePos';
import StoreDashboard from './components/store/StoreDashboard';
import StoreWaiting from './components/store/StoreWaiting';
import StoreTicket from './components/store/StoreTicket';
import StoreServed from './components/store/StoreServed';

export const router = createBrowserRouter([
  {
    // 来場者向けシェル（共通ヘッダー + 下部タブナビ）
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/attractions', element: <Attractions /> },
      // モバイルオーダーは同一コンポーネントを子パスでマウントし表示モードを切替
      { path: '/restaurants', element: <Restaurants /> },
      { path: '/restaurants/cart', element: <Restaurants /> },
      { path: '/restaurants/status', element: <Restaurants /> },
      { path: '/map', element: <Map /> },
    ],
  },
  // 店舗向け画面（来場者ナビとは独立）
  { path: '/store/login', element: <StoreLogin /> },
  { path: '/store', element: <StorePos /> },
  { path: '/store/dashboard', element: <StoreDashboard /> },
  { path: '/store/waiting', element: <StoreWaiting /> },
  { path: '/store/ticket', element: <StoreTicket /> },
  { path: '/store/served', element: <StoreServed /> },
  { path: '*', element: <NotFound /> },
]);
