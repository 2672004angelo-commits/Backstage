"use client";

import { useEffect, useState } from "react";

const titleParts = ["كل حكاية عظيمة", "تبدأ من هنا"];
const description = "ليالٍ من الفن والحكايات الحيّة. اكتشف عروضنا القادمة واحجز مقعدك في قلب المسرح.";

export default function HeroTypewriter() {
  const [firstLine, setFirstLine] = useState("");
  const [secondLine, setSecondLine] = useState("");
  const [descriptionText, setDescriptionText] = useState("");

  useEffect(() => {
    let cancelled = false;
    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

    async function typeText() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setFirstLine(titleParts[0]);
        setSecondLine(titleParts[1]);
        setDescriptionText(description);
        return;
      }

      setFirstLine("");
      setSecondLine("");
      setDescriptionText("");

      for (let index = 0; index < titleParts[0].length; index++) {
        if (cancelled) return;
        setFirstLine(titleParts[0].slice(0, index + 1));
        await wait(58);
      }

      await wait(220);
      for (let index = 0; index < titleParts[1].length; index++) {
        if (cancelled) return;
        setSecondLine(titleParts[1].slice(0, index + 1));
        await wait(62);
      }

      await wait(280);
      for (let index = 0; index < description.length; index++) {
        if (cancelled) return;
        setDescriptionText(description.slice(0, index + 1));
        await wait(24);
      }
    }

    void typeText();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <h1
        className="hero-typewriter"
        aria-label={`${titleParts[0]} ${titleParts[1]}`}
      >
        <span aria-hidden="true">{firstLine}</span>
        <br />
        <em aria-hidden="true">{secondLine}</em>
        {(!secondLine || secondLine.length < titleParts[1].length) && (
          <span className="hero-typewriter-caret" aria-hidden="true" />
        )}
      </h1>
      <p className="hero-typewriter-description" aria-label={description}>
        <span aria-hidden="true">{descriptionText}</span>
        {descriptionText.length < description.length && (
          <span className="hero-description-caret" aria-hidden="true" />
        )}
      </p>
    </>
  );
}
