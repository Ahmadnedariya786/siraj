import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group"
      duration={1800}
      style={{
        maxWidth: "min(328px, calc(100vw - 32px))",
      }}
      toastOptions={{
        duration: 1800,
        style: {
          maxWidth: "min(328px, calc(100vw - 32px))",
          width: "100%",
          boxSizing: "border-box",
        },
        classNames: {
          toast:
            "group toast w-full max-w-full break-words group-[.toaster]:bg-[var(--surface-2)] group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-[var(--elevation-4)] group-[.toaster]:rounded-xl",
          title: "break-words",
          description: "group-[.toast]:text-muted-foreground break-words",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted group-[.toaster]:text-muted-foreground group-[.toast]:rounded-lg",
          success: "group-[.toast]:border-[var(--success)]/30 group-[.toast]:bg-[var(--success)]/10",
          error: "group-[.toast]:border-red-500/30 group-[.toast]:bg-red-500/10",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
