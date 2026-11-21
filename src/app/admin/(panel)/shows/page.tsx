import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { demoShows } from "@/lib/demo";
import ShowManagerForm from "./ShowManagerForm";
import AdminShowDeleteButton from "./AdminShowDeleteButton";
import AdminPageHeader from "../AdminPageHeader";
import { formatPerformanceTime, getShowPerformances } from "@/lib/show-performances";

export const dynamic = "force-dynamic";

export default async function ShowsAdmin() {
  if ((await getSession())?.role !== "admin") redirect("/admin/login");
  if (!isMongoConfigured()) return (
    <main className="container admin-page">
      <AdminPageHeader eyebrow="سجل العروض" title="العروض والليالي" description="أنشئ عرضًا جديدًا وحدد لياليه ومواعيده وطاقم الممثلين." />
      <div className="admin-show-list">
        {demoShows.map((show) => {
          const performances = getShowPerformances(show);
          return (
            <article className="card admin-show-list-item" key={show._id}>
              <strong>{show.title}</strong>
              <p>{performances.map((performance) => `${performance.date} ${formatPerformanceTime(performance.time)}`).join(" · ")} — {show.venue}</p>
              <p style={{ color: "var(--gold)" }}>{show.price.toLocaleString("ar")} جنيه · سعة {show.capacity} لكل ليلة</p>
            </article>
          );
        })}
      </div>
    </main>
  );
  const db = await getDb();
  const shows = await db.collection("shows").find().sort({ createdAt: -1 }).limit(100).toArray();
  return (
    <main className="container admin-page">
      <AdminPageHeader eyebrow="سجل العروض" title="العروض والليالي" description="أنشئ عرضًا جديدًا وحدد لياليه ومواعيده وطاقم الممثلين." />
      <ShowManagerForm />
      <div className="admin-show-list">
        {shows.map((show) => {
          const performances = getShowPerformances(show);
          const cast = Array.isArray(show.cast) ? show.cast.map((member) => ({
            name: String(member.name || ""),
            role: String(member.role || ""),
            photoFileId: member.photoFileId ? String(member.photoFileId) : undefined,
            photoUrl: member.photoFileId ? `/api/files/${String(member.photoFileId)}` : undefined,
          })) : [];
          return (
            <article className="card admin-show-list-item" key={show._id.toString()}>
              <div>
                <strong>{String(show.title)}</strong>
                <p>{performances.map((performance) => `${performance.date} ${formatPerformanceTime(performance.time)}${performance.open ? "" : " (مغلق)"}`).join(" · ")} — {String(show.venue)}</p>
                <p>{performances.length} ليالٍ · سعة {Number(show.capacity)} لكل ليلة · {Number(show.price).toLocaleString("ar")} جنيه للتذكرة</p>
              </div>
              <details className="admin-show-edit">
                <summary>تعديل بيانات العرض والكاست</summary>
                <ShowManagerForm initialShow={{
                  id: show._id.toString(),
                  title: String(show.title),
                  description: String(show.description || ""),
                  date: performances[0]?.date || String(show.date),
                  time: performances[0]?.time || String(show.time),
                  venue: String(show.venue),
                  price: Number(show.price),
                  capacity: Number(show.capacity),
                  open: Boolean(show.open),
                  performances,
                  posterFileId: show.posterFileId ? String(show.posterFileId) : undefined,
                  posterUrl: show.posterFileId ? `/api/files/${String(show.posterFileId)}` : undefined,
                  cast,
                }} />
              </details>
              <AdminShowDeleteButton showId={show._id.toString()} />
            </article>
          );
        })}
      </div>
    </main>
  );
}
