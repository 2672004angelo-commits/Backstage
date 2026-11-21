import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminPageHeader from "../AdminPageHeader";
import AdminTicketActions from "./AdminTicketActions";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;

export default async function AdminTicketsPage({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");
  if (!isMongoConfigured()) {
    return (
      <main className="container admin-page">
        <AdminPageHeader eyebrow="أرشيف التذاكر" title="نسخ التذاكر" description="احتفظ بعرض وتحميل جميع التذاكر الصادرة." />
        <section className="card admin-empty-state">لا تتوفر نسخ تذاكر في وضع العرض التجريبي.</section>
      </main>
    );
  }

  const db = await getDb();
  const total = await db.collection("tickets").countDocuments();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = Number.parseInt((await searchParams).page || "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, pageCount)
    : 1;
  const tickets = await db.collection("tickets")
    .find()
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray();

  return (
    <main className="container admin-page">
      <AdminPageHeader eyebrow="أرشيف التذاكر" title="نسخ التذاكر" description="راجع نسخ التذاكر الصادرة وحالة استخدامها، وقم بتنزيلها عند الحاجة." />
      {tickets.length ? (
        <div className="admin-ticket-grid">
          {tickets.map((ticket) => (
            <article className="card admin-ticket-card" key={ticket._id.toString()}>
              <div className="admin-ticket-card-head">
                <strong>{String(ticket.ticketId)}</strong>
                <span className={ticket.checkedIn ? "is-used" : ticket.status === "CANCELLED" ? "is-cancelled" : "is-active"}>
                  {ticket.checkedIn ? "تم الاستخدام" : ticket.status === "CANCELLED" ? "ملغاة" : "صالحة للدخول"}
                </span>
              </div>
              <p>{String(ticket.guestName)}</p>
              <p>{String(ticket.snapshot?.showName || "")}</p>
              <p>{String(ticket.snapshot?.date || "")} · {String(ticket.snapshot?.time || "")}</p>
              {ticket.ticketImageFileId && (
                <a className="btn" href={`/api/files/${String(ticket.ticketImageFileId)}`} target="_blank" rel="noreferrer">
                  عرض وتنزيل التذكرة
                </a>
              )}
              <AdminTicketActions
                ticketId={ticket._id.toString()}
                status={String(ticket.status || "ACTIVE")}
                checkedIn={Boolean(ticket.checkedIn)}
              />
            </article>
          ))}
        </div>
      ) : (
        <section className="card admin-empty-state">لا توجد تذاكر صادرة حتى الآن.</section>
      )}
      {pageCount > 1 && (
        <nav className="admin-pagination" aria-label="صفحات أرشيف التذاكر">
          {page > 1 && <a className="btn booking-reminder-later" href={`/admin/tickets?page=${page - 1}`}>الأحدث</a>}
          <span>{page} / {pageCount}</span>
          {page < pageCount && <a className="btn booking-reminder-later" href={`/admin/tickets?page=${page + 1}`}>الأقدم</a>}
        </nav>
      )}
    </main>
  );
}
