"use client";

type ShowCard = {
  id: string;
  title: string;
  venue: string;
  date: string;
  time: string;
  price: string;
  posterUrl?: string;
};

function ShowGroup({ shows, duplicate = false }: { shows: ShowCard[]; duplicate?: boolean }) {
  return (
    <div className="public-show-group" aria-hidden={duplicate || undefined}>
      {shows.map((show) => (
        <article className="public-show-card" key={`${duplicate ? "copy-" : ""}${show.id}`}>
          <div className={`public-show-art${show.posterUrl ? " has-poster" : ""}`} aria-hidden="true">
            {show.posterUrl && <img className="public-show-poster" src={show.posterUrl} alt="" />}
            <span>BACKSTAGE</span>
          </div>
          <div className="public-show-details">
            <span className="public-show-date">{show.date} <i /> {show.time}</span>
            <h3>{show.title}</h3>
            <p>{show.venue}</p>
            <div className="public-show-bottom">
              <strong>{show.price} <small>جنيه</small></strong>
              <a
                href={`/shows/${show.id}`}
                tabIndex={duplicate ? -1 : undefined}
                aria-hidden={duplicate || undefined}
                aria-label={`احجز الآن: ${show.title}`}
              >
                احجز مقعدك <span aria-hidden="true">←</span>
              </a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function ShowTicker({ shows }: { shows: ShowCard[] }) {
  const canLoop = shows.length > 1;

  return (
    <div className={`public-ticker${canLoop ? "" : " is-static"}`}>
      <div className="public-show-window" aria-label="العروض القادمة" dir="rtl">
        <div className="public-show-track">
          <ShowGroup shows={shows} />
          {canLoop && <ShowGroup shows={shows} duplicate />}
        </div>
      </div>
    </div>
  );
}
