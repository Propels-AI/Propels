import { useEffect, useState, FormEvent, useId, useRef } from "react";
import { Hub } from "@aws-amplify/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signIn, confirmSignIn, signUp, confirmSignUp, getCurrentUser, signOut } from "aws-amplify/auth";
import { Lock, Mail, MailCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type AuthMode = "emailEntry" | "otpVerification";

interface PasswordlessAuthProps {
  onAuthSuccess?: () => void;
  hasAnonymousSession?: boolean;
  onSyncAnonymousDemo?: () => void;
  isInDialog?: boolean;
}

function PasswordlessAuthComponent({
  onAuthSuccess,
  hasAnonymousSession = false,
  onSyncAnonymousDemo,
  isInDialog = false,
}: PasswordlessAuthProps) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const log = (...args: any[]) => console.debug("[PasswordlessAuth]", ...args);
  const logError = (context: string, err: unknown) => {
    const anyErr = err as any;
    const info = {
      name: anyErr?.name,
      message: anyErr?.message,
      code: anyErr?.code,
      $metadata: anyErr?.$metadata,
    };
    console.error(`[PasswordlessAuth] ${context}`, info, anyErr);
  };
  const [mode, setMode] = useState<AuthMode>("emailEntry");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [isSignUpFlow, setIsSignUpFlow] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Reusable error component
  const ErrorMessage = ({ error }: { error: string }) => (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 mb-2">
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 mt-0.5 flex-shrink-0">
        <AlertCircle className="h-3 w-3 text-destructive" />
      </div>
      <p className="text-sm text-destructive leading-relaxed m-0">{error}</p>
    </div>
  );

  // Clear error when user edits email to re-enable submit UX
  useEffect(() => {
    if (error) setError(null);
    // when switching email, ensure we're in emailEntry mode
    if (mode !== "emailEntry") setMode("emailEntry");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  useEffect(() => {
    const hubListenerCancel = Hub.listen("auth", ({ payload }) => {
      log("Hub auth event:", payload?.event, payload);
      if (payload.event === "signedIn") {
        toast.success("Welcome!", {
          description: "You have been successfully signed in.",
        });
        onAuthSuccess?.();
      }
    });
    return hubListenerCancel;
  }, [onAuthSuccess]);

  const handleBackToEmail = () => {
    log("Back to email entry");
    setMode("emailEntry");
    setOtpCode("");
    setError(null);
    setIsSignUpFlow(false);
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);
    log("Email submit start", { email: email.trim() });

    try {
      // If a user is already signed in
      try {
        const current = await getCurrentUser();
        if (current) {
          const currentUsername = (current as any)?.username || (current as any)?.userId;
          const same = String(currentUsername || "").toLowerCase() === email.trim().toLowerCase();
          if (same) {
            log("Already signed in with same user; completing auth without OTP");
            onAuthSuccess?.();
            return;
          } else {
            log("Different user already signed in; signing out before continuing");
            await signOut({ global: true }).catch(() => {});
          }
        }
      } catch {
        // getCurrentUser throws if not signed in; ignore
      }

      await signIn({
        username: email.trim(),
        options: {
          authFlowType: "CUSTOM_WITHOUT_SRP",
          clientMetadata: { email: email.trim() },
        },
      });
      log("signIn(CUSTOM_WITHOUT_SRP) succeeded; switching to otpVerification for existing user");
      setIsSignUpFlow(false);
      setError(null);
      setMode("otpVerification");
    } catch (err) {
      const error = err as { name: string; message: string };
      const isExpectedFirstSignInFailure =
        error.name === "UserNotFoundException" ||
        (error.name === "NotAuthorizedException" && (error.message || "").includes("Incorrect username or password"));

      if (isExpectedFirstSignInFailure) {
        log("Email submit: initial signIn indicates new user; proceeding to signUp flow");
      } else {
        logError("Email submit signIn failed", err);
      }
      // Recover if we hit 'already a signed in user'
      if (
        (error.name === "InvalidStateException" || error.name === "NotAuthorizedException") &&
        /already\s+a?\s*signed\s*in\s*user/i.test(error.message || "")
      ) {
        try {
          log("Encountered 'already signed in'; signing out and retrying signIn");
          await signOut({ global: true });
          await signIn({
            username: email.trim(),
            options: { authFlowType: "CUSTOM_WITHOUT_SRP", clientMetadata: { email: email.trim() } },
          });
          setIsSignUpFlow(false);
          setMode("otpVerification");
          return;
        } catch (retryErr) {
          logError("Retry after signOut failed", retryErr);
        }
      }
      // If the user does not exist yet, create the user and use sign-up confirmation flow
      // Backend returns NotAuthorizedException for non-existent users in custom auth flow
      if (
        error.name === "UserNotFoundException" ||
        (error.name === "NotAuthorizedException" && error.message?.includes("Incorrect username or password"))
      ) {
        try {
          const tp = "Temp!" + Math.random().toString(36).slice(2) + "A1";
          await signUp({
            username: email.trim(),
            password: tp,
            options: { userAttributes: { email: email.trim() } },
          });
          log("signUp succeeded; immediately triggering custom challenge signIn to send OTP");
          // Immediately start custom auth flow to send email OTP
          await signIn({
            username: email.trim(),
            options: { authFlowType: "CUSTOM_WITHOUT_SRP", clientMetadata: { email: email.trim() } },
          });
          setIsSignUpFlow(false);
          setTempPassword(tp);
          setError(null);
          setMode("otpVerification");
        } catch (signUpErr) {
          const suErr = signUpErr as { name?: string; message?: string };
          logError("signUp failed after UserNotFoundException", signUpErr);
          if (suErr.name === "UsernameExistsException") {
            try {
              await signIn({
                username: email.trim(),
                options: {
                  authFlowType: "CUSTOM_WITHOUT_SRP",
                  clientMetadata: { email: email.trim() },
                },
              });
              log("Retry signIn after UsernameExistsException succeeded; switching to otpVerification");
              setError(null);
              setMode("otpVerification");
              return;
            } catch (retryErr) {
              const r = retryErr as { message?: string };
              logError("Retry signIn after UsernameExistsException failed", retryErr);
              setError(r.message || suErr.message || "Failed to continue sign in.");
              return;
            }
          }
          setError(suErr.message || "Failed to start sign up. Please try again.");
        }
      } else if (error.name === "UserNotConfirmedException") {
        log("User exists but not confirmed; triggering custom challenge signIn to send OTP");
        try {
          await signIn({
            username: email.trim(),
            options: { authFlowType: "CUSTOM_WITHOUT_SRP", clientMetadata: { email: email.trim() } },
          });
          setIsSignUpFlow(false);
          setMode("otpVerification");
        } catch (resendErr) {
          logError("Failed to trigger custom challenge signIn", resendErr);
          setError("Failed to send code. Please try again.");
        }
      } else if (
        error.name === "NotAuthorizedException" &&
        error.message?.toLowerCase().includes("incorrect code. please try again")
      ) {
        try {
          const tp = "Temp!" + Math.random().toString(36).slice(2) + "A1";
          await signUp({
            username: email.trim(),
            password: tp,
            options: { userAttributes: { email: email.trim() } },
          });
          log("signUp succeeded after NotAuthorizedException; triggering custom challenge signIn to send OTP");
          await signIn({
            username: email.trim(),
            options: { authFlowType: "CUSTOM_WITHOUT_SRP", clientMetadata: { email: email.trim() } },
          });
          setIsSignUpFlow(false);
          setTempPassword(tp);
          setMode("otpVerification");
        } catch (e2) {
          const e = e2 as { name?: string; message?: string };
          logError("signUp failed after NotAuthorizedException", e2);
          if (e.name === "UsernameExistsException") {
            log("User exists, checking if they need confirmation");
            setIsSignUpFlow(true);
            setMode("otpVerification");
            return;
          }
          setError(e.message || "Failed to sign up. Please try again.");
        }
      } else if (error.name === "NotAuthorizedException" && error.message?.toLowerCase().includes("email")) {
        log("Email-related NotAuthorizedException encountered");
        setError("Failed to send email. Please check your email address and try again.");
      } else {
        log("Unhandled error on email submit");
        setError(error.message || "Failed to start sign in. Please try again.");
      }
    } finally {
      log("Email submit end");
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length !== 6) return;
    setIsLoading(true);
    setError(null);
    log("OTP submit start", { codeLen: otpCode.length });
    try {
      if (isSignUpFlow) {
        log("Confirming sign-up with confirmation code");
        await confirmSignUp({
          username: email.trim(),
          confirmationCode: otpCode.trim(),
        });
        log("Sign-up confirmed successfully, now signing in with temp password");

        if (!tempPassword) {
          throw new Error("Missing temporary password for sign-in");
        }
        await signIn({
          username: email.trim(),
          password: tempPassword,
        });
        log("Sign-in completed with temporary password");
      } else {
        log("Confirming custom challenge for existing user");
        await confirmSignIn({ challengeResponse: otpCode.trim() });
      }

      onSyncAnonymousDemo?.();
    } catch (err) {
      logError("OTP submit failed", err);
      const anyErr = err as any;
      const name = anyErr?.name as string | undefined;
      const msg = (anyErr?.message as string | undefined) || "Invalid code. Please try again.";
      const http = anyErr?.$metadata?.httpStatusCode as number | undefined;

      if (name === "ExpiredCodeException") {
        setError("Code expired. Please request a new one.");
      } else if (name === "CodeMismatchException") {
        setError("Incorrect code. Please try again.");
      } else {
        // Transform generic auth errors to be more appropriate for OTP context
        if (msg && msg.toLowerCase().includes("incorrect username or password")) {
          setError("Invalid verification code. Please try again.");
        } else {
          setError(msg);
        }
      }

      const looksLikeSessionIssue =
        name === "NotAuthorizedException" ||
        name === "InvalidParameterException" ||
        name === "ResourceNotFoundException" ||
        (typeof msg === "string" && /session|challenge/i.test(msg) && !msg.toLowerCase().includes("code")) ||
        http === 400;

      if (
        !isSignUpFlow &&
        looksLikeSessionIssue &&
        name !== "CodeMismatchException" &&
        name !== "ExpiredCodeException"
      ) {
        try {
          log("Attempting session recovery: re-triggering custom challenge signIn");
          await signIn({
            username: email.trim(),
            options: {
              authFlowType: "CUSTOM_WITHOUT_SRP",
              clientMetadata: { email: email.trim() },
            },
          });
          setOtpCode("");
          setMode("otpVerification");
          log("Session recovery succeeded; new OTP sent");
        } catch (recoverErr) {
          logError("Session recovery failed", recoverErr);
        }
      }
    } finally {
      log("OTP submit end");
      setIsLoading(false);
    }
  };

  return (
    <>
      {isInDialog && (
        <DialogHeader>
          <DialogTitle className="sr-only">{mode === "emailEntry" ? "Sign In or Sign Up" : "Verify Email"}</DialogTitle>
        </DialogHeader>
      )}

      <Card className={`w-full ${isInDialog ? "border-0 shadow-none" : "max-w-sm mx-auto"}`}>
        {mode === "emailEntry" ? (
          <>
            {hasAnonymousSession && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded-md border border-blue-200 dark:border-blue-800 mx-6 mt-6">
                <p className="font-semibold">Sign up to save the demo you just captured!</p>
              </div>
            )}

            <CardHeader className="space-y-1 pb-4">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Lock className="h-5 w-5 text-foreground" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl font-semibold tracking-tight">Sign In or Sign Up</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground px-2">
                    Enter your email to sign in or create a new account. We'll send you a secure one-time passcode.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <form ref={formRef} onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-email`} className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id={`${id}-email`}
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                </div>

                {error && <ErrorMessage error={error} />}

                <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Sending passcode...
                    </div>
                  ) : (
                    "Continue with Email"
                  )}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By continuing, you agree to our{" "}
                  <a href="#" className="underline underline-offset-4 hover:text-primary">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="underline underline-offset-4 hover:text-primary">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-1 pb-4">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <MailCheck className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl font-semibold tracking-tight">Check your email</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground px-2">
                    We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <form ref={formRef} onSubmit={handleOtpSubmit} className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor={`${id}-confirmation-code`} className="text-sm font-medium text-center block">
                    Enter verification code
                  </Label>
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={(value) => setOtpCode(value)}
                    disabled={isLoading}
                    name={`${id}-confirmation-code`}
                    id={`${id}-confirmation-code`}
                    onComplete={(value) => {
                      setOtpCode(value);
                      setTimeout(() => {
                        if (value.length === 6) {
                          const submitButton = formRef.current?.querySelector(
                            'button[type="submit"]'
                          ) as HTMLButtonElement;
                          if (submitButton && !submitButton.disabled) {
                            submitButton.click();
                          }
                        }
                      }, 100);
                    }}
                  >
                    <InputOTPGroup className="w-full justify-center">
                      {[...Array(6)].map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && <ErrorMessage error={error} />}

                <Button type="submit" className="w-full" disabled={isLoading || otpCode.length !== 6}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Verifying...
                    </div>
                  ) : (
                    "Verify Code"
                  )}
                </Button>
              </form>

              <div className="flex flex-col items-center space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Didn't receive a code?{" "}
                  <Button
                    variant="link"
                    type="button"
                    className="p-0 h-auto font-normal underline-offset-4"
                    onClick={async () => {
                      if (!email.trim() || resendDisabled) return;
                      setIsLoading(true);
                      setError(null);
                      try {
                        // Always re-trigger custom challenge sign-in to send a fresh OTP
                        log("Resend: re-trigger custom challenge signIn");
                        await signIn({
                          username: email.trim(),
                          options: {
                            authFlowType: "CUSTOM_WITHOUT_SRP",
                            clientMetadata: { email: email.trim() },
                          },
                        });
                        setOtpCode("");
                        setResendDisabled(true);
                        setTimeout(() => setResendDisabled(false), 20000);
                      } catch (resendErr) {
                        logError("Resend code failed", resendErr);
                        const rErr = resendErr as { message?: string };
                        let errorMsg = rErr.message || "Failed to resend code.";
                        // Transform generic auth errors for resend context
                        if (errorMsg.toLowerCase().includes("incorrect username or password")) {
                          errorMsg = "Unable to resend code. Please try again.";
                        }
                        setError(errorMsg);
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading || resendDisabled}
                  >
                    Resend code
                  </Button>
                </p>
                <Button
                  variant="ghost"
                  type="button"
                  className="text-sm"
                  onClick={handleBackToEmail}
                  disabled={isLoading}
                >
                  ← Back to email
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </>
  );
}

export { PasswordlessAuthComponent as PasswordlessAuth };
