import Link from "next/link";

type AdminPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function AdminPageHeader({ eyebrow, title, description }: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      <div>
        <span className="admin-page-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <Link className="admin-page-back" href="/admin">العودة إلى لوحة التحكم <span aria-hidden="true">←</span></Link>
    </header>
  );
}
