import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useEffect } from "react";

export default function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLang();
  const { enterDemo } = useDemoMode();

  const handleGuestTour = () => {
    enterDemo();
    navigate("/", { replace: true });
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: t("登录失败", "Login failed"), description: error.message, variant: "destructive" });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: t("注册失败", "Sign up failed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("注册成功", "Sign up successful"), description: t("已自动登录", "Logged in automatically") });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: t("请输入邮箱", "Please enter email"), variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: t("发送失败", "Send failed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("重置邮件已发送", "Reset email sent"), description: t("请检查您的邮箱", "Please check your inbox") });
      setShowForgot(false);
    }
  };

  if (showForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f3ee] p-4">
        <Card className="w-full max-w-sm border-[#e4e1d7] shadow-none">
          <CardHeader>
            <CardTitle className="text-center text-[#1f1a14]">{t("重置密码", "Reset Password")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[#8a847a]">{t("邮箱", "Email")}</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
              </div>
              <Button type="submit" className="w-full bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white" disabled={loading}>
                {loading ? t("发送中...", "Sending...") : t("发送重置邮件", "Send Reset Email")}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-[#8a847a]" onClick={() => setShowForgot(false)}>
                {t("返回登录", "Back to Login")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f3ee] p-4">
      <Card className="w-full max-w-sm border-[#e4e1d7] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-lg bg-[#1f1a14] flex items-center justify-center text-white font-bold text-lg">V</div>
            <span className="text-xl font-semibold text-[#1f1a14]">V-Life</span>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 bg-[#f4f3ee]">
              <TabsTrigger value="login">{t("登录", "Login")}</TabsTrigger>
              <TabsTrigger value="signup">{t("注册", "Sign Up")}</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-[#8a847a]">{t("邮箱", "Email")}</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8a847a]">{t("密码", "Password")}</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white" disabled={loading}>
                  {loading ? t("登录中...", "Logging in...") : t("登录", "Login")}
                </Button>
                <Button type="button" variant="link" className="w-full text-sm text-[#8a847a]" onClick={() => setShowForgot(true)}>
                  {t("忘记密码？", "Forgot password?")}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-[#8a847a]">{t("邮箱", "Email")}</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8a847a]">{t("密码", "Password")}</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("至少6位", "At least 6 characters")} required minLength={6} />
                </div>
                <Button type="submit" className="w-full bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white" disabled={loading}>
                  {loading ? t("注册中...", "Signing up...") : t("注册", "Sign Up")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="mt-6 pt-4 border-t border-[#e4e1d7]">
            <Button type="button" variant="outline" className="w-full border-[#e4e1d7] text-[#8a847a] hover:bg-[#f4f3ee] hover:text-[#1f1a14]" onClick={handleGuestTour}>
              🎭 {t("游客参观", "Guest Tour")}
            </Button>
            <p className="text-xs text-center text-[#8a847a] mt-2">
              {t("无需注册，直接体验完整功能", "No signup needed, explore all features")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
