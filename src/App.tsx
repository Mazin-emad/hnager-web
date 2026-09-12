import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { RequireAuth } from "@/auth/RequireAuth";
import { AccessDenied, RequirePermission } from "@/auth/RequirePermission";
import { AppShell } from "@/components/layout/AppShell";
import { SplashScreen } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const InvoiceListPage = lazy(() =>
  import("@/pages/invoices/InvoiceListPage").then((m) => ({ default: m.InvoiceListPage })),
);
const InvoiceBuilderPage = lazy(() =>
  import("@/pages/invoices/InvoiceBuilderPage").then((m) => ({ default: m.InvoiceBuilderPage })),
);
const ProductsPage = lazy(() =>
  import("@/pages/catalog/ProductsPage").then((m) => ({ default: m.ProductsPage })),
);
const ProductDetailPage = lazy(() =>
  import("@/pages/catalog/ProductDetailPage").then((m) => ({ default: m.ProductDetailPage })),
);
const VariablesPage = lazy(() =>
  import("@/pages/catalog/VariablesPage").then((m) => ({ default: m.VariablesPage })),
);
const UsersPage = lazy(() =>
  import("@/pages/admin/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const RolesPage = lazy(() =>
  import("@/pages/admin/RolesPage").then((m) => ({ default: m.RolesPage })),
);
const AccountPage = lazy(() =>
  import("@/pages/AccountPage").then((m) => ({ default: m.AccountPage })),
);
// TEMPORARY visual-contrast harness — deleted before publish.
const VisualPage = lazy(() =>
  import("@/pages/__Visual").then((m) => ({ default: m.VisualPage })),
);

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Card className="mx-auto mt-16 max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="tnum text-5xl font-bold text-brand-800">404</p>
        <p className="font-semibold">الصفحة غير موجودة</p>
        <Button onClick={() => navigate("/invoices")}>العودة للفواتير</Button>
      </CardContent>
    </Card>
  );
}

export function App() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* TEMPORARY visual-contrast harness — deleted before publish. */}
        <Route path="/__visual" element={<VisualPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/invoices" replace />} />
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="/invoices/:id" element={<InvoiceBuilderPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/variables" element={<VariablesPage />} />
          <Route
            path="/users"
            element={
              <RequirePermission permission="users:read" fallback={<AccessDenied />}>
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/roles"
            element={
              <RequirePermission permission="roles:read" fallback={<AccessDenied />}>
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
