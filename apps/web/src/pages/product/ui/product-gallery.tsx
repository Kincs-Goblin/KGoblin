"use client";

import { ChevronLeftIcon, ChevronRightIcon, ZoomInIcon } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";

import { ProductArt, type ProductImage, type Rarity } from "@/entities/product";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

import { productPageTexts } from "../config/texts";

type ProductGalleryProps = {
  images: ProductImage[];
  rarity: Rarity;
  productName: string;
  activeImage?: ProductImage | null;
};

type GalleryBodyProps = {
  galleryImages: ProductImage[];
  initialIndex: number;
  rarity: Rarity;
  productName: string;
};

const galleryTexts = productPageTexts.gallery;

function ProductGalleryBody({
  galleryImages,
  initialIndex,
  rarity,
  productName,
}: GalleryBodyProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [zoomOpen, setZoomOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const safeIndex = galleryImages.length > 0 ? activeIndex % galleryImages.length : 0;
  const currentImage = galleryImages[safeIndex] ?? null;
  const hasMultiple = galleryImages.length > 1;

  function showPrev() {
    if (!hasMultiple) return;
    setActiveIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  }

  function showNext() {
    if (!hasMultiple) return;
    setActiveIndex((prev) => (prev + 1) % galleryImages.length);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current == null || !hasMultiple) return;
    const endX = event.changedTouches[0]?.clientX;
    if (endX == null) return;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (delta > 40) showPrev();
    else if (delta < -40) showNext();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!hasMultiple) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="group relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={hasMultiple ? 0 : undefined}
      >
        <ProductArt
          image={currentImage}
          rarity={rarity}
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
        />

        {currentImage ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label={galleryTexts.openZoom}
            onClick={() => setZoomOpen(true)}
            className="absolute right-3 bottom-3 border border-bronze/60 bg-background/80 backdrop-blur-xs hover:bg-background"
          >
            <ZoomInIcon className="size-4" />
          </Button>
        ) : null}

        {hasMultiple ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label={galleryTexts.prevImage}
              onClick={showPrev}
              className="absolute top-1/2 left-2 -translate-y-1/2 border border-bronze/60 bg-background/80 backdrop-blur-xs hover:bg-background"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label={galleryTexts.nextImage}
              onClick={showNext}
              className="absolute top-1/2 right-2 -translate-y-1/2 border border-bronze/60 bg-background/80 backdrop-blur-xs hover:bg-background"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
            <span className="absolute bottom-3 left-3 rounded-full border border-bronze/50 bg-background/80 px-2.5 py-0.5 text-xs text-foreground/90 backdrop-blur-xs">
              {galleryTexts.imageCounter(safeIndex + 1, galleryImages.length)}
            </span>
          </>
        ) : null}
      </div>

      {hasMultiple ? (
        <ul aria-label={galleryTexts.thumbnailsLabel} className="flex gap-2 overflow-x-auto pb-1">
          {galleryImages.map((img, index) => {
            const isActive = index === safeIndex;
            return (
              <li key={`${img.src}-${index}`} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={galleryTexts.selectImage(index + 1)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative block size-16 overflow-hidden rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none sm:size-20",
                    isActive
                      ? "border-gold ring-2 ring-gold/40"
                      : "border-bronze/40 opacity-75 hover:border-gold/70 hover:opacity-100",
                  )}
                >
                  <Image src={img.src} alt={img.alt} fill sizes="80px" className="object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {currentImage ? (
        <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
          <DialogContent
            onKeyDown={handleKeyDown}
            className="frame-gold max-w-[calc(100%-2rem)] sm:max-w-3xl"
          >
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">
                {galleryTexts.zoomTitle(productName)}
              </DialogTitle>
            </DialogHeader>
            <div className="relative aspect-square max-h-[75vh] w-full overflow-hidden rounded-lg border border-bronze/40 bg-surface-stone">
              <Image
                src={currentImage.src}
                alt={currentImage.alt}
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-contain"
              />
              {hasMultiple ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label={galleryTexts.prevImage}
                    onClick={showPrev}
                    className="absolute top-1/2 left-3 -translate-y-1/2 border border-bronze/60 bg-background/85"
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label={galleryTexts.nextImage}
                    onClick={showNext}
                    className="absolute top-1/2 right-3 -translate-y-1/2 border border-bronze/60 bg-background/85"
                  >
                    <ChevronRightIcon />
                  </Button>
                </>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export function ProductGallery({ images, rarity, productName, activeImage }: ProductGalleryProps) {
  const galleryImages = useMemo(() => {
    const list = [...images];
    if (activeImage && !list.some((item) => item.src === activeImage.src)) {
      list.unshift(activeImage);
    }
    return list.map((item) => ({
      src: item.src,
      alt: item.alt || productName,
    }));
  }, [images, activeImage, productName]);

  const matchedIndex = activeImage
    ? galleryImages.findIndex((item) => item.src === activeImage.src)
    : 0;

  return (
    <ProductGalleryBody
      key={activeImage?.src ?? "default"}
      galleryImages={galleryImages}
      initialIndex={matchedIndex >= 0 ? matchedIndex : 0}
      rarity={rarity}
      productName={productName}
    />
  );
}
