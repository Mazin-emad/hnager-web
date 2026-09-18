import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FileText,
  Inbox,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { RequirePermission } from "@/auth/RequirePermission";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  permission?: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/invoices", label: "الفواتير", icon: <FileText className="size-5" />, end: true },
  { to: "/invoices/received", label: "الفواتير المرسلة لي", icon: <Inbox className="size-5" />, permission: "invoices:received-read" },
  { to: "/products", label: "المنتجات", icon: <Package className="size-5" /> },
  { to: "/variables", label: "المتغيرات", icon: <SlidersHorizontal className="size-5" /> },
  { to: "/users", label: "المستخدمون", icon: <Users className="size-5" />, permission: "users:read" },
  { to: "/roles", label: "الأدوار", icon: <ShieldCheck className="size-5" />, permission: "roles:read" },
];

function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/again-logo.png"
        alt="Again"
        className={cn(
          "w-auto rounded-lg bg-white object-contain px-2 py-1 shadow-lg",
          compact ? "h-9 max-w-36" : "h-11 max-w-44",
        )}
      />
      <div className="leading-tight">
        <p dir="ltr" className={cn("text-start font-bold text-paper", compact ? "text-base" : "text-lg")}>Again</p>
        <p className="text-xs text-brand-200">نظام الفواتير</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <RequirePermission key={item.to} permission={item.permission}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-paper text-brand-950 shadow"
                  : "text-brand-100 hover:bg-white/10 hover:text-paper",
              )
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </NavLink>
        </RequirePermission>
      ))}
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}` || "؟";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pe-1 ps-3 shadow-sm transition-shadow hover:shadow"
          >
            <span className="max-w-32 truncate text-sm font-medium text-brand-950">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-800 text-sm font-bold text-paper">
              {initials}
            </span>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold">{user?.firstName} {user?.lastName}</p>
            <p className="tnum truncate text-xs text-muted-foreground" dir="ltr">{user?.email}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/account")}>
          <UserCircle className="size-4" />
          حسابي
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void logout().then(() => navigate("/login", { replace: true }));
          }}
          className="text-destructive"
        >
          <LogOut className="size-4" />
          تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-svh bg-paper">
      {/* Desktop sidebar — right side in RTL (start) */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col bg-brand-950 px-4 py-6 lg:flex">
        <BrandBlock />
        <div className="mt-8 flex-1">
          <NavLinks />
        </div>
        <Button
          variant="ghost"
          className="justify-start text-brand-100 hover:bg-white/10 hover:text-paper"
          onClick={() => {
            void logout().then(() => navigate("/login", { replace: true }));
          }}
        >
          <LogOut className="size-5" />
          تسجيل الخروج
        </Button>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col bg-brand-950 px-4 py-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <BrandBlock compact />
              <Button
                variant="ghost"
                size="icon"
                className="text-paper hover:bg-white/10"
                onClick={() => setDrawerOpen(false)}
                aria-label="إغلاق القائمة"
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="mt-8 flex-1">
              <NavLinks onNavigate={() => setDrawerOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 border-b border-border bg-paper/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="فتح القائمة"
              >
                <Menu className="size-5" />
              </Button>
              <span dir="ltr" className="text-sm font-semibold text-brand-900 lg:hidden">Again</span>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
