import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { changePassword, getProfile, updateProfile } from "@/api/account";
import { authKeys } from "@/api/auth";
import { parseApiError } from "@/api/errors";
import { useAuth } from "@/auth/AuthContext";
import { PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/queryClient";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const profileSchema = z.object({
  firstName: z.string().min(3, "3 أحرف على الأقل").max(100),
  lastName: z.string().min(3, "3 أحرف على الأقل").max(100),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
    newPassword: z.string().regex(PASSWORD_RULE, "8 أحرف على الأقل: كبير وصغير ورقم ورمز"),
    confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "تأكيد كلمة المرور غير متطابق",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "الجديدة يجب أن تختلف عن الحالية",
    path: ["newPassword"],
  });

export function AccountPage() {
  const { user } = useAuth();
  const [profileBusy, setProfileBusy] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { firstName: user?.firstName ?? "", lastName: user?.lastName ?? "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const passwordMutation = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      changePassword(values),
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور");
      passwordForm.reset();
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  async function saveProfile(values: z.infer<typeof profileSchema>) {
    setProfileBusy(true);
    try {
      await updateProfile(values);
      // Refresh the cached profile snapshot.
      await getProfile().catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: authKeys.profile });
      toast.success("تم حفظ البيانات — تُحدَّث الأسماء بعد إعادة تسجيل الدخول");
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="حسابي" subtitle="بياناتك الشخصية وإعدادات الأمان" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">الملف الشخصي</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-800 text-lg font-bold text-paper">
                {(user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="tnum truncate text-sm text-muted-foreground" dir="ltr">
                  {user?.email}
                </p>
              </div>
            </div>
            {user && user.roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {user.roles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الاسم الأول</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الاسم الأخير</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={profileBusy} className="bg-brand-800 hover:bg-brand-900">
                  {profileBusy ? "جارٍ الحفظ…" : "حفظ البيانات"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">تغيير كلمة المرور</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit((v) =>
                  passwordMutation.mutate({
                    currentPassword: v.currentPassword,
                    newPassword: v.newPassword,
                  }),
                )}
                className="space-y-4"
              >
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور الحالية</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" dir="ltr" autoComplete="current-password" className="text-left" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور الجديدة</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" dir="ltr" autoComplete="new-password" className="text-left" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تأكيد الجديدة</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" dir="ltr" autoComplete="new-password" className="text-left" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={passwordMutation.isPending}
                  className="bg-clay-600 hover:bg-clay-700"
                >
                  {passwordMutation.isPending ? "جارٍ التغيير…" : "تغيير كلمة المرور"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
