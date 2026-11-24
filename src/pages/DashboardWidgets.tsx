import { AppBar } from "@/components/AppBar";
import { WidgetCustomizer } from "@/components/WidgetCustomizer";
import { PageTransition } from "@/components/PageTransition";
import { useLanguage } from "@/contexts/LanguageContext-new";

export default function DashboardWidgets() {
  const { t } = useLanguage();
  return (
    <PageTransition>
      <div className="min-h-screen bg-transparent pb-4 relative z-10">
        <AppBar title={t("customizeDashboard") || "Customize Dashboard"} showBack />
        <div className="p-4">
          <WidgetCustomizer />
        </div>
      </div>
    </PageTransition>
  );
}

