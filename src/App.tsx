import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import AusgabenuebersichtPage from '@/pages/AusgabenuebersichtPage';
import EinnahmenuebersichtPage from '@/pages/EinnahmenuebersichtPage';
import PublicFormAusgabenuebersicht from '@/pages/public/PublicForm_Ausgabenuebersicht';
import PublicFormEinnahmenuebersicht from '@/pages/public/PublicForm_Einnahmenuebersicht';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/67c17bf34fb0c01e5f48c85b" element={<PublicFormAusgabenuebersicht />} />
              <Route path="public/67c17bea1aa71139a082efdb" element={<PublicFormEinnahmenuebersicht />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="ausgabenuebersicht" element={<AusgabenuebersichtPage />} />
                <Route path="einnahmenuebersicht" element={<EinnahmenuebersichtPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
