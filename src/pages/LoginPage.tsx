import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { parseApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "البريد الإلكتروني مطلوب")
    .email("بريد إلكتروني غير صالح"),
  password: z
    .string()
    .min(1, "كلمة المرور مطلوبة")
    .regex(PASSWORD_RULE, "8 أحرف على الأقل: كبير وصغير ورقم ورمز"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (status === "authed") {
    const from =
      (location.state as { from?: string } | null)?.from ?? "/invoices";
    return <Navigate to={from} replace />;
  }

  async function onSubmit(values: LoginValues) {
    setBusy(true);
    try {
      await login(values.email.trim(), values.password);
      toast.success("مرحبًا بعودتك");
      const from =
        (location.state as { from?: string } | null)?.from ?? "/invoices";
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 p-10 lg:flex">
        <div
          className="pointer-events-none absolute -start-24 -top-24 size-96 rounded-full bg-brand-800/60 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -end-16 size-96 rounded-full bg-clay-600/25 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <img
            src="/again-mark.png"
            alt="شعار مؤسسة اجين من جديد"
            className="size-20 rounded-3xl object-cover shadow-2xl"
          />
          <div>
            <p className="text-3xl font-bold text-paper">مؤسسة اجين من جديد</p>
            <p className="mt-1 text-sm tracking-wide text-brand-200">
              AGAIN
            </p>
          </div>
        </div>
        <div className="relative">
          <p className="max-w-md text-2xl font-semibold leading-relaxed text-paper">
            نظام إدارة الفواتير والمنتجات والمعادلات — كل حساباتك في مكان واحد
          </p>
          <div className="mt-6 flex gap-6 text-sm text-brand-200">
            <span>فواتير مبيعات ومشتريات</span>
            <span>تصدير PDF</span>
            <span>صلاحيات وأدوار</span>
          </div>
        </div>
        <p className="relative text-xs text-brand-300">
          © مؤسسة اجين من جديد — جميع الحقوق محفوظة
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-paper px-4 py-10">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="items-center text-center">
            <img
              src="/again-mark.png"
              alt="شعار مؤسسة اجين من جديد"
              className="size-16 rounded-2xl object-cover lg:hidden"
            />
            <CardTitle className="text-2xl text-brand-950">
              تسجيل الدخول
            </CardTitle>
            <CardDescription>
              أدخل بياناتك للوصول إلى لوحة الفواتير
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>البريد الإلكتروني</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            dir="ltr"
                            autoComplete="username"
                            placeholder="name@company.com"
                            className="pl-9 text-left"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            dir="ltr"
                            autoComplete="current-password"
                            className="pe-9 ps-11 text-left"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={
                              showPassword
                                ? "إخفاء كلمة المرور"
                                : "إظهار كلمة المرور"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full text-white  bg-brand-800 hover:bg-brand-900"
                  disabled={busy}
                >
                  {busy ? "جارٍ تسجيل الدخول…" : "دخول"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
