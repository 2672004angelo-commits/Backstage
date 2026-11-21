import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type DashboardMetric = {
  label: string;
  value: string | number;
  description: string;
  icon: string;
  tone: "gold" | "amber" | "green" | "red" | "blue" | "purple" | "teal";
};

function DashboardOverview({
  metrics,
  demoMode = false,
}: {
  metrics: DashboardMetric[];
  demoMode?: boolean;
}) {
  const quickLinks = [
    { href: "/admin/bookings", title: "الحجوزات والدفع", description: "افحص التحويلات واعتمد التذاكر", icon: "▤" },
    { href: "/admin/checkin", title: "بوابة المسرح", description: "تحقق من الكود واعتمد دخول الضيوف", icon: "✓" },
    { href: "/admin/shows", title: "العروض والليالي", description: "نظّم المواعيد وطاقم كل عرض", icon: "✦" },
    { href: "/admin/content", title: "محتوى الموقع", description: "أنشئ الصفحات التعريفية وحدّثها", icon: "▧" },
    { href: "/admin/branding", title: "هوية العلامة", description: "تحكم في الصور والشعارات والمظهر", icon: "◉" },
    { href: "/admin/account", title: "الحساب والأمان", description: "غيّر بريد الإدارة أو كلمة المرور", icon: "⌑" },
  ];

  return (
    <main className="admin-dashboard">
      <section className="admin-dashboard-hero">
        <div>
          <span className="admin-dashboard-kicker">مساحة العمل</span>
          <h1>لوحة التحكم</h1>
          <p>تابع الحجوزات والتذاكر وأدر تفاصيل BACKSTAGE من مكان واحد.</p>
        </div>
        <Link className="admin-dashboard-primary" href="/admin/bookings">
          <span aria-hidden="true">＋</span>
          مراجعة الحجوزات
          <span aria-hidden="true">←</span>
        </Link>
      </section>

      {demoMode && (
        <p className="admin-demo-notice" role="status">
          أنت في وضع العرض التجريبي؛ الأرقام المعروضة للتوضيح فقط.
        </p>
      )}

      <section className="admin-dashboard-section" aria-labelledby="dashboard-stats-title">
        <div className="admin-dashboard-section-heading">
          <div>
            <span>ملخص المنصة</span>
            <h2 id="dashboard-stats-title">الأرقام الرئيسية</h2>
          </div>
          <Link href="/admin/bookings">عرض الحجوزات <span aria-hidden="true">←</span></Link>
        </div>
        <div className="admin-metrics-grid">
          {metrics.map((metric) => (
            <article className={`admin-metric-card tone-${metric.tone}`} key={metric.label}>
              <div className="admin-metric-top">
                <span className="admin-metric-icon" aria-hidden="true">{metric.icon}</span>
                <span className="admin-metric-label">{metric.label}</span>
              </div>
              <strong className="admin-metric-value">{metric.value}</strong>
              <span className="admin-metric-description">{metric.description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-dashboard-section admin-quick-section" aria-labelledby="dashboard-quick-title">
        <div className="admin-dashboard-section-heading">
          <div>
            <span>اختصارات</span>
            <h2 id="dashboard-quick-title">إدارة سريعة</h2>
          </div>
        </div>
        <div className="admin-quick-grid">
          {quickLinks.map((item) => (
            <Link className="admin-quick-card" href={item.href} key={item.href}>
              <span className="admin-quick-icon" aria-hidden="true">{item.icon}</span>
              <span className="admin-quick-copy">
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <span className="admin-quick-arrow" aria-hidden="true">←</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");
  if (!isMongoConfigured()) {
    const metrics: DashboardMetric[] = [
      { label: "إجمالي الحجوزات", value: 128, description: "كل طلبات الحجز المسجلة", icon: "▤", tone: "gold" },
      { label: "بانتظار المراجعة", value: 14, description: "تحتاج إلى مراجعة الدفع", icon: "◷", tone: "amber" },
      { label: "الحجوزات المعتمدة", value: 96, description: "تم تأكيدها وإصدار التذاكر", icon: "✓", tone: "green" },
      { label: "الحجوزات المرفوضة", value: 18, description: "طلبات لم يتم اعتمادها", icon: "×", tone: "red" },
      { label: "إجمالي التذاكر", value: 342, description: "تذاكر صادرة للعروض", icon: "▣", tone: "blue" },
      { label: "التذاكر المدخلة", value: 87, description: "تم التحقق منها عند الدخول", icon: "↪", tone: "purple" },
      { label: "الإيراد", value: "12,450,000 جنيه", description: "من الحجوزات المعتمدة", icon: "جنيه", tone: "teal" },
    ];
    return <DashboardOverview metrics={metrics} demoMode />;
  }
  const db = await getDb();
  const [bookings, pending, approved, rejected, tickets, checkins] = await Promise.all([
    db.collection("bookings").countDocuments(),
    db.collection("bookings").countDocuments({ status: "PENDING_REVIEW" }),
    db.collection("bookings").countDocuments({ status: "APPROVED" }),
    db.collection("bookings").countDocuments({ status: "REJECTED" }),
    db.collection("tickets").countDocuments(),
    db.collection("checkins").countDocuments(),
  ]);
  const revenueResult = await db.collection("bookings").aggregate([
    { $match: { status: "APPROVED" } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]).next();
  const metrics: DashboardMetric[] = [
    { label: "إجمالي الحجوزات", value: bookings, description: "كل طلبات الحجز المسجلة", icon: "▤", tone: "gold" },
    { label: "بانتظار المراجعة", value: pending, description: "تحتاج إلى مراجعة الدفع", icon: "◷", tone: "amber" },
    { label: "الحجوزات المعتمدة", value: approved, description: "تم تأكيدها وإصدار التذاكر", icon: "✓", tone: "green" },
    { label: "الحجوزات المرفوضة", value: rejected, description: "طلبات لم يتم اعتمادها", icon: "×", tone: "red" },
    { label: "إجمالي التذاكر", value: tickets, description: "تذاكر صادرة للعروض", icon: "▣", tone: "blue" },
    { label: "التذاكر المدخلة", value: checkins, description: "تم التحقق منها عند الدخول", icon: "↪", tone: "purple" },
    { label: "الإيراد", value: `${Number(revenueResult?.total || 0).toLocaleString("ar")} جنيه`, description: "من الحجوزات المعتمدة", icon: "جنيه", tone: "teal" },
  ];
  return <DashboardOverview metrics={metrics} />;
}
