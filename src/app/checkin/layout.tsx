import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "التحقق من التذاكر",
  robots: { index: false, follow: false },
};

export default function CheckinLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
