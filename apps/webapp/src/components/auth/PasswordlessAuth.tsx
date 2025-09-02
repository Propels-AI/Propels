import { useEffect, useState, FormEvent, useId, useRef } from "react";
import { Hub } from "@aws-amplify/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signIn, confirmSignIn, signUp, confirmSignUp, getCurrentUser, signOut } from "aws-amplify/auth";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
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
        setError(msg);
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
    <div
      className={`w-full space-y-6 ${
        isInDialog ? "p-6" : "max-w-md mx-auto p-6 bg-background text-foreground rounded-lg shadow-md border"
      }`}
    >
      {isInDialog && (
        <DialogHeader>
          <DialogTitle className="sr-only">{mode === "emailEntry" ? "Sign In or Sign Up" : "Verify Email"}</DialogTitle>
        </DialogHeader>
      )}

      {mode === "emailEntry" ? (
        <div className="space-y-6">
          {hasAnonymousSession && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="font-semibold">Sign up to save the demo you just captured!</p>
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border"
              aria-hidden="true"
            >
              <Mail className="h-6 w-6" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-semibold leading-none tracking-tight">Sign In or Sign Up</h2>
              <p className="text-sm text-muted-foreground">Enter your email to get a one-time code.</p>
            </div>
          </div>

          <form ref={formRef} className="grid gap-4" onSubmit={handleEmailSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id}-email`}>Email</Label>
                <Input
                  id={`${id}-email`}
                  type="email"
                  placeholder="john.doe@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-500 text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Code...
                </>
              ) : (
                "Continue with Email"
              )}
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border"
              aria-hidden="true"
            >
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-semibold leading-none tracking-tight">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
            </div>
          </div>

          <form ref={formRef} className="grid gap-4" onSubmit={handleOtpSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id}-confirmation-code`}>Verification Code</Label>
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
                <div className="text-center text-sm text-muted-foreground">
                  <span>Didn't get a code? </span>
                  <Button
                    variant="link"
                    type="button"
                    className="p-0 h-auto font-normal text-primary hover:underline disabled:opacity-50 inline-flex items-center"
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
                        setError(rErr.message || "Failed to resend code.");
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading || resendDisabled}
                  >
                    Send code again.
                  </Button>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-500 text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading || otpCode.length !== 6}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Back to{" "}
              <Button
                variant="link"
                type="button"
                className="p-0 h-auto font-normal disabled:opacity-50"
                onClick={handleBackToEmail}
                disabled={isLoading}
              >
                Email Entry
              </Button>
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

export { PasswordlessAuthComponent as PasswordlessAuth };
