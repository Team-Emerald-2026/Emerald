import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './components/Home';
import Attractions from './components/Attractions';
import Restaurants from './components/Restaurants';
import CampusMap from './components/Map';
import Events from './components/Events';
import NotFound from './components/NotFound';

// 店舗用・管理用・モニター画面は来場者が使わないため、
// アクセスされたときに初めて読み込む（コード分割）
const Monitor = lazy(() => import('./components/Monitor'));
const StoreLogin = lazy(() => import('./components/store/StoreLogin'));
const StorePos = lazy(() => import('./components/store/StorePos'));
const StoreDashboard = lazy(() => import('./components/store/StoreDashboard'));
const StoreWaiting = lazy(() => import('./components/store/StoreWaiting'));
const StoreTicket = lazy(() => import('./components/store/StoreTicket'));
const StoreServed = lazy(() => import('./components/store/StoreServed'));
const StoreProfile = lazy(() => import('./components/store/StoreProfile'));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminStores = lazy(() => import('./components/admin/AdminStores'));
const AdminEvents = lazy(() => import('./components/admin/AdminEvents'));
const AdminMap = lazy(() => import('./components/admin/AdminMap'));
const AdminAnalytics = lazy(() => import('./components/admin/AdminAnalytics'));

// 遅延読み込み中に表示する簡易ローディング
function withSuspense(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-gray-500">
          読み込み中...
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    // 来場者向けシェル（共通ヘッダー + 下部タブナビ）
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/attractions', element: <Attractions /> },
      { path: '/restaurants', element: <Restaurants /> },
      { path: '/events', element: <Events /> },
      { path: '/map', element: <CampusMap /> },
    ],
  },
  // 校内モニター（プロジェクター）向け呼び出し番号一覧（認証不要）
  { path: '/monitor', element: withSuspense(<Monitor />) },
  // 店舗向け画面（来場者ナビとは独立）
  { path: '/store/login', element: withSuspense(<StoreLogin />) },
  { path: '/store', element: withSuspense(<StorePos />) },
  { path: '/store/dashboard', element: withSuspense(<StoreDashboard />) },
  { path: '/store/waiting', element: withSuspense(<StoreWaiting />) },
  { path: '/store/ticket', element: withSuspense(<StoreTicket />) },
  { path: '/store/served', element: withSuspense(<StoreServed />) },
  { path: '/store/profile', element: withSuspense(<StoreProfile />) },
  { path: '/admin/login', element: withSuspense(<AdminLogin />) },
  { path: '/admin', element: withSuspense(<AdminDashboard />) },
  { path: '/admin/analytics', element: withSuspense(<AdminAnalytics />) },
  { path: '/admin/stores', element: withSuspense(<AdminStores />) },
  { path: '/admin/map', element: withSuspense(<AdminMap />) },
  { path: '/admin/events', element: withSuspense(<AdminEvents />) },
  { path: '*', element: <NotFound /> },
]);
