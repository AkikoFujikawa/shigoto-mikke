"use client";
import { useState } from "react";
import Image from "next/image";

type JobImageProps = {
  name: string;
  imageUrl: string | null;
  emoji?: string | null;
};

export default function JobImage({ name, imageUrl, emoji }: JobImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-brand/10">
      {imageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="(max-width: 448px) 100vw, 448px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-6xl" aria-hidden="true">
          {emoji ?? "💼"}
        </span>
      )}
    </div>
  );
}
