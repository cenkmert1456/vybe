import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";

export function PhotoCarousel({
  photos,
  name,
  className,
  imgClassName,
}: {
  photos: string[];
  name: string;
  className?: string;
  imgClassName?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [index, setIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {photos.map((p, i) => (
            <div key={i} className="relative min-w-0 flex-[0_0_100%]">
              <ImageWithFallback
                src={p}
                name={name}
                alt={`${name} photo ${i + 1}`}
                className="h-full w-full"
                imgClassName={imgClassName}
              />
            </div>
          ))}
        </div>
      </div>
      {photos.length > 1 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {photos.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-white/90" : "w-1.5 bg-white/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
